import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: max 60 events per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

const validEventTypes = ['impression', 'click', 'profile_view', 'transaction', 'review', 'booking'];
const validSourcePages = ['discover', 'search', 'directory', 'map', 'profile', 'storefront'];
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    const body = await req.json();
    const events = Array.isArray(body.events) ? body.events : [body];

    if (events.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Max 50 events per request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const validEvents = events
      .filter((e: any) => {
        if (!e.merchant_id || !uuidRegex.test(e.merchant_id)) return false;
        if (!e.service_name || typeof e.service_name !== 'string') return false;
        if (!e.event_type || !validEventTypes.includes(e.event_type)) return false;
        if (e.source_page && !validSourcePages.includes(e.source_page)) return false;
        return true;
      })
      .map((e: any) => ({
        merchant_id: e.merchant_id,
        service_name: e.service_name,
        event_type: e.event_type,
        user_id: userId,
        session_id: typeof e.session_id === 'string' ? e.session_id.slice(0, 64) : null,
        source_page: e.source_page || null,
        metadata: typeof e.metadata === 'object' ? e.metadata : {},
      }));

    if (validEvents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid events' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { error } = await supabase
      .from('service_conversion_events')
      .insert(validEvents);

    if (error) {
      console.error('Insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to record events' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, recorded: validEvents.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

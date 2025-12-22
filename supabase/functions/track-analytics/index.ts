import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRankingEvent {
  merchant_id: string;
  event_type: 'impression' | 'click' | 'conversion';
  search_term?: string;
  position?: number;
  source_page: string;
  session_id: string;
  device_type: string;
  is_boosted?: boolean;
  category_match?: boolean;
  local_match?: boolean;
}

interface SponsoredEvent {
  merchant_id: string;
  event_type: 'impression' | 'click' | 'conversion';
  source_page: string;
  session_id: string;
  search_query?: string;
  position?: number;
  device_type: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to insert analytics
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the user if authenticated (optional - analytics can be anonymous)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const body = await req.json();
    const { type, events } = body;

    if (!type || !events || !Array.isArray(events)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type and events array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: max 50 events per request
    if (events.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 events per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'search_ranking') {
      // Validate and sanitize search ranking events
      const validEvents = events.map((event: SearchRankingEvent) => ({
        merchant_id: event.merchant_id,
        event_type: ['impression', 'click', 'conversion'].includes(event.event_type) ? event.event_type : 'impression',
        search_term: event.search_term?.slice(0, 200) || null, // Limit search term length
        position: typeof event.position === 'number' ? Math.min(Math.max(event.position, 1), 1000) : null,
        source_page: event.source_page?.slice(0, 50) || 'unknown',
        user_id: userId,
        session_id: event.session_id?.slice(0, 100) || 'unknown',
        device_type: event.device_type?.slice(0, 20) || 'unknown',
        is_boosted: Boolean(event.is_boosted),
        category_match: Boolean(event.category_match),
        local_match: Boolean(event.local_match),
      }));

      const { error } = await supabase
        .from('search_ranking_analytics')
        .insert(validEvents);

      if (error) {
        console.error('Error inserting search ranking analytics:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to track analytics' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (type === 'sponsored') {
      // Validate and sanitize sponsored events
      const validEvents = events.map((event: SponsoredEvent) => ({
        merchant_id: event.merchant_id,
        event_type: ['impression', 'click', 'conversion'].includes(event.event_type) ? event.event_type : 'impression',
        source_page: event.source_page?.slice(0, 50) || 'unknown',
        user_id: userId,
        session_id: event.session_id?.slice(0, 100) || 'unknown',
        search_query: event.search_query?.slice(0, 200) || null,
        position: typeof event.position === 'number' ? Math.min(Math.max(event.position, 1), 1000) : null,
        device_type: event.device_type?.slice(0, 20) || 'unknown',
      }));

      const { error } = await supabase
        .from('sponsored_placement_analytics')
        .insert(validEvents);

      if (error) {
        console.error('Error inserting sponsored analytics:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to track analytics' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid analytics type. Use "search_ranking" or "sponsored"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully tracked ${events.length} ${type} analytics events`);

    return new Response(
      JSON.stringify({ success: true, tracked: events.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in track-analytics function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

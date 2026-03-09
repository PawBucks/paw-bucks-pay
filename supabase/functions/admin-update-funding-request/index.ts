import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const updateFundingSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['pending', 'in_review', 'approved', 'denied']),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Check if user is admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const requestBody = await req.json();
    const validationResult = updateFundingSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: validationResult.error.errors[0]?.message || 'Invalid input' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { requestId, status } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('funding_requests')
      .update({ status })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Database error updating funding request:', requestId, error);
      throw new Error('Failed to update funding request. Please try again.');
    }

    console.log('Funding request updated by admin:', user.id, requestId, status);

    return new Response(
      JSON.stringify({ success: true, funding_request: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error updating funding request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update funding request';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

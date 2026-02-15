import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is used for initial setup only - creates the first superadmin
// In-memory rate limiting for setup key attempts (5 attempts per hour globally)
const setupAttempts: { count: number; resetTime: number } = { count: 0, resetTime: 0 };
const SETUP_RATE_LIMIT = 5;
const SETUP_RATE_WINDOW = 3600000; // 1 hour in ms

function isSetupRateLimited(): boolean {
  const now = Date.now();
  if (now > setupAttempts.resetTime) {
    setupAttempts.count = 1;
    setupAttempts.resetTime = now + SETUP_RATE_WINDOW;
    return false;
  }
  if (setupAttempts.count >= SETUP_RATE_LIMIT) {
    return true;
  }
  setupAttempts.count++;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, full_name, setup_key } = await req.json();

    if (!email || !password || !full_name) {
      throw new Error('Email, password, and full_name are required');
    }

    // Check if any superadmin already exists
    const { data: existingSuperadmins } = await supabase
      .from('user_roles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1);

    if (existingSuperadmins && existingSuperadmins.length > 0) {
      // Require auth from existing superadmin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Authorization required: SuperAdmin already exists');
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Check if requester is superadmin
      const { data: requesterRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'superadmin');

      if (!requesterRoles || requesterRoles.length === 0) {
        throw new Error('Only existing SuperAdmins can create new SuperAdmins');
      }
    } else {
      // First superadmin setup - enforce rate limiting
      if (isSetupRateLimited()) {
        console.warn('Rate limit exceeded for superadmin setup attempts');
        // Log the rate-limited attempt
        await supabase.from('auth_security_events').insert({
          event_type: 'superadmin_setup_rate_limited',
          success: false,
          failure_reason: 'Rate limit exceeded',
          email: email || null,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        });
        return new Response(
          JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' } }
        );
      }

      const SETUP_KEY = Deno.env.get('INITIAL_SUPERADMIN_SETUP_KEY');
      if (!SETUP_KEY) {
        throw new Error('Setup key not configured on server');
      }
      if (setup_key !== SETUP_KEY) {
        // Log failed attempt
        await supabase.from('auth_security_events').insert({
          event_type: 'superadmin_setup_failed',
          success: false,
          failure_reason: 'Invalid setup key',
          email: email || null,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        });
        throw new Error('Invalid setup key for initial SuperAdmin creation');
      }

      // Log successful setup key usage
      await supabase.from('auth_security_events').insert({
        event_type: 'superadmin_setup_initiated',
        success: true,
        email: email || null,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      });
    }

    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        user_type: 'pet_owner',
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    console.log('Created user:', authData.user.id);

    // Assign superadmin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'superadmin' });

    if (roleError) {
      console.error('Error assigning superadmin role:', roleError);
      throw new Error(`Failed to assign superadmin role: ${roleError.message}`);
    }

    console.log('Assigned superadmin role to:', authData.user.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'SuperAdmin created successfully',
        user_id: authData.user.id,
        email: authData.user.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error creating superadmin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

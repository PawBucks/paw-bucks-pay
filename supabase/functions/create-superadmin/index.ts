import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is used for initial setup only - creates the first superadmin
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
      // First superadmin setup - require setup key for security
      if (setup_key !== 'PAWBUCKS_INITIAL_SETUP_2024') {
        throw new Error('Invalid setup key for initial SuperAdmin creation');
      }
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

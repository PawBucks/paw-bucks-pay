import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create client with user's token to verify admin status
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and is an admin
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      throw new Error('Unauthorized: Invalid user session');
    }

    // Check if user is admin or superadmin
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'superadmin');
    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    // Parse request body
    const { email, password, full_name, user_type } = await req.json();

    if (!email || !password || !full_name || !user_type) {
      throw new Error('Missing required fields: email, password, full_name, user_type');
    }

    // Create service role client to create user without affecting admin session
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create the new user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name,
        user_type
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw new Error(createError.message);
    }

    console.log(`[Admin Create User] User ${email} created by admin ${requestingUser.email}`);

    // Log the admin action
    await serviceClient
      .from('audit_logs')
      .insert({
        admin_id: requestingUser.id,
        action: 'create_user',
        entity_type: 'user',
        entity_id: newUser.user?.id,
        changes: { email, full_name, user_type }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser.user,
        message: 'User created successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Admin create user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating the user';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

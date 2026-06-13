import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  user_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin or superadmin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles || !roles.some(r => r.role === 'admin' || r.role === 'superadmin')) {
      throw new Error('Unauthorized: Admin access required');
    }

    console.log('Admin user verified:', user.id);

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    // Prevent deleting yourself
    if (validatedData.user_id === user.id) {
      throw new Error('Cannot delete your own account');
    }

    console.log('Deleting user:', validatedData.user_id);

    // Delete user using admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      validatedData.user_id
    );

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw new Error('Failed to delete user');
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      _action: 'DELETE_USER',
      _entity_type: 'user',
      _entity_id: validatedData.user_id,
      _changes: { deleted_by: user.id },
    });

    console.log('User deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully',
        user_id: validatedData.user_id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in admin-delete-user function:', error);
    const safeMessages = new Set([
      'Missing authorization header',
      'Unauthorized',
      'Unauthorized: Admin access required',
      'Cannot delete your own account',
      'Failed to delete user',
    ]);
    const rawMessage = error instanceof Error ? error.message : '';
    const errorMessage = safeMessages.has(rawMessage) ? rawMessage : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

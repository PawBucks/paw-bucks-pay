import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  user_id: z.string().uuid(),
  user_type: z.enum(['pet_owner', 'merchant']).optional(),
  role: z.enum(['admin', 'moderator', 'user']).optional(),
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

    // Verify admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles || !roles.some(r => r.role === 'admin')) {
      throw new Error('Unauthorized: Admin access required');
    }

    console.log('Admin user verified:', user.id);

    // Parse and validate request body
    const body = await req.json();
    const validatedData = requestSchema.parse(body);

    console.log('Updating user:', validatedData.user_id);

    // Update user_type in profiles if provided
    if (validatedData.user_type) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ user_type: validatedData.user_type })
        .eq('id', validatedData.user_id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw new Error(`Failed to update user type: ${profileError.message}`);
      }

      console.log('Updated user_type to:', validatedData.user_type);
    }

    // Update role in user_roles if provided
    if (validatedData.role) {
      // First, check if user has any role
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', validatedData.user_id);

      if (existingRoles && existingRoles.length > 0) {
        // Update existing role
        const { error: roleUpdateError } = await supabase
          .from('user_roles')
          .update({ role: validatedData.role })
          .eq('user_id', validatedData.user_id);

        if (roleUpdateError) {
          console.error('Error updating role:', roleUpdateError);
          throw new Error(`Failed to update role: ${roleUpdateError.message}`);
        }
      } else {
        // Insert new role
        const { error: roleInsertError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: validatedData.user_id, 
            role: validatedData.role 
          });

        if (roleInsertError) {
          console.error('Error inserting role:', roleInsertError);
          throw new Error(`Failed to insert role: ${roleInsertError.message}`);
        }
      }

      console.log('Updated role to:', validatedData.role);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User updated successfully',
        user_id: validatedData.user_id,
        updated_fields: {
          user_type: validatedData.user_type,
          role: validatedData.role,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in admin-update-user-role function:', error);
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

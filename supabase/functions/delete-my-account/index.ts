import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    // Block admins/superadmins from self-deleting via this route (must use admin tooling)
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roles && roles.some((r: { role: string }) => r.role === 'admin' || r.role === 'superadmin')) {
      throw new Error('Admin accounts cannot be self-deleted. Contact support.');
    }

    console.log('Self-delete requested by user:', user.id);

    // Anonymize profile so transactions / financial records keep FK integrity
    // (transactions.user_id FK has no CASCADE — row remains, just unlinked from a real identity)
    const anonEmail = `deleted-${user.id}@deleted.pawbucks.app`;
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        email: anonEmail,
        normalized_email: anonEmail,
        full_name: 'Deleted User',
        phone: null,
        avatar_url: null,
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: 'Account deleted by user',
      })
      .eq('id', user.id);

    if (profileErr) {
      console.error('Profile anonymization failed:', profileErr);
      // Non-fatal: continue to auth deletion
    }

    // Delete auth identity. Transactions remain (FK has no CASCADE).
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('Auth delete failed:', deleteError);
      throw new Error(`Failed to delete account: ${deleteError.message}`);
    }

    console.log('Self-delete completed for user:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in delete-my-account:', error);
    const msg = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
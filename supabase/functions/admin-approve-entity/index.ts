import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const approveEntitySchema = z.object({
  entityType: z.enum(['merchant', 'vet']),
  entityId: z.string().uuid(),
  action: z.enum(['approve', 'deny']),
  denialReason: z.string().max(500).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify admin/superadmin role
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'superadmin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse and validate request
    const rawBody = await req.json();
    const validationResult = approveEntitySchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { entityType, entityId, action, denialReason } = validationResult.data;

    // Service client for updates
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const tableName = entityType === 'merchant' ? 'merchants' : 'partner_vets';
    const newStatus = action === 'approve' ? 'approved' : 'denied';

    // Build update object
    const updateData: Record<string, any> = {
      approval_status: newStatus,
    };

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user.id;
      updateData.denial_reason = null;
    } else {
      updateData.denial_reason = denialReason || 'No reason provided';
      updateData.approved_at = null;
      updateData.approved_by = null;
    }

    // Update the entity
    const { error: updateError } = await serviceClient
      .from(tableName)
      .update(updateData)
      .eq('id', entityId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update entity status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get entity details for notification
    let entityName = '';
    let entityUserId = '';
    
    if (entityType === 'merchant') {
      const { data: merchant } = await serviceClient
        .from('merchants')
        .select('business_name, user_id')
        .eq('id', entityId)
        .single();
      entityName = merchant?.business_name || 'Unknown Merchant';
      entityUserId = merchant?.user_id;
    } else {
      const { data: vet } = await serviceClient
        .from('partner_vets')
        .select('name, clinic_name, user_id')
        .eq('id', entityId)
        .single();
      entityName = vet?.clinic_name || vet?.name || 'Unknown Vet';
      entityUserId = vet?.user_id;
    }

    // Send notification to the entity owner
    if (entityUserId) {
      const notificationTitle = action === 'approve' 
        ? `${entityType === 'merchant' ? 'Merchant' : 'Vet'} Account Approved!`
        : `${entityType === 'merchant' ? 'Merchant' : 'Vet'} Application Status`;
      
      const notificationMessage = action === 'approve'
        ? `Congratulations! Your ${entityType === 'merchant' ? 'merchant' : 'veterinary practice'} "${entityName}" has been approved. You now have full access to all platform features.`
        : `Your application for "${entityName}" has been reviewed. Please contact support for more information.`;

      await serviceClient
        .from('notifications')
        .insert({
          user_id: entityUserId,
          title: notificationTitle,
          message: notificationMessage,
          category: 'transactional',
        });
    }

    // Log the admin action
    await serviceClient
      .from('audit_logs')
      .insert({
        admin_id: user.id,
        action: `${action.toUpperCase()}_${entityType.toUpperCase()}`,
        entity_type: entityType,
        entity_id: entityId,
        changes: {
          new_status: newStatus,
          entity_name: entityName,
          denial_reason: action === 'deny' ? denialReason : null,
        },
      });

    console.log(`[Admin Approve] ${action} ${entityType} ${entityId} by admin ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${entityType} ${action === 'approve' ? 'approved' : 'denied'} successfully`,
        entityName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Admin approve entity error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

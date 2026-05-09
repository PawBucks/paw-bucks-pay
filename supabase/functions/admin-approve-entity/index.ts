import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const APP_URL = "https://pawbucks.app";

function buildApprovalEmailHtml(params: {
  entityName: string;
  entityType: 'merchant' | 'vet';
  action: 'approve' | 'deny';
  denialReason?: string;
}) {
  const { entityName, entityType, action, denialReason } = params;
  const entityLabel = entityType === 'merchant' ? 'Merchant' : 'Veterinary Practice';
  const dashboardUrl = entityType === 'merchant' ? `${APP_URL}/merchant-dashboard` : `${APP_URL}/vet-dashboard`;

  if (action === 'approve') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Account Approved</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="background:linear-gradient(135deg,#2da89a 0%,#1f7a70 100%);padding:32px;text-align:center;">
          <img src="https://pawbucks.app/lovable-uploads/pawbucks-logo.png" alt="PawBucks" style="height:48px;display:inline-block;" />
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h1 style="margin:0 0 16px;font-size:26px;color:#1a1a1a;">🎉 You're Approved!</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#333;">
            Congratulations! Your ${entityLabel.toLowerCase()} account for <strong>${entityName}</strong> has been approved by the PawBucks team.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#333;">
            You now have full access to all platform features — start accepting payments, earning rewards for your customers, and growing your business.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#2da89a;border-radius:8px;">
            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">Go to Dashboard</a>
          </td></tr></table>
          <p style="font-size:14px;line-height:1.6;color:#666;margin:24px 0 0;">
            Need help getting started? Visit your dashboard to set up your storefront, products, and services.
          </p>
        </td></tr>
        <tr><td style="background:#f5f7fa;padding:24px 32px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} PawBucks. All rights reserved.<br/>
          <a href="${APP_URL}" style="color:#2da89a;text-decoration:none;">pawbucks.app</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Application Update</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="background:linear-gradient(135deg,#2da89a 0%,#1f7a70 100%);padding:32px;text-align:center;">
          <img src="https://pawbucks.app/lovable-uploads/pawbucks-logo.png" alt="PawBucks" style="height:48px;display:inline-block;" />
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Application Update</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#333;">
            Thank you for your interest in joining PawBucks. After careful review, we're unable to approve your ${entityLabel.toLowerCase()} application for <strong>${entityName}</strong> at this time.
          </p>
          ${denialReason ? `<div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:16px;margin:20px 0;border-radius:4px;">
            <p style="margin:0;font-size:14px;color:#5a4a1a;"><strong>Reason:</strong> ${denialReason}</p>
          </div>` : ''}
          <p style="font-size:16px;line-height:1.6;margin:16px 0 0;color:#333;">
            If you have questions or would like to discuss this decision, please contact our support team at <a href="mailto:support@pawbucks.app" style="color:#2da89a;">support@pawbucks.app</a>.
          </p>
        </td></tr>
        <tr><td style="background:#f5f7fa;padding:24px 32px;text-align:center;font-size:12px;color:#888;">
          © ${new Date().getFullYear()} PawBucks. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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
      console.error('[Admin Approve] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update entity status: ${updateError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get entity details for notification
    let entityName = '';
    let entityUserId = '';
    let entityEmail = '';
    
    if (entityType === 'merchant') {
      const { data: merchant } = await serviceClient
        .from('merchants')
        .select('business_name, user_id, email')
        .eq('id', entityId)
        .single();
      entityName = merchant?.business_name || 'Unknown Merchant';
      entityUserId = merchant?.user_id;
      entityEmail = merchant?.email || '';
    } else {
      const { data: vet } = await serviceClient
        .from('partner_vets')
        .select('name, clinic_name, user_id, contact_email')
        .eq('id', entityId)
        .single();
      entityName = vet?.clinic_name || vet?.name || 'Unknown Vet';
      entityUserId = vet?.user_id;
      entityEmail = vet?.contact_email || '';
    }

    // Fall back to auth user email if entity record has no email
    if (!entityEmail && entityUserId) {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(entityUserId);
      entityEmail = authUser?.user?.email || '';
    }

    // Send in-app notification to the entity owner
    if (entityUserId) {
      const notificationTitle = action === 'approve' 
        ? `${entityType === 'merchant' ? 'Merchant' : 'Vet'} Account Approved!`
        : `${entityType === 'merchant' ? 'Merchant' : 'Vet'} Application Status`;
      
      const notificationMessage = action === 'approve'
        ? `Congratulations! Your ${entityType === 'merchant' ? 'merchant' : 'veterinary practice'} "${entityName}" has been approved. You now have full access to all platform features.`
        : `Your application for "${entityName}" has been reviewed. Please contact support for more information.`;

      try {
        const { error: notifErr } = await serviceClient
          .from('notifications')
          .insert({
            user_id: entityUserId,
            title: notificationTitle,
            message: notificationMessage,
            category: 'transactional',
            link_url: action === 'approve'
              ? (entityType === 'merchant' ? '/merchant-dashboard' : '/vet-dashboard')
              : null,
          });
        if (notifErr) console.error('[Admin Approve] Owner notification error:', notifErr);
      } catch (e) {
        console.error('[Admin Approve] Owner notification exception:', e);
      }
    }

    // Send branded email notification
    if (entityEmail) {
      try {
        const subject = action === 'approve'
          ? `🎉 Your PawBucks ${entityType === 'merchant' ? 'Merchant' : 'Vet'} Account is Approved!`
          : `Update on your PawBucks ${entityType === 'merchant' ? 'Merchant' : 'Vet'} Application`;

        const { error: emailError } = await resend.emails.send({
          from: 'PawBucks <noreply@pawbucks.app>',
          to: [entityEmail],
          subject,
          html: buildApprovalEmailHtml({ entityName, entityType, action, denialReason }),
        });

        if (emailError) {
          console.error('[Admin Approve] Email send error:', emailError);
        } else {
          console.log(`[Admin Approve] ${action} email sent to ${entityEmail}`);
        }
      } catch (emailErr) {
        console.error('[Admin Approve] Email exception:', emailErr);
      }
    } else {
      console.warn(`[Admin Approve] No email found for ${entityType} ${entityId} — skipping email`);
    }

    // Notify all pet owners about the new approved merchant/vet
    if (action === 'approve') {
      // Get merchant slug or vet id for the profile link
      let profilePath = '';
      if (entityType === 'merchant') {
        const { data: merchantSlug } = await serviceClient
          .from('merchants')
          .select('storefront_slug')
          .eq('id', entityId)
          .single();
        profilePath = merchantSlug?.storefront_slug 
          ? `/storefront/${merchantSlug.storefront_slug}` 
          : `/merchant/${entityId}`;
      } else {
        profilePath = `/vet/${entityId}`;
      }

      // Get all user IDs that are NOT merchants or vets (i.e. pet owners)
      const { data: allProfiles } = await serviceClient
        .from('profiles')
        .select('id');

      const { data: merchantUserIds } = await serviceClient
        .from('merchants')
        .select('user_id');

      const { data: vetUserIds } = await serviceClient
        .from('partner_vets')
        .select('user_id');

      const excludeIds = new Set([
        ...(merchantUserIds?.map(m => m.user_id) || []),
        ...(vetUserIds?.map(v => v.user_id) || []),
        entityUserId, // already notified above
      ]);

      const petOwnerIds = (allProfiles || [])
        .map(p => p.id)
        .filter(id => !excludeIds.has(id));

      if (petOwnerIds.length > 0) {
        const entityLabel = entityType === 'merchant' ? 'merchant' : 'vet';
        const notifications = petOwnerIds.map(userId => ({
          user_id: userId,
          title: `🎉 New ${entityLabel} just joined PawBucks!`,
          message: `Check out "${entityName}" — now available on PawBucks! Visit their profile to explore their services and start earning rewards. [View Profile](${profilePath})`,
          category: 'promotional',
        }));

        // Insert in batches of 500 to avoid payload limits — never fail the approval
        try {
          for (let i = 0; i < notifications.length; i += 500) {
            const { error: batchErr } = await serviceClient
              .from('notifications')
              .insert(notifications.slice(i, i + 500));
            if (batchErr) console.error('[Admin Approve] Pet owner batch error:', batchErr);
          }
          console.log(`[Admin Approve] Sent new ${entityLabel} notifications to ${petOwnerIds.length} pet owners`);
        } catch (e) {
          console.error('[Admin Approve] Pet owner notifications exception:', e);
        }
      }
    }

    // Log the admin action — never fail the approval if audit insert fails
    try {
      const { error: auditErr } = await serviceClient
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
      if (auditErr) console.error('[Admin Approve] Audit log error:', auditErr);
    } catch (e) {
      console.error('[Admin Approve] Audit log exception:', e);
    }

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
    console.error('[Admin Approve] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

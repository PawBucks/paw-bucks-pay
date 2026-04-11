import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const updateFundingSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['pending', 'in_review', 'approved', 'denied', 'funded']),
  entityType: z.enum(['merchant', 'vet']).default('merchant'),
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
      .in('role', ['admin', 'superadmin'])
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

    const { requestId, status, entityType } = validationResult.data;

    // Determine which table to update based on entity type
    const tableName = entityType === 'vet' ? 'vet_loans' : 'funding_requests';

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .update({ status })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Database error updating funding request:', requestId, error);
      throw new Error('Failed to update funding request. Please try again.');
    }

    // Send notification to the entity owner
    let recipientUserId: string | null = null;
    let entityName = '';

    if (entityType === 'merchant') {
      // Get merchant user_id via the merchant_id on the funding request
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('user_id, business_name')
        .eq('id', data.merchant_id)
        .single();
      recipientUserId = merchant?.user_id ?? null;
      entityName = merchant?.business_name ?? 'your business';
    } else {
      // vet_loans has a user_id directly
      recipientUserId = data.user_id ?? null;
      // Try to get vet name
      const { data: vet } = await supabaseAdmin
        .from('partner_vets')
        .select('clinic_name, name')
        .eq('id', data.vet_id)
        .single();
      entityName = vet?.clinic_name ?? vet?.name ?? 'your practice';
    }

    if (recipientUserId && (status === 'approved' || status === 'denied' || status === 'funded')) {
      const isApproved = status === 'approved';
      const isFunded = status === 'funded';
      const amount = data.requested_amount
        ? `$${Number(data.requested_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : 'your requested amount';

      const notificationTitle = isFunded
        ? '💰 Funds Disbursed!'
        : isApproved
          ? '🎉 Funding Request Approved!'
          : 'Funding Request Update';

      const notificationMessage = isFunded
        ? `Great news! Your funding of ${amount} for ${entityName} has been disbursed. Check your account for the deposited funds.`
        : isApproved
          ? `Great news! Your funding request of ${amount} for ${entityName} has been approved. Funds will be disbursed shortly.`
          : `Your funding request of ${amount} for ${entityName} was not approved at this time. Please contact support for more details.`;

      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: recipientUserId,
          title: notificationTitle,
          message: notificationMessage,
          category: 'transactional',
        });

      console.log(`Notification sent to ${recipientUserId} for ${status} funding request ${requestId}`);
    }

    // Log admin action
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        admin_id: user.id,
        action: `UPDATE_FUNDING_${status.toUpperCase()}`,
        entity_type: entityType === 'vet' ? 'vet_loan' : 'funding_request',
        entity_id: requestId,
        changes: { new_status: status, entity_name: entityName },
      });

    console.log('Funding request updated by admin:', user.id, requestId, status, entityType);

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
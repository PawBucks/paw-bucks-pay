import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ROTATE-AD-SLOTS] ${step}`, details ? JSON.stringify(details) : '');
};

/**
 * Weekly rotation logic for oversubscribed Premium Ad Placement slots.
 * 
 * For each geo_cell × service × category that has a waitlist:
 * 1. Find active slot reservations whose rotation week has elapsed
 * 2. Deactivate them and move the merchant to the back of the waitlist
 * 3. Activate the next merchant(s) in line from the waitlist
 * 4. Create new slot reservations for the newly activated merchants
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  try {
    logStep('Rotation started');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all distinct cell × service × category combos that have waitlisted merchants
    const { data: waitlistGroups, error: groupError } = await supabaseAdmin
      .from('geo_cell_waitlist')
      .select('geo_cell_id, service_id, business_category')
      .eq('status', 'waiting')
      .order('geo_cell_id');

    if (groupError) throw new Error(`Failed to fetch waitlist groups: ${groupError.message}`);

    if (!waitlistGroups || waitlistGroups.length === 0) {
      logStep('No waitlisted merchants found, nothing to rotate');
      return new Response(
        JSON.stringify({ success: true, rotated: 0, message: 'No waitlist entries to rotate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate groups
    const uniqueGroups = new Map<string, { geo_cell_id: string; service_id: string; business_category: string }>();
    for (const g of waitlistGroups) {
      const key = `${g.geo_cell_id}|${g.service_id}|${g.business_category}`;
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, g);
      }
    }

    let totalRotated = 0;
    let totalActivated = 0;
    const rotationResults: Array<{ cell: string; category: string; deactivated: number; activated: number }> = [];

    for (const [, group] of uniqueGroups) {
      const { geo_cell_id, service_id, business_category } = group;

      logStep('Processing rotation group', { geo_cell_id, service_id, business_category });

      // Get the service limit for this combo
      const { data: limitData } = await supabaseAdmin
        .from('geo_cell_service_limits')
        .select('max_slots, time_window_days')
        .eq('geo_cell_id', geo_cell_id)
        .eq('service_id', service_id)
        .eq('business_category', business_category)
        .eq('is_active', true)
        .single();

      if (!limitData) {
        logStep('No limit config found, skipping', { geo_cell_id, business_category });
        continue;
      }

      // Find active reservations for this combo that have been active for >= 7 days (1 rotation week)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: activeReservations } = await supabaseAdmin
        .from('geo_cell_slot_reservations')
        .select('id, merchant_id, waitlist_id, created_at')
        .eq('geo_cell_id', geo_cell_id)
        .eq('service_id', service_id)
        .eq('business_category', business_category)
        .eq('is_active', true)
        .lte('created_at', oneWeekAgo);

      if (!activeReservations || activeReservations.length === 0) {
        logStep('No reservations due for rotation', { geo_cell_id, business_category });
        continue;
      }

      // Deactivate expired rotation slots
      let deactivatedCount = 0;
      for (const reservation of activeReservations) {
        // Deactivate the reservation
        await supabaseAdmin
          .from('geo_cell_slot_reservations')
          .update({ is_active: false })
          .eq('id', reservation.id);

        // If merchant has a waitlist entry, move them to back of queue
        if (reservation.waitlist_id) {
          // Get max position for re-queuing
          const { data: maxPos } = await supabaseAdmin
            .from('geo_cell_waitlist')
            .select('position')
            .eq('geo_cell_id', geo_cell_id)
            .eq('service_id', service_id)
            .eq('business_category', business_category)
            .order('position', { ascending: false })
            .limit(1)
            .single();

          const newPosition = (maxPos?.position || 0) + 1;

          await supabaseAdmin
            .from('geo_cell_waitlist')
            .update({
              status: 'waiting',
              position: newPosition,
              deactivated_at: new Date().toISOString(),
              rotation_window_end: new Date().toISOString(),
            })
            .eq('id', reservation.waitlist_id);
        }

        deactivatedCount++;
      }

      logStep('Deactivated rotation slots', { deactivatedCount, geo_cell_id, business_category });

      // Count current active slots remaining
      const { count: remainingActive } = await supabaseAdmin
        .from('geo_cell_slot_reservations')
        .select('id', { count: 'exact', head: true })
        .eq('geo_cell_id', geo_cell_id)
        .eq('service_id', service_id)
        .eq('business_category', business_category)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const slotsToFill = limitData.max_slots - (remainingActive || 0);

      if (slotsToFill <= 0) {
        logStep('No open slots to fill after rotation', { geo_cell_id, business_category });
        totalRotated += deactivatedCount;
        rotationResults.push({ cell: geo_cell_id, category: business_category, deactivated: deactivatedCount, activated: 0 });
        continue;
      }

      // Get next merchants from waitlist
      const { data: nextInLine } = await supabaseAdmin
        .from('geo_cell_waitlist')
        .select('id, merchant_id, purchase_id')
        .eq('geo_cell_id', geo_cell_id)
        .eq('service_id', service_id)
        .eq('business_category', business_category)
        .eq('status', 'waiting')
        .order('position', { ascending: true })
        .limit(slotsToFill);

      let activatedCount = 0;
      const rotationWindowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const slotExpiry = new Date(Date.now() + limitData.time_window_days * 24 * 60 * 60 * 1000).toISOString();

      for (const entry of (nextInLine || [])) {
        // Create a new slot reservation
        const { error: insertError } = await supabaseAdmin
          .from('geo_cell_slot_reservations')
          .insert({
            geo_cell_id,
            service_id,
            merchant_id: entry.merchant_id,
            purchase_id: entry.purchase_id,
            business_category,
            is_active: true,
            expires_at: slotExpiry,
            waitlist_id: entry.id,
          });

        if (insertError) {
          logStep('Failed to create slot for waitlisted merchant', { error: insertError.message, merchantId: entry.merchant_id });
          continue;
        }

        // Update waitlist entry to active
        await supabaseAdmin
          .from('geo_cell_waitlist')
          .update({
            status: 'active',
            activated_at: new Date().toISOString(),
            rotation_window_start: new Date().toISOString(),
            rotation_window_end: rotationWindowEnd,
          })
          .eq('id', entry.id);

        // Notify the merchant
        const { data: merchantData } = await supabaseAdmin
          .from('merchants')
          .select('user_id, business_name')
          .eq('id', entry.merchant_id)
          .single();

        if (merchantData) {
          await supabaseAdmin.from('notifications').insert({
            user_id: merchantData.user_id,
            title: '🎯 Your Premium Ad Slot is Live!',
            message: `Your Premium Ad Placement for ${merchantData.business_name} is now active in your zone for this week. Make the most of your visibility!`,
            category: 'transactional',
          });
        }

        activatedCount++;
      }

      logStep('Activated waitlisted merchants', { activatedCount, geo_cell_id, business_category });

      totalRotated += deactivatedCount;
      totalActivated += activatedCount;
      rotationResults.push({
        cell: geo_cell_id,
        category: business_category,
        deactivated: deactivatedCount,
        activated: activatedCount,
      });
    }

    logStep('Rotation complete', { totalRotated, totalActivated, groups: rotationResults.length });

    return new Response(
      JSON.stringify({
        success: true,
        totalRotated,
        totalActivated,
        results: rotationResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Rotation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Rotation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

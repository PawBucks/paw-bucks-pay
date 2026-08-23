import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({ token: z.string().trim().uuid() });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const logEvent = async (
    reservationId: string | null,
    eventType: "claim_granted" | "claim_rejected" | "claim_expired",
    email: string | null,
    userId: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    await admin.from("petfest_bonus_events").insert({
      reservation_id: reservationId,
      event_type: eventType,
      email,
      user_id: userId,
      metadata,
    });
  };

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ success: false, reason: "invalid_token" }, 400);
    const { token } = parsed.data;

    // Require an authenticated user — the bonus lands in their wallet.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, reason: "not_authenticated" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ success: false, reason: "not_authenticated" }, 401);

    // Flip anything past its window before evaluating this claim.
    await admin.rpc("expire_petfest_bonus_reservations");

    const { data: reservation } = await admin
      .from("petfest_bonus_reservations")
      .select("id, email, status, expires_at, pawbucks_amount, claimed_user_id")
      .eq("token", token)
      .maybeSingle();

    if (!reservation) {
      await logEvent(null, "claim_rejected", user.email ?? null, user.id, { reason: "not_found" });
      return json({ success: false, reason: "not_found" });
    }

    if (reservation.status === "claimed") {
      const alreadyMine = reservation.claimed_user_id === user.id;
      return json({
        success: alreadyMine,
        alreadyClaimed: true,
        reason: alreadyMine ? "already_granted" : "claimed_by_other",
        amount: reservation.pawbucks_amount,
      });
    }

    if (reservation.status === "expired" || new Date(reservation.expires_at).getTime() <= Date.now()) {
      await logEvent(reservation.id, "claim_expired", reservation.email, user.id, { reason: "window_elapsed" });
      return json({ success: false, reason: "expired", expiresAt: reservation.expires_at });
    }

    // The account must match the RSVP email so the bonus can't be traded around.
    const userEmail = (user.email ?? "").toLowerCase();
    if (!userEmail || userEmail !== reservation.email.toLowerCase()) {
      await logEvent(reservation.id, "claim_rejected", reservation.email, user.id, { reason: "email_mismatch" });
      return json({ success: false, reason: "email_mismatch" });
    }

    // One PetFest bonus per account.
    const { data: existing } = await admin
      .from("petfest_bonus_reservations")
      .select("id")
      .eq("claimed_user_id", user.id)
      .eq("status", "claimed")
      .limit(1);
    if (existing && existing.length > 0) {
      await logEvent(reservation.id, "claim_rejected", reservation.email, user.id, { reason: "already_claimed_by_account" });
      return json({ success: false, reason: "already_claimed_by_account" });
    }

    // Atomically take the reservation (guards against double-claim races).
    const { data: taken, error: takeError } = await admin
      .from("petfest_bonus_reservations")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
        claimed_user_id: user.id,
      })
      .eq("id", reservation.id)
      .eq("status", "reserved")
      .select("id, pawbucks_amount, email")
      .maybeSingle();

    if (takeError || !taken) {
      await logEvent(reservation.id, "claim_rejected", reservation.email, user.id, { reason: "race_lost" });
      return json({ success: false, reason: "unavailable" });
    }

    // Promotional PawBucks: campaign source is exempt from the 60-day expiry.
    const { error: creditError } = await admin.from("pawbucks_activity").insert({
      user_id: user.id,
      type: "earn",
      amount: taken.pawbucks_amount,
      source: "campaign",
      pawbucks_status: "available",
      description: "PetFest 2027 sign-up bonus",
    });

    if (creditError) {
      console.error("petfest-bonus-claim credit error:", creditError);
      // Release the reservation so the user can retry inside the window.
      await admin
        .from("petfest_bonus_reservations")
        .update({ status: "reserved", claimed_at: null, claimed_user_id: null })
        .eq("id", taken.id);
      await logEvent(taken.id, "claim_rejected", taken.email, user.id, { reason: "credit_failed" });
      return json({ success: false, reason: "credit_failed" }, 500);
    }

    await logEvent(taken.id, "claim_granted", taken.email, user.id, { amount: taken.pawbucks_amount });

    return json({ success: true, amount: taken.pawbucks_amount });
  } catch (err) {
    console.error("petfest-bonus-claim error:", err);
    return json({ success: false, reason: "unexpected" }, 500);
  }
});

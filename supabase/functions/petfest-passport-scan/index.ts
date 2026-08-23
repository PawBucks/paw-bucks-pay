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

const BodySchema = z.union([
  z.object({
    action: z.literal("scan").default("scan"),
    qrToken: z.string().trim().uuid(),
  }),
  z.object({
    action: z.literal("manual_award"),
    boothId: z.string().trim().uuid(),
    email: z.string().trim().email(),
  }),
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
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
    const caller = userData.user;
    if (!caller) return json({ success: false, reason: "not_authenticated" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ success: false, reason: "invalid_request" }, 400);
    const body = parsed.data;

    const { data: settings } = await admin
      .from("petfest_passport_settings")
      .select("event_label, required_stamps, completion_bonus_pawbucks, is_live")
      .eq("id", true)
      .maybeSingle();

    const requiredStamps = settings?.required_stamps ?? 6;
    const completionBonus = settings?.completion_bonus_pawbucks ?? 0;

    // Resolve the booth + the attendee this stamp belongs to.
    let boothId: string;
    let targetUserId: string;

    if (body.action === "manual_award") {
      // Paper passports are turned in at PawBucks HQ — admins credit them by email.
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      const { data: isSuper } = await admin.rpc("has_role", { _user_id: caller.id, _role: "superadmin" });
      if (!isAdmin && !isSuper) return json({ success: false, reason: "not_authorized" }, 403);

      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", body.email)
        .maybeSingle();
      if (!profile) return json({ success: false, reason: "user_not_found" }, 404);

      boothId = body.boothId;
      targetUserId = profile.id;
    } else {
      if (settings && settings.is_live === false) {
        return json({ success: false, reason: "passport_not_live" });
      }
      const { data: booth } = await admin
        .from("petfest_passport_booths")
        .select("id, is_active")
        .eq("qr_token", body.qrToken)
        .maybeSingle();
      if (!booth) return json({ success: false, reason: "invalid_code" }, 404);
      if (!booth.is_active) return json({ success: false, reason: "booth_inactive" });

      boothId = booth.id;
      targetUserId = caller.id;
    }

    const { data: booth } = await admin
      .from("petfest_passport_booths")
      .select("id, name, booth_number, sponsor_name, pawbucks_reward, is_active")
      .eq("id", boothId)
      .maybeSingle();
    if (!booth) return json({ success: false, reason: "invalid_code" }, 404);

    const buildState = async (extra: Record<string, unknown>) => {
      const { count } = await admin
        .from("petfest_passport_stamps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId);
      const { data: completion } = await admin
        .from("petfest_passport_completions")
        .select("bonus_pawbucks, completed_at")
        .eq("user_id", targetUserId)
        .maybeSingle();
      return json({
        booth: { name: booth.name, booth_number: booth.booth_number, sponsor_name: booth.sponsor_name },
        stamps: count ?? 0,
        requiredStamps,
        completion: completion ?? null,
        eventLabel: settings?.event_label ?? "PetFest",
        ...extra,
      });
    };

    // Claim the stamp — the unique (user_id, booth_id) index makes this idempotent.
    const { data: stamp, error: stampError } = await admin
      .from("petfest_passport_stamps")
      .insert({
        user_id: targetUserId,
        booth_id: booth.id,
        pawbucks_awarded: booth.pawbucks_reward,
        source: body.action === "manual_award" ? "paper_passport" : "qr_scan",
      })
      .select("id")
      .maybeSingle();

    if (stampError) {
      if (stampError.code === "23505" || stampError.code === "23514" || /duplicate key/i.test(stampError.message)) {
        return await buildState({ success: true, alreadyStamped: true, awarded: 0 });
      }
      console.error("petfest-passport-scan stamp error:", stampError);
      return json({ success: false, reason: "stamp_failed" }, 500);
    }

    // Credit the per-stamp reward. Promotional source — exempt from the 60-day expiry.
    if (booth.pawbucks_reward > 0) {
      const { error: creditError } = await admin.from("pawbucks_activity").insert({
        user_id: targetUserId,
        type: "earn",
        amount: booth.pawbucks_reward,
        source: "campaign",
        pawbucks_status: "available",
        description: `PetFest Passport stamp — ${booth.name}`,
      });
      if (creditError) {
        console.error("petfest-passport-scan credit error:", creditError);
        await admin.from("petfest_passport_stamps").delete().eq("id", stamp?.id ?? "");
        return json({ success: false, reason: "credit_failed" }, 500);
      }
    }

    // Completion bonus once the required number of stamps is in.
    let bonusAwarded = 0;
    const { count: totalStamps } = await admin
      .from("petfest_passport_stamps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId);

    if ((totalStamps ?? 0) >= requiredStamps) {
      const { data: completed } = await admin
        .from("petfest_passport_completions")
        .insert({
          user_id: targetUserId,
          stamps_count: totalStamps ?? 0,
          bonus_pawbucks: completionBonus,
        })
        .select("id")
        .maybeSingle();

      if (completed && completionBonus > 0) {
        const { error: bonusError } = await admin.from("pawbucks_activity").insert({
          user_id: targetUserId,
          type: "earn",
          amount: completionBonus,
          source: "campaign",
          pawbucks_status: "available",
          description: `${settings?.event_label ?? "PetFest"} Passport completion bonus`,
        });
        if (bonusError) console.error("petfest-passport-scan bonus error:", bonusError);
        else bonusAwarded = completionBonus;
      }
    }

    // In-app confirmation so the stamp is visible outside the passport page too.
    await admin.from("notifications").insert({
      user_id: targetUserId,
      title: "PetFest Passport stamped!",
      message: bonusAwarded
        ? `${booth.name} stamped. You completed your passport and earned a ${bonusAwarded.toLocaleString()} PawBucks bonus.`
        : `${booth.name} stamped — ${booth.pawbucks_reward.toLocaleString()} PawBucks added to your wallet.`,
      type: "reward",
      link_url: "/petfest/passport",
    });

    return await buildState({
      success: true,
      alreadyStamped: false,
      awarded: booth.pawbucks_reward,
      bonusAwarded,
    });
  } catch (err) {
    console.error("petfest-passport-scan error:", err);
    return json({ success: false, reason: "unexpected" }, 500);
  }
});

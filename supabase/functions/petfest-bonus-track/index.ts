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

const BodySchema = z.object({
  token: z.string().trim().uuid().optional().nullable(),
  eventType: z.enum(["cta_click", "signup_started"]),
  email: z.string().trim().email().max(255).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

// Light in-memory rate limit per IP (resets on cold start).
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const limited = (ip: string) => {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_WINDOW;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(ip)) return json({ success: false, rateLimited: true });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid payload" }, 400);
    const { token, eventType, email, metadata } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let reservationId: string | null = null;
    let reservationEmail: string | null = email?.toLowerCase() ?? null;

    if (token) {
      const { data: reservation } = await supabase
        .from("petfest_bonus_reservations")
        .select("id, email")
        .eq("token", token)
        .maybeSingle();
      if (reservation) {
        reservationId = reservation.id;
        reservationEmail = reservation.email;
      }
    }

    // Optional signed-in attribution.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await anonClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const { error } = await supabase.from("petfest_bonus_events").insert({
      reservation_id: reservationId,
      event_type: eventType,
      email: reservationEmail,
      user_id: userId,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error("petfest-bonus-track insert error:", error);
      return json({ success: false }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("petfest-bonus-track error:", err);
    return json({ success: false }, 500);
  }
});

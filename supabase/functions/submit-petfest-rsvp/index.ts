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
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(20),
  petCount: z.coerce.number().int().min(1).max(20),
  petName: z.string().trim().min(1).max(50),
  petBreed: z.string().trim().max(50).optional().nullable(),
  petBirthday: z.string().trim().max(20).optional().nullable(),
  // Bot checks (never shown to real users)
  honeypot: z.string().max(200).optional().nullable(),
  elapsedMs: z.coerce.number().int().min(0).max(86_400_000).optional(),
});

// Simple heuristics for obviously scripted submissions.
const looksLikeSpam = (v: { fullName: string; petName: string; email: string; petBreed?: string | null }) => {
  const blob = `${v.fullName} ${v.petName} ${v.petBreed ?? ""}`;
  if (/https?:\/\/|<a\s|\[url|\bviagra\b|\bcasino\b|\bcrypto\s?wallet\b/i.test(blob)) return true;
  if (/(.)\1{6,}/.test(blob)) return true; // aaaaaaa
  if (!/[aeiouy]/i.test(v.fullName.replace(/\s/g, ""))) return true; // no vowels at all
  if (/\.(ru|xyz|top|click)$/i.test(v.email.split("@")[1] ?? "")) return true;
  return false;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Please check the form fields and try again.", fields: parsed.error.flatten().fieldErrors });
    }
    const v = parsed.data;

    // 1. Honeypot: only bots fill this hidden field.
    if (v.honeypot && v.honeypot.trim().length > 0) {
      console.log("petfest rsvp: honeypot triggered");
      return json({ success: true, skipped: true });
    }

    // 2. Too-fast submission (form filled in under 2.5s = script).
    if (typeof v.elapsedMs === "number" && v.elapsedMs < 2500) {
      return json({ error: "That was a bit too fast — please review your details and submit again." });
    }

    // 3. Content heuristics.
    if (looksLikeSpam(v)) {
      console.log("petfest rsvp: spam heuristics triggered");
      return json({ error: "We couldn't accept this submission. Please contact us if this is a mistake." });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 300) || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const emailLower = v.email.toLowerCase();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 4. Duplicate RSVP for the same email.
    const { data: dupe } = await supabase
      .from("petfest_rsvps")
      .select("id")
      .ilike("email", emailLower)
      .limit(1);
    if (dupe && dupe.length > 0) {
      return json({ success: true, duplicate: true });
    }

    // 5. Rate limit per IP: max 3 RSVPs per hour, and 1 per 30 seconds.
    if (ip) {
      const { data: recent } = await supabase
        .from("petfest_rsvps")
        .select("created_at")
        .eq("ip_address", ip)
        .gte("created_at", hourAgo)
        .order("created_at", { ascending: false });

      if (recent && recent.length > 0) {
        if (Date.now() - new Date(recent[0].created_at).getTime() < 30_000) {
          return json({ error: "Please wait a moment before submitting another RSVP." });
        }
        if (recent.length >= 3) {
          return json({ error: "Too many RSVPs from this connection. Please try again later." });
        }
      }
    }

    // Optional signed-in user attribution.
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

    const { data: inserted, error } = await supabase
      .from("petfest_rsvps")
      .insert({
        user_id: userId,
        full_name: v.fullName,
        email: v.email,
        phone: v.phone,
        pet_count: v.petCount,
        pet_name: v.petName,
        pet_breed: v.petBreed || null,
        pet_birthday: v.petBirthday || null,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("petfest rsvp insert error:", error);
      return json({ error: "We couldn't save your RSVP. Please try again." }, 500);
    }

    return json({ success: true, id: inserted.id });
  } catch (err) {
    console.error("submit-petfest-rsvp error:", err);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});

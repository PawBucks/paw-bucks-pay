import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  // Default US country code if 10 digits
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone: rawPhone } = await req.json();
    if (!rawPhone || typeof rawPhone !== "string") {
      return new Response(JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    // Rate limit: max 1 send per 60s and 5 per hour per phone
    const { data: recent } = await supabase
      .from("phone_verifications")
      .select("id, created_at")
      .eq("phone", phone)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (recent && recent.length > 0) {
      const last = new Date(recent[0].created_at).getTime();
      if (Date.now() - last < 60_000) {
        return new Response(JSON.stringify({ error: "Please wait before requesting a new code" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (recent.length >= 5) {
        return new Response(JSON.stringify({ error: "Too many code requests. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Generate 6-digit code using a cryptographically secure RNG
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const code = String(100000 + (rand[0] % 900000)).padStart(6, "0");
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from("phone_verifications")
      .insert({ phone, code_hash: codeHash, expires_at: expiresAt, ip_address: ip });
    if (insertErr) {
      console.error("Insert OTP error:", insertErr);
      return new Response(JSON.stringify({ error: "Could not create verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send SMS via Twilio
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const body = `Your PawBucks verification code is ${code}. It expires in 10 minutes.`;
    const params = new URLSearchParams({ To: phone, From: from, Body: body });
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!twilioRes.ok) {
      const errText = await twilioRes.text();
      console.error("Twilio error:", twilioRes.status, errText);
      let friendly = "Failed to send verification SMS";
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.code === 21608) {
          friendly = "SMS sending is restricted on this account (Twilio trial). Please verify your number with Twilio or contact support to enable production SMS.";
        } else if (parsed?.message) {
          friendly = `SMS error: ${parsed.message}`;
        }
      } catch (_) { /* keep default */ }
      // Return 200 so the Supabase Functions client surfaces our error field
      // instead of the generic "non-2xx status code" message.
      return new Response(JSON.stringify({ success: false, error: friendly }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, phone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-phone-otp error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Use Eastern Time for expiration checks (midnight ET)
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const etParts = etFormatter.formatToParts(now);
    const etHour = parseInt(etParts.find(p => p.type === "hour")!.value);
    
    // Only run expiration logic if it's around midnight ET (0-1 AM ET window)
    // Reminders can run anytime
    const isExpirationWindow = etHour >= 0 && etHour < 2;

    // 1. Send expiry reminders first (before expiring)
    const { data: reminderResult, error: reminderError } = await supabase.rpc(
      "send_pawbucks_expiry_reminders"
    );

    if (reminderError) {
      console.error("Reminder error:", reminderError);
    } else {
      console.log(`Sent ${reminderResult} expiry reminders`);
    }

    // 2. Expire PawBucks that have passed their expiration date
    const { data: expireResult, error: expireError } = await supabase.rpc(
      "expire_pawbucks"
    );

    if (expireError) {
      console.error("Expiration error:", expireError);
    } else {
      console.log(`Expired ${expireResult} PawBucks entries`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: reminderResult ?? 0,
        expired_count: expireResult ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

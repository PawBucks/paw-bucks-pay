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

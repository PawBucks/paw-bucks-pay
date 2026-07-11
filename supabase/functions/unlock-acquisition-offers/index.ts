// Legacy alias — forwards to `unlock-merchant-offers`, which handles both
// acquisition-only and full-ecosystem merchants and unlocks New Customer
// and Partner Deal offers based on merchant fee_model.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bodyText = await req.text();
    const forwardUrl = `${supabaseUrl}/functions/v1/unlock-merchant-offers`;
    const upstream = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: bodyText,
    });
    const respText = await upstream.text();
    return new Response(respText, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[unlock-acquisition-offers alias] error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
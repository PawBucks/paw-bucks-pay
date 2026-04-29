// One-shot helper: copies the INTERNAL_TRIGGER_SECRET env var into
// private.system_config so DB triggers can authenticate calls to
// internal-only edge functions. Safe to run multiple times.
//
// Invoke once after deploy:
//   curl -X POST \
//     "https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/bootstrap-trigger-secret" \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // No external auth: this function only copies a server-only env var into a
    // private (non-public) config table and reveals nothing. Idempotent.
    const secret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "INTERNAL_TRIGGER_SECRET not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error } = await supabase.rpc("set_system_config", {
      _key: "internal_trigger_secret",
      _value: secret,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Shared guard for cron / internal-only edge functions.
// Returns a 401 Response if the caller did not present the configured
// x-internal-secret header. Returns null when the request is authorized.
export async function checkInternalSecret(req: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  const provided = req.headers.get("x-internal-secret");
  const runtimeSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");

  if (provided && runtimeSecret && provided === runtimeSecret) {
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (provided && supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data } = await supabase.rpc("verify_internal_trigger_secret", { _provided: provided });

    if (data === true) {
      return null;
    }
  }

  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

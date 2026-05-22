// Shared guard for cron / internal-only edge functions.
// Returns a 401 Response if the caller did not present the configured
// x-internal-secret header. Returns null when the request is authorized.
export function checkInternalSecret(req: Request, corsHeaders: Record<string, string>): Response | null {
  const expected = Deno.env.get("INTERNAL_TRIGGER_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

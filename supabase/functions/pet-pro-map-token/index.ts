import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
  const ok = token?.startsWith("pk.");
  return new Response(JSON.stringify(ok ? { token } : { error: "Map is unavailable" }), { status: ok ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

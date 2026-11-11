import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const Body = z.object({ location: z.string().trim().min(2).max(100), category: z.enum(["grooming", "veterinary", "training", "boarding", "daycare", "walking", "pet store", "mobile grooming"]), limit: z.number().int().min(1).max(20).default(10) });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization"); if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!; const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7)); if (!u.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).in("role", ["admin", "superadmin"]); if (!roles?.length) return json({ error: "Not authorized" }, 403);
    const parsed = Body.safeParse(await req.json()); if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { location, category, limit } = parsed.data; const key = `${location.toLowerCase()}|${category}|${limit}`;
    const { data: cached } = await admin.from("pet_pro_search_cache").select("results,created_at").eq("search_key", key).maybeSingle();
    if (cached && Date.now() - new Date(cached.created_at).getTime() < 7 * 86400000) return json({ results: cached.results, cached: true });
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY"); if (!apiKey) return json({ error: "Public business search is not configured" }, 500);
    const r = await fetch("https://api.firecrawl.dev/v2/search", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: `${category} pet business ${location}`, limit, country: "US", lang: "en" }) });
    const text = await r.text(); if (!r.ok) { console.error(`Search failed [${r.status}]: ${text}`); return json({ error: "Public search failed", status: r.status, details: text.slice(0, 500) }, r.status); }
    const web = JSON.parse(text)?.data?.web ?? [];
    const results = web.filter((x: any) => /^https?:\/\//.test(x.url)).map((x: any) => ({ business_name: String(x.title ?? "").split(/[|\-–]/)[0].trim().slice(0, 200), category, source_url: x.url, website_url: x.url, description: String(x.description ?? "").slice(0, 300) })).filter((x: any) => x.business_name.length > 1);
    await admin.from("pet_pro_search_cache").upsert({ search_key: key, results, created_at: new Date().toISOString() });
    return json({ results, cached: false });
  } catch (e) { console.error("admin-pet-pro-research", e); return json({ error: "Unable to search public listings" }, 500); }
});

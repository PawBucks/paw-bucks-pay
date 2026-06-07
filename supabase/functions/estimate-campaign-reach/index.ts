import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TargetingRules {
  species?: string[];
  breeds?: string[];
  age_min_years?: number;
  age_max_years?: number;
  zip_codes?: string[];
  zip_radius_miles?: number;
  center_zip?: string;
  consumer_tiers?: string[];
  subscription_tiers?: string[];
  min_purchases?: number;
  recent_active_days?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require authenticated caller; only brand owners or admins may estimate reach.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Authorize: must be a brand owner OR have admin/superadmin role
    const [{ data: brand }, { data: isAdmin }, { data: isSuper }] = await Promise.all([
      admin.from("brand_accounts").select("id").eq("user_id", user.id).maybeSingle(),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: user.id, _role: "superadmin" }),
    ]);
    if (!brand && !isAdmin && !isSuper) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rules } = await req.json() as { rules: TargetingRules };

    // Start broad: count distinct pet_owner profiles
    let userQuery = admin.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "pet_owner");

    if (rules.subscription_tiers && rules.subscription_tiers.length > 0) {
      userQuery = userQuery.in("subscription_tier", rules.subscription_tiers);
    }

    const { count: totalUsers } = await userQuery;
    let estimate = totalUsers || 0;

    // Adjust for pet filters (rough proportion)
    if (rules.species && rules.species.length > 0) {
      const { count: petCount } = await admin
        .from("pet_profiles")
        .select("user_id", { count: "exact", head: true })
        .in("species", rules.species);
      const { count: allPets } = await admin
        .from("pet_profiles")
        .select("user_id", { count: "exact", head: true });
      if (allPets && allPets > 0) {
        estimate = Math.floor(estimate * ((petCount || 0) / allPets));
      }
    }

    // Geo: if center_zip + radius, take rough ratio of profiles in radius
    if (rules.center_zip || (rules.zip_codes && rules.zip_codes.length > 0)) {
      // Conservative: assume geo cuts to ~15% of base
      estimate = Math.floor(estimate * 0.15);
    }

    if (rules.consumer_tiers && rules.consumer_tiers.length > 0) {
      // Assume consumer tier filter retains ~40%
      estimate = Math.floor(estimate * 0.4);
    }

    if (rules.min_purchases && rules.min_purchases > 0) {
      // Assume min purchase filter retains ~25% per +1 threshold
      const factor = Math.max(0.05, 1 - rules.min_purchases * 0.15);
      estimate = Math.floor(estimate * factor);
    }

    if (rules.recent_active_days && rules.recent_active_days > 0 && rules.recent_active_days <= 30) {
      estimate = Math.floor(estimate * 0.5);
    }

    return new Response(JSON.stringify({
      estimated_audience: Math.max(estimate, 0),
      total_users: totalUsers || 0,
      precision: "approximate",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("estimate-campaign-reach error:", e);
    return new Response(JSON.stringify({ error: "Internal server error", estimated_audience: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Fetch all active partner offers with merchant details
    const { data: offers, error } = await supabaseClient
      .from("partner_offers")
      .select(`
        *,
        merchants(
          id,
          business_name,
          business_type,
          description
        )
      `)
      .eq("is_active", true)
      .order("coins_required", { ascending: true });

    if (error) {
      throw new Error("Failed to fetch offers");
    }

    console.log(`Fetched ${offers?.length || 0} active partner offers`);

    return new Response(
      JSON.stringify({ offers: offers || [] }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error fetching offers:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

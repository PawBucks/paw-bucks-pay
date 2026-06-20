import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const createOfferSchema = z.object({
  title: z.string().min(1).max(200).transform(val => val.trim()),
  description: z.string().min(1).max(2000).transform(val => val.trim()),
  coins_required: z.number().int().min(0).max(1000000).optional().default(0),
  cash_equivalent: z.number().positive().max(100000).optional().nullable(),
  product_id: z.string().max(255).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  redemption_cap: z.number().int().min(0).max(1000000).optional().nullable(),
  per_user_limit: z.number().int().min(1).max(1000).optional().default(1),
  image_url: z.string().url().max(2000).optional().nullable(),
  require_approval: z.boolean().optional().default(false),
  brand_id: z.string().uuid().optional().nullable(),
  offer_type: z.enum(["pawbucks_redemption", "new_customer"]).optional(),
});

// Sanitize text to prevent XSS
function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseClient
      .from("merchants")
      .select("id, fee_model")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      console.error("Merchant not found for user:", user.id);
      return new Response(
        JSON.stringify({ error: "Merchant account not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = createOfferSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid offer data. Please check your entries." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let {
      title,
      description,
      coins_required,
      cash_equivalent,
      product_id,
      start_date,
      end_date,
      redemption_cap,
      per_user_limit,
      image_url,
      require_approval,
      brand_id,
      offer_type,
    } = validationResult.data;

    // Acquisition-only merchants can ONLY create New Customer Deals.
    // These deals don't require a PawBucks price or cash equivalent.
    const isAcquisitionOnly = merchant.fee_model === "acquisition_only";
    if (isAcquisitionOnly) {
      offer_type = "new_customer";
      coins_required = 0;
      cash_equivalent = null;
      brand_id = null;
    } else {
      offer_type = offer_type ?? "pawbucks_redemption";
      if (offer_type === "pawbucks_redemption" && (!coins_required || coins_required <= 0)) {
        return new Response(
          JSON.stringify({ error: "PawBucks required must be greater than 0" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Sanitize text fields
    const sanitizedTitle = sanitizeText(title);
    const sanitizedDescription = sanitizeText(description);

    // If a brand_id was supplied, verify this merchant is actively enrolled in
    // at least one campaign for that brand. This keeps merchants from tagging
    // offers with brands that haven't authorized them.
    let validatedBrandId: string | null = null;
    if (brand_id) {
      const { data: enrollment, error: enrollErr } = await supabaseClient
        .from("brand_campaign_merchants")
        .select("id, brand_campaigns!inner(brand_id, status)")
        .eq("merchant_id", merchant.id)
        .eq("status", "active")
        .eq("brand_campaigns.brand_id", brand_id)
        .eq("brand_campaigns.status", "active")
        .limit(1);
      if (enrollErr) {
        console.error("Brand enrollment check failed:", enrollErr);
        return new Response(
          JSON.stringify({ error: "Unable to verify brand enrollment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      if (!enrollment || enrollment.length === 0) {
        return new Response(
          JSON.stringify({ error: "You are not enrolled in any active campaign for that brand." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      validatedBrandId = brand_id;
    }

    // Additional date validation
    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return new Response(
        JSON.stringify({ error: "Start date must be before end date" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Determine initial status
    let status = "draft";
    let is_active = false;

    if (require_approval) {
      status = "pending";
    } else if (start_date && new Date(start_date) <= new Date()) {
      status = "active";
      is_active = true;
    } else if (!start_date) {
      status = "active";
      is_active = true;
    }

    // Create offer
    const { data: offer, error: offerError } = await supabaseClient
      .from("partner_offers")
      .insert({
        partner_id: merchant.id,
        title: sanitizedTitle,
        description: sanitizedDescription,
        coins_required: coins_required ?? 0,
        cash_equivalent: cash_equivalent || null,
        product_id: product_id || null,
        image_url: image_url || null,
        start_date: start_date || null,
        end_date: end_date || null,
        redemption_cap: redemption_cap ?? null,
        per_user_limit: per_user_limit || 1,
        is_active,
        status,
        require_approval: require_approval || false,
        brand_id: validatedBrandId,
        offer_type,
      })
      .select()
      .single();

    if (offerError) {
      console.error("Failed to create offer:", offerError);
      return new Response(
        JSON.stringify({ error: "Unable to create offer. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: offer.id,
      merchant_id: merchant.id,
      action: "created",
      actor_id: user.id,
      details: { title: sanitizedTitle, coins_required, status }
    });

    console.log(`Created offer ${offer.id} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        offer_id: offer.id,
        title: offer.title,
        coins_required: offer.coins_required,
        status: offer.status,
        start_date: offer.start_date,
        end_date: offer.end_date,
        redemption_cap: offer.redemption_cap,
        redemption_count: offer.redemption_count
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error creating offer:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per IP, 30 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const nowIso = new Date().toISOString();

    // Fetch all active partner offers with merchant details from the public view
    const { data: offers, error } = await supabaseClient
      .from("partner_offers")
      .select(`
        id,
        title,
        description,
        coins_required,
        cash_equivalent,
        image_url,
        start_date,
        end_date,
        redemption_cap,
        redemption_count,
        per_user_limit,
        is_active,
        status,
        offer_type,
        partner_id,
        brand_id
      `)
      .eq("is_active", true)
      .order("coins_required", { ascending: true });

    if (error) {
      console.error("Error fetching offers:", error);
      throw new Error("Failed to fetch offers");
    }

    // Only surface offers that are truly live right now (status + date window).
    const liveOffers = (offers ?? []).filter((o: any) =>
      (!o.status || o.status === "active") &&
      (!o.start_date || new Date(o.start_date).toISOString() <= nowIso) &&
      (!o.end_date || new Date(o.end_date).toISOString() >= nowIso)
    );

    // Fetch merchant details from public view for each offer
    const partnerIds = [...new Set(liveOffers.map((o: any) => o.partner_id) || [])];

    let merchantsMap: Record<string, any> = {};
    
    if (partnerIds.length > 0) {
      const { data: merchants, error: merchantsError } = await supabaseClient
        .from("merchants_public")
        .select("id, business_name, business_type, description, address, latitude, longitude, fee_model, approval_status, is_paused")
        .in("id", partnerIds);
      
      if (!merchantsError && merchants) {
        merchantsMap = merchants.reduce((acc: any, m: any) => {
          if (m.id) {
            acc[m.id] = {
              id: m.id,
              business_name: m.business_name || 'Partner',
              business_type: m.business_type || 'Merchant',
              description: m.description,
              address: m.address ?? null,
              latitude: m.latitude ?? null,
              longitude: m.longitude ?? null,
              fee_model: m.fee_model ?? null,
              approval_status: m.approval_status ?? null,
              is_paused: m.is_paused ?? false,
            };
          }
          return acc;
        }, {} as typeof merchantsMap);
      }
    }

    // Fetch brand display info for any brand-tagged offers.
    const brandIds = [
      ...new Set(liveOffers.map((o: any) => o.brand_id).filter(Boolean)),
    ] as string[];
    let brandsMap: Record<string, { id: string; brand_name: string }> = {};
    if (brandIds.length > 0) {
      const { data: brands, error: brandsError } = await supabaseClient
        .from("brand_accounts")
        .select("id, brand_name, status")
        .in("id", brandIds);
      if (!brandsError && brands) {
        brandsMap = brands.reduce((acc, b: any) => {
          if (b.id && b.status === "active") {
            acc[b.id] = { id: b.id, brand_name: b.brand_name };
          }
          return acc;
        }, {} as typeof brandsMap);
      }
    }

    // Combine offers with merchant data
    const offersWithMerchants = liveOffers.map((offer: any) => ({
      ...offer,
      merchants: merchantsMap[offer.partner_id] || { business_name: 'Partner', business_type: 'Merchant', description: null },
      brand: offer.brand_id ? (brandsMap[offer.brand_id] || null) : null,
    }));

    console.log(`Fetched ${offersWithMerchants.length} active partner offers`);

    return new Response(
      JSON.stringify({ offers: offersWithMerchants }),
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
    
    if (!mapboxToken) {
      console.error("Mapbox token not configured");
      return new Response(
        JSON.stringify({ error: "Geocoding service not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { address, merchantId } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Geocoding address: ${address}`);

    // Call Mapbox Geocoding API
    const encodedAddress = encodeURIComponent(address);
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      console.error(`Mapbox API error: ${geocodeResponse.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to geocode address" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const geocodeData = await geocodeResponse.json();
    
    if (!geocodeData.features || geocodeData.features.length === 0) {
      console.log("No geocoding results found for address:", address);
      return new Response(
        JSON.stringify({ 
          error: "Address not found",
          latitude: null,
          longitude: null
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const [longitude, latitude] = geocodeData.features[0].center;
    console.log(`Geocoded coordinates: lat=${latitude}, lng=${longitude}`);

    // If merchantId is provided, update the merchant record directly
    if (merchantId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from("merchants")
        .update({ latitude, longitude })
        .eq("id", merchantId);

      if (updateError) {
        console.error("Error updating merchant coordinates:", updateError);
        // Still return the coordinates even if update failed
      } else {
        console.log(`Updated merchant ${merchantId} with coordinates`);
      }
    }

    return new Response(
      JSON.stringify({ 
        latitude, 
        longitude,
        formattedAddress: geocodeData.features[0].place_name 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in geocode-address:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

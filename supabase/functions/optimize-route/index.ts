import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Stop {
  booking_id?: string;
  address: string;
  latitude: number;
  longitude: number;
  customer_name?: string;
  service_name?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { merchant_id, route_date, start_location, stops } = await req.json();

    if (!merchant_id || !route_date || !stops || !Array.isArray(stops) || stops.length === 0) {
      return new Response(JSON.stringify({ error: "merchant_id, route_date, and stops are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify merchant ownership
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, user_id")
      .eq("id", merchant_id)
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: "Merchant not found or not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
    if (!mapboxToken) {
      return new Response(JSON.stringify({ error: "Mapbox not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build coordinates for Mapbox Optimization API
    // Start location + all stops
    const startLat = start_location?.latitude || stops[0].latitude;
    const startLng = start_location?.longitude || stops[0].longitude;

    // Use Mapbox Directions API with waypoints to get optimized route
    // Format: start;stop1;stop2;...;start (round trip)
    const coordinates = [
      `${startLng},${startLat}`,
      ...stops.map((s: Stop) => `${s.longitude},${s.latitude}`),
    ].join(";");

    // Call Mapbox Optimized Trips API
    const optimizeUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?access_token=${mapboxToken}&roundtrip=false&source=first&geometries=geojson&overview=full`;

    const optimizeResponse = await fetch(optimizeUrl);

    if (!optimizeResponse.ok) {
      console.error("Mapbox optimize error:", await optimizeResponse.text());
      // Fallback: use regular directions API without optimization
      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
      const directionsResponse = await fetch(directionsUrl);
      
      if (!directionsResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to calculate route" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const directionsData = await directionsResponse.json();
      const route = directionsData.routes?.[0];
      
      if (!route) {
        return new Response(JSON.stringify({ error: "No route found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No optimization - keep original order
      const orderedStops = stops.map((s: Stop, i: number) => ({
        ...s,
        stop_order: i + 1,
        drive_distance_miles: null,
        drive_duration_minutes: null,
      }));

      const totalDistanceMiles = parseFloat((route.distance / 1609.34).toFixed(2));
      const totalDurationMinutes = Math.round(route.duration / 60);

      // Upsert route plan
      const { data: routePlan, error: planError } = await supabase
        .from("merchant_route_plans")
        .upsert({
          merchant_id,
          route_date,
          status: "optimized",
          total_distance_miles: totalDistanceMiles,
          total_duration_minutes: totalDurationMinutes,
          estimated_savings_minutes: 0,
          optimized_order: orderedStops.map((s: any) => s.booking_id || s.address),
          mapbox_route_geometry: JSON.stringify(route.geometry),
          start_address: start_location?.address || null,
          start_latitude: startLat,
          start_longitude: startLng,
        }, { onConflict: "merchant_id,route_date" })
        .select()
        .single();

      if (planError) throw planError;

      // Delete existing stops and create new ones
      await supabase.from("route_stops").delete().eq("route_plan_id", routePlan.id);

      const stopInserts = orderedStops.map((s: any) => ({
        route_plan_id: routePlan.id,
        booking_id: s.booking_id || null,
        stop_order: s.stop_order,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        customer_name: s.customer_name || null,
        service_name: s.service_name || null,
        status: "pending",
      }));

      await supabase.from("route_stops").insert(stopInserts);

      return new Response(JSON.stringify({
        route_plan: routePlan,
        stops: orderedStops,
        route_geometry: route.geometry,
        total_distance_miles: totalDistanceMiles,
        total_duration_minutes: totalDurationMinutes,
        optimized: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const optimizeData = await optimizeResponse.json();
    const trip = optimizeData.trips?.[0];
    const waypoints = optimizeData.waypoints;

    if (!trip || !waypoints) {
      return new Response(JSON.stringify({ error: "No optimized route found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // waypoints[0] is start location, rest are stops
    // Each waypoint has waypoint_index indicating original position
    // and trips_index + waypoint_index for ordering
    const stopWaypoints = waypoints.slice(1); // Skip start
    
    // Sort stops by their optimized order
    const orderedStops = stopWaypoints
      .map((wp: any, _i: number) => {
        const originalIndex = wp.waypoint_index - 1; // -1 because start is index 0
        return {
          ...stops[originalIndex],
          stop_order: wp.waypoint_index,
          original_index: originalIndex,
        };
      })
      .sort((a: any, b: any) => a.stop_order - b.stop_order)
      .map((s: any, i: number) => ({ ...s, stop_order: i + 1 }));

    // Calculate per-leg distances
    const legs = trip.legs || [];
    const stopsWithDriving = orderedStops.map((s: any, i: number) => {
      const leg = legs[i]; // leg i = travel from previous point to this stop
      return {
        ...s,
        drive_distance_miles: leg ? parseFloat((leg.distance / 1609.34).toFixed(2)) : null,
        drive_duration_minutes: leg ? Math.round(leg.duration / 60) : null,
      };
    });

    const totalDistanceMiles = parseFloat((trip.distance / 1609.34).toFixed(2));
    const totalDurationMinutes = Math.round(trip.duration / 60);

    // Calculate savings by comparing to non-optimized route
    // Simple estimate: optimized vs original order
    const nonOptimizedCoords = [
      `${startLng},${startLat}`,
      ...stops.map((s: Stop) => `${s.longitude},${s.latitude}`),
    ].join(";");
    
    let estimatedSavingsMinutes = 0;
    try {
      const nonOptUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${nonOptimizedCoords}?access_token=${mapboxToken}&overview=false`;
      const nonOptRes = await fetch(nonOptUrl);
      if (nonOptRes.ok) {
        const nonOptData = await nonOptRes.json();
        const nonOptDuration = Math.round((nonOptData.routes?.[0]?.duration || 0) / 60);
        estimatedSavingsMinutes = Math.max(0, nonOptDuration - totalDurationMinutes);
      }
    } catch (e) {
      console.error("Failed to calculate savings:", e);
    }

    // Upsert route plan
    const { data: routePlan, error: planError } = await supabase
      .from("merchant_route_plans")
      .upsert({
        merchant_id,
        route_date,
        status: "optimized",
        total_distance_miles: totalDistanceMiles,
        total_duration_minutes: totalDurationMinutes,
        estimated_savings_minutes: estimatedSavingsMinutes,
        optimized_order: stopsWithDriving.map((s: any) => s.booking_id || s.address),
        mapbox_route_geometry: JSON.stringify(trip.geometry),
        start_address: start_location?.address || null,
        start_latitude: startLat,
        start_longitude: startLng,
      }, { onConflict: "merchant_id,route_date" })
      .select()
      .single();

    if (planError) throw planError;

    // Delete existing stops and create new ones
    await supabase.from("route_stops").delete().eq("route_plan_id", routePlan.id);

    const stopInserts = stopsWithDriving.map((s: any) => ({
      route_plan_id: routePlan.id,
      booking_id: s.booking_id || null,
      stop_order: s.stop_order,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      drive_duration_minutes: s.drive_duration_minutes,
      drive_distance_miles: s.drive_distance_miles,
      customer_name: s.customer_name || null,
      service_name: s.service_name || null,
      status: "pending",
    }));

    await supabase.from("route_stops").insert(stopInserts);

    return new Response(JSON.stringify({
      route_plan: routePlan,
      stops: stopsWithDriving,
      route_geometry: trip.geometry,
      total_distance_miles: totalDistanceMiles,
      total_duration_minutes: totalDurationMinutes,
      estimated_savings_minutes: estimatedSavingsMinutes,
      optimized: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in optimize-route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

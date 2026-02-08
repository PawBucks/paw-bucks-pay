import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FlashSaleNotificationRequest {
  serviceId: string;
  merchantId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the request is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { serviceId, merchantId }: FlashSaleNotificationRequest = await req.json();

    if (!serviceId || !merchantId) {
      throw new Error("Missing serviceId or merchantId");
    }

    // Verify the user owns this merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, user_id")
      .eq("id", merchantId)
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found or unauthorized");
    }

    // Get the service details
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("merchant_services")
      .select("*")
      .eq("id", serviceId)
      .eq("merchant_id", merchantId)
      .single();

    if (serviceError || !service) {
      throw new Error("Service not found");
    }

    // Calculate regular price and savings
    const regularPawbucksPrice = Math.floor(service.price * 1000);
    const flashPrice = service.flash_sale_pawbucks_price || 0;
    const savingsPercent = flashPrice > 0 ? Math.round((1 - flashPrice / regularPawbucksPrice) * 100) : 0;

    // Get all pet owners to notify (users with pet_owner type who have transacted with this merchant or have notification preferences)
    const { data: petOwners, error: ownersError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("user_type", "pet_owner");

    if (ownersError) {
      console.error("Error fetching pet owners:", ownersError);
      throw new Error("Failed to fetch pet owners");
    }

    let recipientsCount = 0;
    const notifications = [];

    for (const owner of petOwners || []) {
      // Check notification preferences
      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("marketing")
        .eq("user_id", owner.id)
        .single();

      // Default to true if no preferences exist, or check marketing preference
      const shouldNotify = !prefs || prefs.marketing !== false;

      if (shouldNotify) {
        notifications.push({
          user_id: owner.id,
          title: `🔥 Flash Sale: ${savingsPercent}% Off!`,
          message: `${merchant.business_name} is offering ${service.name} for just ${flashPrice.toLocaleString()} PB (was ${regularPawbucksPrice.toLocaleString()} PB). Limited time only!`,
          category: "marketing",
        });
        recipientsCount++;
      }
    }

    // Insert notifications in batches
    if (notifications.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabaseAdmin
          .from("notifications")
          .insert(batch);

        if (insertError) {
          console.error("Error inserting notifications batch:", insertError);
        }
      }
    }

    // Log the flash sale notification
    const { error: logError } = await supabaseAdmin
      .from("flash_sale_notifications")
      .insert({
        service_id: serviceId,
        merchant_id: merchantId,
        notification_type: "flash_sale_live",
        recipients_count: recipientsCount,
      });

    if (logError) {
      console.error("Error logging flash sale notification:", logError);
    }

    console.log(`Flash sale notification sent for service ${serviceId} to ${recipientsCount} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        recipientsCount,
        message: `Flash sale notification sent to ${recipientsCount} pet owners`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error sending flash sale notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

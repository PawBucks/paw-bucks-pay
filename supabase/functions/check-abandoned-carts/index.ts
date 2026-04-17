import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();

    // Abandoned cart timing:
    // 1st reminder: 1 hour after last activity
    // 2nd reminder: 24 hours after last activity
    // 3rd/final reminder: 72 hours after last activity
    // Expire carts after 7 days of inactivity

    // Step 1: Find active carts idle for > 1 hour with items
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Expire very old carts
    await supabaseAdmin
      .from("shopping_carts")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("last_activity_at", sevenDaysAgo);

    // Cleanup: auto-convert any active/abandoned carts that have NO items
    // (user purchased through a different flow or cleared cart manually).
    const { data: emptyCarts } = await supabaseAdmin
      .from("shopping_carts")
      .select("id")
      .in("status", ["active", "abandoned"]);

    if (emptyCarts && emptyCarts.length > 0) {
      const cartIds = emptyCarts.map((c) => c.id);
      const { data: cartItemCounts } = await supabaseAdmin
        .from("shopping_cart_items")
        .select("cart_id")
        .in("cart_id", cartIds);
      const cartsWithItems = new Set((cartItemCounts || []).map((ci: any) => ci.cart_id));
      const emptyCartIds = cartIds.filter((id) => !cartsWithItems.has(id));
      if (emptyCartIds.length > 0) {
        await supabaseAdmin
          .from("shopping_carts")
          .update({ status: "expired" })
          .in("id", emptyCartIds);
      }
    }

    // Mark as abandoned if idle > 1 hour AND has items
    const { data: candidateCarts } = await supabaseAdmin
      .from("shopping_carts")
      .select("id, user_id")
      .eq("status", "active")
      .lt("last_activity_at", oneHourAgo);

    const cartsToAbandon: string[] = [];
    for (const cart of candidateCarts || []) {
      const { count } = await supabaseAdmin
        .from("shopping_cart_items")
        .select("id", { count: "exact", head: true })
        .eq("cart_id", cart.id);
      if ((count || 0) > 0) cartsToAbandon.push(cart.id);
    }

    let abandonedCarts: { id: string; user_id: string }[] = [];
    if (cartsToAbandon.length > 0) {
      const { data } = await supabaseAdmin
        .from("shopping_carts")
        .update({ status: "abandoned", abandoned_at: now.toISOString() })
        .in("id", cartsToAbandon)
        .select("id, user_id");
      abandonedCarts = data || [];
    }

    // Also check existing abandoned carts for follow-up reminders
    const { data: allAbandonedCarts } = await supabaseAdmin
      .from("shopping_carts")
      .select("id, user_id, last_activity_at, abandoned_at")
      .eq("status", "abandoned");

    let notificationsSent = 0;

    for (const cart of allAbandonedCarts || []) {
      // Get cart items for this cart
      const { data: cartItems } = await supabaseAdmin
        .from("shopping_cart_items")
        .select(`
          quantity,
          pet_store_items:item_id (id, name, price, price_pawbucks, image_url)
        `)
        .eq("cart_id", cart.id);

      // Skip empty carts and mark them expired (purchased via another flow or cleared)
      if (!cartItems || cartItems.length === 0) {
        await supabaseAdmin
          .from("shopping_carts")
          .update({ status: "expired" })
          .eq("id", cart.id);
        continue;
      }

      // Skip if user has made any pet store purchase since last cart activity
      const { data: recentPurchase } = await supabaseAdmin
        .from("pet_store_orders")
        .select("id")
        .eq("user_id", cart.user_id)
        .gte("created_at", cart.last_activity_at)
        .limit(1)
        .maybeSingle();

      if (recentPurchase) {
        await supabaseAdmin
          .from("shopping_carts")
          .update({ status: "converted", converted_at: now.toISOString() })
          .eq("id", cart.id);
        await supabaseAdmin
          .from("shopping_cart_items")
          .delete()
          .eq("cart_id", cart.id);
        continue;
      }


      // Check which notifications already sent
      const { data: sentNotifs } = await supabaseAdmin
        .from("abandoned_cart_notifications")
        .select("notification_type")
        .eq("cart_id", cart.id);

      const sentTypes = new Set((sentNotifs || []).map((n) => n.notification_type));
      const lastActivity = new Date(cart.last_activity_at).getTime();
      const hoursSinceActivity = (now.getTime() - lastActivity) / (1000 * 60 * 60);

      let notificationType: string | null = null;

      if (hoursSinceActivity >= 72 && !sentTypes.has("final_reminder")) {
        notificationType = "final_reminder";
      } else if (hoursSinceActivity >= 24 && !sentTypes.has("second_reminder")) {
        notificationType = "second_reminder";
      } else if (hoursSinceActivity >= 1 && !sentTypes.has("first_reminder")) {
        notificationType = "first_reminder";
      }

      if (!notificationType) continue;

      // Build items snapshot
      const itemsSnapshot = cartItems.map((ci: any) => ({
        name: ci.pet_store_items?.name,
        quantity: ci.quantity,
        price: ci.pet_store_items?.price,
        price_pawbucks: ci.pet_store_items?.price_pawbucks,
        image_url: ci.pet_store_items?.image_url,
      }));

      const totalUsd = cartItems.reduce(
        (sum: number, ci: any) => sum + (ci.pet_store_items?.price || 0) * ci.quantity,
        0
      );
      const totalPawbucks = cartItems.reduce(
        (sum: number, ci: any) => sum + (ci.pet_store_items?.price_pawbucks || 0) * ci.quantity,
        0
      );

      // Build notification message
      const itemNames = itemsSnapshot.map((i: any) => i.name).filter(Boolean);
      const itemList = itemNames.length <= 3
        ? itemNames.join(", ")
        : `${itemNames.slice(0, 2).join(", ")} and ${itemNames.length - 2} more`;

      let title: string;
      let message: string;

      switch (notificationType) {
        case "first_reminder":
          title = "🛒 You left items in your cart!";
          message = `Don't forget about ${itemList}! Complete your purchase before they sell out.`;
          break;
        case "second_reminder":
          title = "🐾 Your furry friend is waiting!";
          message = `Your cart with ${itemList} is still saved. Total: $${(totalUsd / 100).toFixed(2)} or ${totalPawbucks.toLocaleString()} PawBucks.`;
          break;
        case "final_reminder":
          title = "⏰ Last chance — cart expiring soon!";
          message = `Your cart with ${itemList} will expire soon. Grab them now before they're gone!`;
          break;
        default:
          continue;
      }

      // Send in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: cart.user_id,
        title,
        message,
        category: "promotional",
      });

      // Log the abandoned cart notification
      await supabaseAdmin.from("abandoned_cart_notifications").insert({
        cart_id: cart.id,
        user_id: cart.user_id,
        notification_type: notificationType,
        items_snapshot: itemsSnapshot,
        total_value_usd: totalUsd,
        total_value_pawbucks: totalPawbucks,
      });

      notificationsSent++;
    }

    console.log(`Abandoned cart check complete: ${notificationsSent} notifications sent`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent,
        cartsAbandoned: abandonedCarts?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error checking abandoned carts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

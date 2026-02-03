import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const { productId, accountId } = await req.json();

    if (!productId || !accountId) {
      throw new Error("productId and accountId are required");
    }

    // Verify the user owns this merchant account
    const { data: merchant, error: merchantError } = await supabaseClient
      .from("merchants")
      .select("id, stripe_account_id")
      .eq("user_id", userData.user.id)
      .eq("stripe_account_id", accountId)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found or unauthorized");
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // Archive the product (Stripe doesn't allow deletion if it has prices)
    // Setting active to false effectively "deletes" it from storefront
    await stripe.products.update(
      productId,
      { active: false },
      { stripeAccount: accountId }
    );

    console.log(`Product ${productId} archived for account ${accountId.substring(0, 10)}...`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting product:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

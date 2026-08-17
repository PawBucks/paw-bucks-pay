import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client to lookup stripe_account_id securely
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // STEP 1: Validate Stripe API Key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // STEP 2: Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // STEP 3: Get the merchantId from body (stripe_account_id is resolved server-side)
    let merchantId: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      merchantId = url.searchParams.get('merchantId');
    } else {
      const body = await req.json();
      merchantId = body.merchantId;
    }

    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantId)) {
      throw new Error('merchantId must be a valid UUID');
    }

    // Resolve stripe_account_id from merchantId (secure server-side lookup)
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id')
      .eq('id', merchantId)
      .eq('approval_status', 'approved')
      .single();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Merchant not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      );
    }

    const stripeAccountId = merchant.stripe_account_id;

    console.log('Listing catalog for merchant:', merchantId);

    // STEP 4: List products from the CONNECTED ACCOUNT
    const products = stripeAccountId
      ? await stripe.products.list(
          {
            limit: 100,
            active: true,
            expand: ['data.default_price'],
          },
          { stripeAccount: stripeAccountId },
        )
      : { data: [], has_more: false };

    // STEP 5: Filter out subscription products (those with platform: "pawbucks" metadata)
    // Subscription products are managed separately via merchant_subscription_plans table
    const oneTimeProducts = products.data.filter((product: Stripe.Product) => {
      return product.metadata?.platform !== "pawbucks";
    });

    const { data: imageFiles } = await supabaseAdmin.storage
      .from('product-images')
      .list(merchantId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    const fallbackImages = (imageFiles || [])
      .filter((file) => file.name && file.created_at)
      .map((file) => {
        const path = `${merchantId}/${file.name}`;
        const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path);
        return { url: data.publicUrl, createdMs: new Date(file.created_at).getTime() };
      })
      .filter((file) => Number.isFinite(file.createdMs));

    // STEP 6: Transform the products data
    const productsData = oneTimeProducts.map((product: Stripe.Product) => {
      const defaultPrice = product.default_price as Stripe.Price | null;
      let metadataImages: string[] = [];
      try {
        const parsed = product.metadata?.image_urls ? JSON.parse(product.metadata.image_urls) : [];
        metadataImages = Array.isArray(parsed)
          ? parsed.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
          : [];
      } catch (_error) {
        metadataImages = [];
      }
      const productCreatedMs = product.created * 1000;
      const storageImages = fallbackImages
        .filter((file) => file.createdMs >= productCreatedMs - 10 * 60 * 1000 && file.createdMs <= productCreatedMs + 2 * 60 * 1000)
        .sort((a, b) => Math.abs(a.createdMs - productCreatedMs) - Math.abs(b.createdMs - productCreatedMs))
        .slice(0, 8)
        .map((file) => file.url);
      const images = product.images?.length ? product.images : (metadataImages.length ? metadataImages : storageImages);
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images,
        active: product.active,
        price: defaultPrice ? {
          id: defaultPrice.id,
          unit_amount: defaultPrice.unit_amount,
          currency: defaultPrice.currency,
          formatted: defaultPrice.unit_amount 
            ? `$${(defaultPrice.unit_amount / 100).toFixed(2)}`
            : 'N/A',
        } : null,
        metadata: product.metadata,
        created: product.created,
      };
    });

    // Build the complete POS catalog server-side. Pet owners cannot directly read
    // every merchant-owned catalog table, so relying on browser-side table queries
    // caused only invoice catalog items to appear in the checkout picker.
    const [invoiceItemsResult, servicesResult, storeItemsResult] = await Promise.all([
      supabaseAdmin
        .from('invoice_catalog_items')
        .select('id, name, unit_price, sku, category')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('name'),
      supabaseAdmin
        .from('merchant_services')
        .select('id, name, price, category')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('name'),
      supabaseAdmin
        .from('pet_store_items')
        .select('id, name, price, sku, category')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('name'),
    ]);

    const catalogItems = [
      ...(invoiceItemsResult.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        unit_price: Number(item.unit_price ?? 0),
        sku: item.sku ?? null,
        source_type: 'catalog_item',
        group: item.category || 'Catalog',
      })),
      ...(servicesResult.data ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        unit_price: Number(service.price ?? 0),
        sku: null,
        source_type: 'merchant_service',
        group: service.category ? `Services · ${service.category}` : 'Services',
      })),
      ...(storeItemsResult.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        unit_price: Number(item.price ?? 0),
        sku: item.sku ?? null,
        source_type: 'pet_store_item',
        group: item.category ? `Store · ${item.category}` : 'Store',
      })),
      ...productsData
        .filter((product) => typeof product.price?.unit_amount === 'number')
        .map((product) => ({
          id: product.id,
          name: product.name,
          unit_price: Number(product.price?.unit_amount ?? 0) / 100,
          sku: product.id,
          source_type: 'custom',
          group: 'Storefront',
        })),
    ];

    console.log(`Found ${productsData.length} one-time products (filtered ${products.data.length - productsData.length} subscription products)`);

    // STEP 6: Return the products list (including connectedAccountId for checkout)
    return new Response(
      JSON.stringify({
        success: true,
        products: productsData,
        catalogItems,
        has_more: products.has_more,
        connectedAccountId: stripeAccountId ?? null, // Return for subscription checkout flow
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error listing products:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

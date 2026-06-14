import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ImportRow = {
  name: string;
  description?: string | null;
  priceUsd: number; // dollars
  pawbucksPrice?: number | null;
  category?: string | null;
  stock?: number | null;
  imageUrl?: string | null;
  itemType?: "product" | "service" | null;
  listInPetStore?: boolean | null;
};

type RowResult = {
  row: number;
  name: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
};

function sanitize(row: unknown, idx: number): { ok: true; data: ImportRow } | { ok: false; error: string } {
  const r = row as Record<string, unknown>;
  const name = (r?.name ?? "").toString().trim();
  if (!name) return { ok: false, error: `Row ${idx + 1}: name is required` };
  const priceUsd = Number(r?.priceUsd);
  if (!isFinite(priceUsd) || priceUsd < 0.5) return { ok: false, error: `Row ${idx + 1} (${name}): price must be at least $0.50` };
  const pawbucksPrice = r?.pawbucksPrice == null || r?.pawbucksPrice === "" ? null : Number(r.pawbucksPrice);
  if (pawbucksPrice != null && (!isFinite(pawbucksPrice) || pawbucksPrice < 0)) {
    return { ok: false, error: `Row ${idx + 1} (${name}): invalid PawBucks price` };
  }
  const stock = r?.stock == null || r?.stock === "" ? null : Number(r.stock);
  if (stock != null && (!isFinite(stock) || stock < 0)) {
    return { ok: false, error: `Row ${idx + 1} (${name}): invalid stock` };
  }
  const itemTypeRaw = (r?.itemType ?? "product").toString().toLowerCase();
  const itemType = itemTypeRaw === "service" ? "service" : "product";
  return {
    ok: true,
    data: {
      name,
      description: r?.description ? String(r.description) : null,
      priceUsd,
      pawbucksPrice,
      category: r?.category ? String(r.category) : null,
      stock,
      imageUrl: r?.imageUrl ? String(r.imageUrl) : null,
      itemType,
      listInPetStore: r?.listInPetStore === false ? false : true,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) throw new Error("Not authenticated");

    const body = await req.json();
    const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) throw new Error("No rows to import");
    if (rows.length > 500) throw new Error("Maximum 500 rows per import");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify merchant belongs to user
    const { data: merchant, error: mErr } = await admin
      .from("merchants")
      .select("id, stripe_account_id, user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!merchant) throw new Error("Merchant profile not found");
    if (!merchant.stripe_account_id) throw new Error("Stripe account not connected");

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Pre-fetch existing items for dedupe by lowercased name
    const { data: existing } = await admin
      .from("pet_store_items")
      .select("id, name, item_type")
      .eq("merchant_id", merchant.id);
    const existingByName = new Map<string, { id: string }>();
    for (const e of existing ?? []) existingByName.set(e.name.toLowerCase().trim(), { id: e.id });

    const results: RowResult[] = [];
    let created = 0;
    let updated = 0;
    let errored = 0;

    for (let i = 0; i < rows.length; i++) {
      const parsed = sanitize(rows[i], i);
      if (!parsed.ok) {
        results.push({ row: i + 1, name: "", status: "error", message: parsed.error });
        errored++;
        continue;
      }
      const r = parsed.data;
      const priceInCents = Math.round(r.priceUsd * 100);
      try {
        const existingMatch = existingByName.get(r.name.toLowerCase().trim());
        if (existingMatch) {
          // Update existing pet_store_items row only
          const { error: upErr } = await admin
            .from("pet_store_items")
            .update({
              description: r.description,
              category: r.category || "Merchant Products",
              item_type: r.itemType ?? "product",
              price: priceInCents,
              price_pawbucks: r.pawbucksPrice ?? Math.max(1, priceInCents),
              stock_quantity: r.stock ?? 999,
              image_url: r.imageUrl ?? null,
              image_urls: r.imageUrl ? [r.imageUrl] : [],
              is_active: true,
            })
            .eq("id", existingMatch.id);
          if (upErr) throw upErr;
          results.push({ row: i + 1, name: r.name, status: "updated" });
          updated++;
        } else {
          // Create Stripe Connect product
          await stripe.products.create(
            {
              name: r.name,
              description: r.description || undefined,
              default_price_data: { unit_amount: priceInCents, currency: "usd" },
              active: true,
              images: r.imageUrl ? [r.imageUrl] : undefined,
            },
            { stripeAccount: merchant.stripe_account_id }
          );

          if (r.listInPetStore !== false) {
            const { error: insErr } = await admin.from("pet_store_items").insert({
              name: r.name,
              description: r.description,
              category: r.category || "Merchant Products",
              item_type: r.itemType ?? "product",
              price: priceInCents,
              price_pawbucks: r.pawbucksPrice ?? Math.max(1, priceInCents),
              merchant_id: merchant.id,
              is_active: true,
              stock_quantity: r.stock ?? 999,
              image_url: r.imageUrl ?? null,
              image_urls: r.imageUrl ? [r.imageUrl] : [],
            });
            if (insErr) throw insErr;
          }
          results.push({ row: i + 1, name: r.name, status: "created" });
          created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ row: i + 1, name: r.name, status: "error", message: msg });
        errored++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary: { created, updated, errored, total: rows.length }, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("bulk-import-products error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
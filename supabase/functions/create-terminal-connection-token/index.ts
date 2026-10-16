import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, json, HttpError, resolveTerminalMerchant } from "../_shared/terminal-merchant.ts";

const Body = z.object({ merchantId: z.string().uuid().optional() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { stripe, merchant, stripeAccount } = await resolveTerminalMerchant(req, parsed.data.merchantId);
    const opts = { stripeAccount };

    // Find or create a Terminal location for this business (required for Tap to Pay).
    const existing = await stripe.terminal.locations.list({ limit: 100 }, opts);
    let location = existing.data.find((l) => l.metadata?.pawbucks_merchant_id === merchant.id);
    if (!location) {
      const a = (merchant.address ?? "") as string;
      const zip = a.match(/\b\d{5}\b/)?.[0];
      const parts = a.split(",").map((s) => s.trim()).filter(Boolean);
      location = await stripe.terminal.locations.create({
        display_name: (merchant.business_name || "PawBucks Business").slice(0, 100),
        address: {
          line1: parts[0] || "Address on file",
          city: parts[1] || undefined,
          state: parts[2]?.split(" ")[0] || undefined,
          postal_code: zip,
          country: "US",
        },
        metadata: { pawbucks_merchant_id: merchant.id },
      }, opts);
    }

    const token = await stripe.terminal.connectionTokens.create({ location: location.id }, opts);
    return json({ secret: token.secret, locationId: location.id, connectedAccountId: stripeAccount });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error("[TERMINAL-TOKEN]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, status);
  }
});

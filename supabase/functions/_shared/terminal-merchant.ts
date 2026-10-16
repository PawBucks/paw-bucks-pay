import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Authenticates the caller and returns the merchant they own (connected Stripe account required). */
export async function resolveTerminalMerchant(req: Request, merchantId?: string) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new HttpError(500, "Payments are not configured");
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin: SupabaseClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) throw new HttpError(401, "Not signed in");
  const { data: u, error } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
  if (error || !u.user) throw new HttpError(401, "Not signed in");

  let q = admin.from("merchants")
    .select("id, user_id, business_name, address, stripe_account_id, onboarding_complete")
    .eq("user_id", u.user.id);
  if (merchantId) q = q.eq("id", merchantId);
  const { data: merchant } = await q.limit(1).maybeSingle();
  if (!merchant) throw new HttpError(403, "No business account found for this user");
  if (!merchant.stripe_account_id || !merchant.onboarding_complete) {
    throw new HttpError(400, "Finish connecting Stripe before taking card payments");
  }
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  return { stripe, admin, merchant, user: u.user, stripeAccount: merchant.stripe_account_id as string };
}

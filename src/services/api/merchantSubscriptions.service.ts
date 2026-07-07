import { supabase, ServiceResult, ServiceListResult } from"./base.service";
import type { Tables } from"@/integrations/supabase/types";

type MerchantSubscription = Tables<"merchant_subscriptions">;
type MerchantSubscriptionEvent = Tables<"merchant_subscription_events">;

export interface CreateMerchantSubscriptionParams {
 merchantId: string;
 priceId: string;
 productName: string;
 paymentMethodId: string;
 pawbucksToUse?: number;
 autoRedeem?: boolean;
 metadata?: Record<string, string>;
}

export interface CreateSubscriptionResult {
 success: boolean;
 subscriptionId?: string;
 status?: string;
 nextBillingDate?: string;
 amount?: number;
 productName?: string;
 merchantName?: string;
 requiresAction?: boolean;
 clientSecret?: string;
 connectedAccountId?: string;
 pawbucksEarned?: number;
 pawbucksUsed?: number;
 error?: string;
}

export interface CancelSubscriptionResult {
 success: boolean;
 subscriptionId?: string;
 status?: string;
 cancelAtPeriodEnd?: boolean;
 effectiveDate?: string;
 error?: string;
}

export const merchantSubscriptionsService = {
 /**
 * Get all merchant subscriptions for the current user
 */
 async getMySubscriptions(): Promise<ServiceListResult<MerchantSubscription & { merchants: { business_name: string } | null }>> {
 const { data, error } = await supabase
 .from("merchant_subscriptions")
 .select("*, merchants(business_name)")
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 /**
 * Get active subscriptions for a specific merchant (for merchant dashboard)
 */
 async getSubscriptionsToMerchant(merchantId: string): Promise<ServiceListResult<MerchantSubscription & { profiles: { full_name: string; email: string } | null }>> {
 const { data, error } = await supabase
 .from("merchant_subscriptions")
 .select("*, profiles(full_name, email)")
 .eq("merchant_id", merchantId)
 .in("status", ["active","past_due"])
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 /**
 * Get subscription by ID
 */
 async getById(subscriptionId: string): Promise<ServiceResult<MerchantSubscription & { merchants: { business_name: string } | null }>> {
 const { data, error } = await supabase
 .from("merchant_subscriptions")
 .select("*, merchants(business_name)")
 .eq("id", subscriptionId)
 .single();
 return { data, error };
 },

 /**
 * Get subscription events/history
 */
 async getEvents(subscriptionId: string): Promise<ServiceListResult<MerchantSubscriptionEvent>> {
 const { data, error } = await supabase
 .from("merchant_subscription_events")
 .select("*")
 .eq("subscription_id", subscriptionId)
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 /**
 * Create a new subscription to a merchant
 * Handles customer creation on connected account and first payment
 */
 async create(params: CreateMerchantSubscriptionParams): Promise<CreateSubscriptionResult> {
 const { data, error } = await supabase.functions.invoke("create-merchant-subscription", {
 body: params,
 });

 if (error) {
 // supabase.functions.invoke throws on non-2xx and hides the JSON body
 // behind `error.context` (a Response). Extract the real server error so
 // duplicate-subscription 409s and validation errors surface a useful
 // message instead of "Edge function returned a non-2xx status code".
 let serverBody: any = null;
 try {
 const ctx: any = (error as any).context;
 if (ctx && typeof ctx.json === "function") {
 serverBody = await ctx.clone().json();
 } else if (ctx && typeof ctx.text === "function") {
 const t = await ctx.clone().text();
 try { serverBody = JSON.parse(t); } catch { serverBody = { error: t }; }
 }
 } catch { /* fall through to generic message */ }

 if (serverBody && (serverBody.error || serverBody.message || serverBody.duplicatePrevention)) {
 return {
 success: false,
 error: serverBody.error || serverBody.message || "Subscription could not be created.",
 };
 }
 return { success: false, error: error.message };
 }

 return data;
 },

 /**
 * Cancel a subscription
 * @param subscriptionId - The subscription ID to cancel
 * @param cancelImmediately - If true, cancel now. If false, cancel at period end.
 */
 async cancel(subscriptionId: string, cancelImmediately = false): Promise<CancelSubscriptionResult> {
 const { data, error } = await supabase.functions.invoke("cancel-merchant-subscription", {
 body: { subscriptionId, cancelImmediately },
 });

 if (error) {
 return { success: false, error: error.message };
 }

 return data;
 },

 /**
 * Check if user has an active subscription to a specific merchant/product
 */
 async hasActiveSubscription(merchantId: string, priceId?: string): Promise<boolean> {
 let query = supabase
 .from("merchant_subscriptions")
 .select("id")
 .eq("merchant_id", merchantId)
 .in("status", ["active","past_due"]);

 if (priceId) {
 query = query.eq("stripe_price_id", priceId);
 }

 const { data, error } = await query.limit(1);
 
 if (error) {
 console.error("Error checking subscription:", error);
 return false;
 }

 return (data?.length || 0) > 0;
 },
};

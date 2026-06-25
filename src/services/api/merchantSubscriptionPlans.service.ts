import { supabase, ServiceResult, ServiceListResult } from"./base.service";
import type { Tables } from"@/integrations/supabase/types";

type MerchantSubscriptionPlan = Tables<"merchant_subscription_plans">;

export interface CreatePlanParams {
 merchantId: string;
 name: string;
 description?: string;
 amount: number; // in cents
 currency?: string;
 billingInterval:"day" |"week" |"month" |"year";
 billingIntervalCount: number;
 features?: string[];
 trialDays?: number;
 maxSubscribers?: number;
}

export interface UpdatePlanParams {
 name?: string;
 description?: string;
 amount?: number;
 billingInterval?:"day" |"week" |"month" |"year";
 billingIntervalCount?: number;
 features?: string[];
 trialDays?: number;
 maxSubscribers?: number;
 isActive?: boolean;
 sortOrder?: number;
}

export const merchantSubscriptionPlansService = {
 /**
 * Get all subscription plans for the current merchant
 */
 async getMyPlans(merchantId: string): Promise<ServiceListResult<MerchantSubscriptionPlan>> {
 const { data, error } = await supabase
 .from("merchant_subscription_plans")
 .select("*")
 .eq("merchant_id", merchantId)
 .order("sort_order", { ascending: true })
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 /**
 * Get active published plans for a merchant (public storefront view)
 */
 async getPublishedPlans(merchantId: string): Promise<ServiceListResult<MerchantSubscriptionPlan>> {
 const { data, error } = await supabase
 .from("merchant_subscription_plans")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true)
 .not("stripe_price_id","is", null)
 .order("sort_order", { ascending: true });
 return { data: data || [], error };
 },

 /**
 * Get a single plan by ID
 */
 async getById(planId: string): Promise<ServiceResult<MerchantSubscriptionPlan>> {
 const { data, error } = await supabase
 .from("merchant_subscription_plans")
 .select("*")
 .eq("id", planId)
 .single();
 return { data, error };
 },

 /**
 * Create a new subscription plan and auto-publish to Stripe
 */
 async create(params: CreatePlanParams): Promise<ServiceResult<MerchantSubscriptionPlan>> {
 // Check for duplicate plan name
 const { data: existingPlans } = await supabase
 .from("merchant_subscription_plans")
 .select("id, name")
 .eq("merchant_id", params.merchantId)
 .ilike("name", params.name);

 if (existingPlans && existingPlans.length > 0) {
 return { 
 data: null, 
 error: new Error(`A subscription plan named"${params.name}" already exists`) 
 };
 }

 // Create the plan in the database
 const { data, error } = await supabase
 .from("merchant_subscription_plans")
 .insert({
 merchant_id: params.merchantId,
 name: params.name,
 description: params.description || null,
 amount: params.amount,
 currency: params.currency ||"usd",
 billing_interval: params.billingInterval,
 billing_interval_count: params.billingIntervalCount,
 features: params.features || [],
 trial_days: params.trialDays || 0,
 max_subscribers: params.maxSubscribers || null,
 })
 .select()
 .single();
 
 if (error || !data) {
 return { data, error };
 }

 // Auto-publish to Stripe so it's immediately available on storefront
 const publishResult = await this.publish(data.id);
 
 if (publishResult.error) {
 // Plan was created but publish failed - return the plan but log the error
 console.error("Auto-publish failed:", publishResult.error);
 return { data, error: null };
 }

 // Refetch the plan to get updated Stripe IDs
 const { data: updatedPlan, error: refetchError } = await supabase
 .from("merchant_subscription_plans")
 .select("*")
 .eq("id", data.id)
 .single();

 return { data: updatedPlan || data, error: refetchError };
 },

 /**
 * Update an existing subscription plan
 */
 async update(planId: string, params: UpdatePlanParams): Promise<ServiceResult<MerchantSubscriptionPlan>> {
 const updates: Record<string, unknown> = {};
 
 if (params.name !== undefined) updates.name = params.name;
 if (params.description !== undefined) updates.description = params.description;
 if (params.amount !== undefined) updates.amount = params.amount;
 if (params.billingInterval !== undefined) updates.billing_interval = params.billingInterval;
 if (params.billingIntervalCount !== undefined) updates.billing_interval_count = params.billingIntervalCount;
 if (params.features !== undefined) updates.features = params.features;
 if (params.trialDays !== undefined) updates.trial_days = params.trialDays;
 if (params.maxSubscribers !== undefined) updates.max_subscribers = params.maxSubscribers;
 if (params.isActive !== undefined) updates.is_active = params.isActive;
 if (params.sortOrder !== undefined) updates.sort_order = params.sortOrder;

 const { data, error } = await supabase
 .from("merchant_subscription_plans")
      .update(updates as any)
 .eq("id", planId)
 .select()
 .single();
 return { data, error };
 },

 /**
 * Delete a subscription plan
 */
 async delete(planId: string): Promise<{ error: Error | null }> {
 const { error } = await supabase
 .from("merchant_subscription_plans")
 .delete()
 .eq("id", planId);
 return { error };
 },

 /**
 * Publish a plan by creating Stripe Product and Price on connected account
 */
 async publish(planId: string): Promise<ServiceResult<{ stripeProductId: string; stripePriceId: string }>> {
 const { data, error } = await supabase.functions.invoke("publish-subscription-plan", {
 body: { planId },
 });
 
 if (error) {
 return { data: null, error };
 }
 
 return { data, error: null };
 },

 /**
 * Unpublish a plan (deactivate Stripe price)
 */
 async unpublish(planId: string): Promise<ServiceResult<void>> {
 const { error } = await supabase
 .from("merchant_subscription_plans")
 .update({ is_active: false })
 .eq("id", planId);
 return { data: undefined, error };
 },
};

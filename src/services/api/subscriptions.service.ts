import { supabase, ServiceResult, ServiceListResult } from "./base.service";
import type { Tables } from "@/integrations/supabase/types";

type Subscription = Tables<"subscriptions">;
type SubscriptionEvent = Tables<"subscription_events">;

export const subscriptionsService = {
  async getByUserId(userId: string): Promise<ServiceResult<Subscription>> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    return { data, error };
  },

  async getAll(userId: string): Promise<ServiceListResult<Subscription>> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async getEvents(subscriptionId: string): Promise<ServiceListResult<SubscriptionEvent>> {
    const { data, error } = await supabase
      .from("subscription_events")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("timestamp", { ascending: false });
    return { data: data || [], error };
  },

  // Edge function calls for platform subscriptions (PawPass/PawPass+)
  async checkSubscription() {
    return supabase.functions.invoke("check-subscription");
  },

  async createCheckout(tier: 'basic' | 'plus' = 'basic') {
    return supabase.functions.invoke("create-subscription-checkout", {
      body: { tier },
    });
  },

  async openCustomerPortal(returnUrl: string) {
    return supabase.functions.invoke("customer-portal", {
      body: { returnUrl },
    });
  },
};

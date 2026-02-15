import { supabase, ServiceResult, ServiceListResult } from "./base.service";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;

export const transactionsService = {
  async getByUserId(userId: string, limit = 10): Promise<ServiceListResult<Transaction>> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  async getByMerchantId(merchantId: string, limit = 50): Promise<ServiceListResult<Transaction>> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  async getWithMerchant(userId: string, limit = 10) {
    // Use FK hint for merchants join
    const { data, error } = await supabase
      .from("transactions")
      .select("*, merchants!transactions_merchant_id_fkey(business_name, logo_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  // Edge function calls
  async createPaymentIntent(amount: number, merchantId: string, description?: string) {
    return supabase.functions.invoke("create-payment-intent", {
      body: { amount, merchantId, description },
    });
  },

  async createCombinedPayment(params: {
    merchantId: string;
    totalAmount: number;
    stripeAmount: number;
    pawbucksAmount: number;
    description?: string;
  }) {
    return supabase.functions.invoke("create-combined-payment", {
      body: params,
    });
  },

  async issueRefund(params: {
    transactionId: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }) {
    return supabase.functions.invoke("admin-issue-refund", {
      body: params,
    });
  },

  async merchantIssueRefund(params: {
    transactionId: string;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }) {
    return supabase.functions.invoke("merchant-issue-refund", {
      body: params,
    });
  },
};

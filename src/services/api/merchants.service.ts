import { supabase, ServiceResult, ServiceListResult } from "./base.service";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Merchant = Tables<"merchants">;
type MerchantInsert = TablesInsert<"merchants">;
type MerchantUpdate = TablesUpdate<"merchants">;
type MerchantReview = Tables<"merchant_reviews">;
type FundingRequest = Tables<"funding_requests">;
type FundingDeal = Tables<"funding_deals">;

export const merchantsService = {
  async getAll(): Promise<ServiceListResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .order("business_name");
    return { data: data || [], error };
  },

  async getById(merchantId: string): Promise<ServiceResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .maybeSingle();
    return { data, error };
  },

  async getByUserId(userId: string): Promise<ServiceResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { data, error };
  },

  async create(merchant: MerchantInsert): Promise<ServiceResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .insert(merchant)
      .select()
      .single();
    return { data, error };
  },

  async update(merchantId: string, updates: MerchantUpdate): Promise<ServiceResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .update(updates)
      .eq("id", merchantId)
      .select()
      .single();
    return { data, error };
  },

  async getSponsored(): Promise<ServiceListResult<Merchant>> {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("is_sponsored", true)
      .gte("sponsored_until", new Date().toISOString());
    return { data: data || [], error };
  },

  // Reviews
  async getReviews(merchantId: string): Promise<ServiceListResult<MerchantReview>> {
    const { data, error } = await supabase
      .from("merchant_reviews")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async createReview(review: { merchant_id: string; user_id: string; rating: number; review_text?: string }) {
    const { data, error } = await supabase
      .from("merchant_reviews")
      .insert(review)
      .select()
      .single();
    return { data, error };
  },

  // Funding
  async getFundingRequests(merchantId: string): Promise<ServiceListResult<FundingRequest>> {
    const { data, error } = await supabase
      .from("funding_requests")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async getFundingDeals(merchantId: string): Promise<ServiceListResult<FundingDeal>> {
    const { data, error } = await supabase
      .from("funding_deals")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async createFundingRequest(request: TablesInsert<"funding_requests">) {
    const { data, error } = await supabase
      .from("funding_requests")
      .insert(request)
      .select()
      .single();
    return { data, error };
  },

  // Analytics
  async getAnalytics(merchantId: string) {
    return supabase.rpc("get_merchant_analytics", { _merchant_id: merchantId });
  },

  // Edge function calls
  async getDashboardData() {
    return supabase.functions.invoke("merchant-dashboard");
  },

  async getTransactions(merchantId: string, params?: { limit?: number; offset?: number }) {
    return supabase.functions.invoke("merchant-transactions", {
      body: { merchantId, ...params },
    });
  },
};

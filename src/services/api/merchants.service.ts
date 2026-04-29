import { supabase, ServiceResult, ServiceListResult } from"./base.service";
import type { Tables, TablesInsert, TablesUpdate } from"@/integrations/supabase/types";

type Merchant = Tables<"merchants">;
type MerchantInsert = TablesInsert<"merchants">;
type MerchantUpdate = TablesUpdate<"merchants">;
type MerchantReview = Tables<"merchant_reviews">;
type FundingRequest = Tables<"funding_requests">;
type FundingDeal = Tables<"funding_deals">;
// Public merchant type from the secure view (excludes sensitive contact info like email, owner_name, contact_person)
// Note: stripe_account_id is intentionally excluded for security - resolved server-side in edge functions
type MerchantPublic = Pick<Merchant, 
'id' |'business_name' |'business_type' |'description' |'logo_url' | 
'address' |'phone' |'latitude' |'longitude' |'cashback_rate' |'accepts_pawbucks' | 
'price_range' |'is_sponsored' |'sponsored_until' |'facebook_url' |'instagram_url' | 
'twitter_url' |'linkedin_url' |'website_url' |'tos_url' |'privacy_policy_url' |'shipping_returns_policy_url'
> & { storefront_slug: string | null; business_categories: string[] | null };

export type { MerchantPublic };
export const merchantsService = {
 // Public queries use the secure view (no sensitive contact info)
 async getAll(): Promise<ServiceListResult<MerchantPublic>> {
 const { data, error } = await supabase
 .from("merchants_public")
 .select("*")
 .order("business_name");
 return { data: data || [], error };
 },

 // Public query for single merchant (no sensitive contact info)
 async getById(merchantId: string): Promise<ServiceResult<MerchantPublic>> {
 const { data, error } = await supabase
 .from("merchants_public")
 .select("*")
 .eq("id", merchantId)
 .maybeSingle();
 return { data, error };
 },

 // Full merchant data for authenticated owner only
 async getFullById(merchantId: string): Promise<ServiceResult<Merchant>> {
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

 async getSponsored(): Promise<ServiceListResult<MerchantPublic>> {
 const { data, error } = await supabase
 .from("merchants_public")
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

 // Get reviewer profiles for public display (uses secure view with limited fields)
 async getReviewerProfiles(userIds: string[]) {
 const { data, error } = await supabase
 .from("reviewer_profiles")
 .select("id, full_name, avatar_url")
 .in("id", userIds);
 return { data: data || [], error };
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
 return supabase.rpc("get_merchant_analytics", { p_merchant_id: merchantId });
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

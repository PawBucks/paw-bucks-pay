import { supabase, ServiceResult, ServiceListResult } from"./base.service";
import type { Tables, TablesInsert, TablesUpdate } from"@/integrations/supabase/types";

type PartnerOffer = Tables<"partner_offers">;
type OfferRedemption = Tables<"offer_redemptions">;

export const offersService = {
 async getActive(): Promise<ServiceListResult<PartnerOffer & { merchants: { business_name: string; logo_url: string | null } | null }>> {
 const { data, error } = await supabase
 .from("partner_offers")
 .select("*, merchants:partner_id(business_name, logo_url)")
 .eq("is_active", true)
 .eq("status","active")
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 async getById(offerId: string): Promise<ServiceResult<PartnerOffer>> {
 const { data, error } = await supabase
 .from("partner_offers")
 .select("*")
 .eq("id", offerId)
 .maybeSingle();
 return { data, error };
 },

 async getByMerchantId(merchantId: string): Promise<ServiceListResult<PartnerOffer>> {
 const { data, error } = await supabase
 .from("partner_offers")
 .select("*")
 .eq("partner_id", merchantId)
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 async create(offer: TablesInsert<"partner_offers">): Promise<ServiceResult<PartnerOffer>> {
 const { data, error } = await supabase
 .from("partner_offers")
 .insert(offer)
 .select()
 .single();
 return { data, error };
 },

 async update(offerId: string, updates: TablesUpdate<"partner_offers">): Promise<ServiceResult<PartnerOffer>> {
 const { data, error } = await supabase
 .from("partner_offers")
 .update(updates)
 .eq("id", offerId)
 .select()
 .single();
 return { data, error };
 },

 async getRedemptions(offerId: string): Promise<ServiceListResult<OfferRedemption>> {
 const { data, error } = await supabase
 .from("offer_redemptions")
 .select("*")
 .eq("offer_id", offerId)
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 async getUserRedemptions(userId: string): Promise<ServiceListResult<OfferRedemption>> {
 const { data, error } = await supabase
 .from("offer_redemptions")
 .select("*")
 .eq("user_id", userId)
 .order("created_at", { ascending: false });
 return { data: data || [], error };
 },

 // Edge function calls
 async getPartnerOffers() {
 return supabase.functions.invoke("get-partner-offers");
 },

 async redeemOffer(offerId: string) {
 return supabase.functions.invoke("redeem-pawbucks", {
 body: { offerId },
 });
 },

 async verifyRedemption(code: string) {
 return supabase.functions.invoke("verify-redemption", {
 body: { code },
 });
 },

 async confirmRedemption(redemptionId: string) {
 return supabase.functions.invoke("merchant-confirm-redemption", {
 body: { redemptionId },
 });
 },
};

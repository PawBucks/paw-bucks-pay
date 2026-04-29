import { supabase, ServiceResult, ServiceListResult } from"./base.service";
import type { Tables } from"@/integrations/supabase/types";

type Wallet = Tables<"wallets">;
type PawBucksWallet = Tables<"pawbucks_wallet">;
type WalletActivity = Tables<"wallet_activity">;
type PawBucksActivity = Tables<"pawbucks_activity">;

export const walletsService = {
 // Cash Wallet
 async getWallet(userId: string): Promise<ServiceResult<Wallet>> {
 const { data, error } = await supabase
 .from("wallets")
 .select("*")
 .eq("user_id", userId)
 .maybeSingle();
 return { data, error };
 },

 async getWalletActivity(userId: string, limit = 20): Promise<ServiceListResult<WalletActivity>> {
 const { data, error } = await supabase
 .from("wallet_activity")
 .select("*")
 .eq("user_id", userId)
 .order("created_at", { ascending: false })
 .limit(limit);
 return { data: data || [], error };
 },

 // PawBucks Wallet
 async getPawBucksWallet(userId: string): Promise<ServiceResult<PawBucksWallet>> {
 const { data, error } = await supabase
 .from("pawbucks_wallet")
 .select("*")
 .eq("user_id", userId)
 .maybeSingle();
 return { data, error };
 },

 async getPawBucksActivity(userId: string, limit = 20): Promise<ServiceListResult<PawBucksActivity>> {
 const { data, error } = await supabase
 .from("pawbucks_activity")
 .select("*")
 .eq("user_id", userId)
 .order("created_at", { ascending: false })
 .limit(limit);
 return { data: data || [], error };
 },

 // Edge function calls
 async getWalletHistory(userId: string) {
 return supabase.functions.invoke("get-wallet-history", {
 body: { userId },
 });
 },

 async redeemPawBucks(userId: string, amount: number, offerId: string) {
 return supabase.functions.invoke("redeem-pawbucks", {
 body: { userId, amount, offerId },
 });
 },
};

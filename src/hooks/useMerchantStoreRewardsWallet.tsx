import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MerchantStoreRewardsWallet {
  id: string;
  merchant_id: string;
  balance_cents: number;
  lifetime_funded_cents: number;
  lifetime_issued_pb: number;
  lifetime_redeemed_pb: number;
  low_balance_threshold_cents: number;
  auto_reload_enabled: boolean;
  auto_reload_amount_cents: number | null;
}

export interface MerchantStoreRewardsActivity {
  id: string;
  merchant_id: string;
  type: "topup" | "refund" | "issue" | "redeem_reversal" | "adjustment";
  amount_cents: number;
  pb_amount: number | null;
  user_id: string | null;
  transaction_id: string | null;
  description: string | null;
  created_at: string;
}

export function useMerchantStoreRewardsWallet(merchantId: string | undefined) {
  return useQuery<MerchantStoreRewardsWallet | null>({
    queryKey: ["merchant-store-rewards-wallet", merchantId],
    enabled: !!merchantId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!merchantId) return null;
      const { data, error } = await supabase
        .from("merchant_store_rewards_wallet")
        .select("*")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as MerchantStoreRewardsWallet | null) ?? null;
    },
  });
}

export function useMerchantStoreRewardsActivity(merchantId: string | undefined, limit = 25) {
  return useQuery<MerchantStoreRewardsActivity[]>({
    queryKey: ["merchant-store-rewards-activity", merchantId, limit],
    enabled: !!merchantId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from("merchant_store_rewards_funding_activity")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as MerchantStoreRewardsActivity[];
    },
  });
}
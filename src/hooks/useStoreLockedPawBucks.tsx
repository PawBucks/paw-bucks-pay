import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";

export interface StoreLockedBalance {
  merchant_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  last_activity_at: string | null;
  merchant: {
    id: string;
    business_name: string;
    logo_url: string | null;
    address: string | null;
    business_type: string | null;
  } | null;
}

/**
 * Fetch all store-locked PawBucks balances for the current user across every merchant
 * that has issued in-store rewards via the "Store Rewards Pro" service.
 */
export function useStoreLockedPawBucks(userId: string | undefined) {
  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

  return useQuery<StoreLockedBalance[]>({
    queryKey: ["store-locked-pawbucks", effectiveUserId],
    enabled: !!effectiveUserId && !sharedAccount.isLoading,
    staleTime: 30_000,
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("store_locked_pawbucks")
        .select(
          "merchant_id, balance, lifetime_earned, lifetime_redeemed, last_activity_at, merchant:merchants!store_locked_pawbucks_merchant_id_fkey(id, business_name, logo_url, address, business_type)"
        )
        .eq("user_id", effectiveUserId)
        .gt("balance", 0)
        .order("last_activity_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StoreLockedBalance[];
    },
  });
}

/**
 * Fetch the store-locked balance the current user has at one specific merchant.
 * Returns 0 when there is no balance.
 */
export function useStoreLockedBalanceForMerchant(
  userId: string | undefined,
  merchantId: string | undefined,
) {
  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

  return useQuery<number>({
    queryKey: ["store-locked-pb-merchant", effectiveUserId, merchantId],
    enabled: !!effectiveUserId && !!merchantId && !sharedAccount.isLoading,
    staleTime: 15_000,
    queryFn: async () => {
      if (!effectiveUserId || !merchantId) return 0;
      const { data, error } = await supabase
        .from("store_locked_pawbucks")
        .select("balance")
        .eq("user_id", effectiveUserId)
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data?.balance ?? 0;
    },
  });
}
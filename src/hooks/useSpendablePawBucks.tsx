import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";

interface SpendablePawBucksResult {
  spendableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get the user's spendable PawBucks balance (excludes locked/pending rewards).
 * Use this hook in checkout flows to ensure users can only spend available rewards.
 */
export function useSpendablePawBucks(userId: string | undefined): SpendablePawBucksResult {
  const [spendableBalance, setSpendableBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

  const loadBalances = useCallback(async () => {
    if (!effectiveUserId) {
      setSpendableBalance(0);
      setLockedBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get spendable balance from wallet (this is the available balance)
      const { data: wallet, error: walletError } = await supabase
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", effectiveUserId)
        .single();

      if (walletError && walletError.code !== "PGRST116") {
        throw new Error(walletError.message);
      }

      const spendable = wallet?.balance || 0;

      // Get locked rewards (pending status linked to insurance slices)
      const { data: lockedData, error: lockedError } = await supabase
        .from("pawbucks_activity")
        .select("amount")
        .eq("user_id", effectiveUserId)
        .eq("pawbucks_status", "pending")
        .eq("type", "credit")
        .not("slice_id", "is", null);

      if (lockedError) {
        console.error("Error fetching locked rewards:", lockedError);
      }

      const locked = lockedData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      setSpendableBalance(spendable);
      setLockedBalance(locked);
    } catch (err) {
      console.error("Error loading PawBucks balances:", err);
      setError(err instanceof Error ? err : new Error("Failed to load balance"));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (!sharedAccount.isLoading) {
      loadBalances();
    }
  }, [effectiveUserId, sharedAccount.isLoading, loadBalances]);

  return {
    spendableBalance,
    lockedBalance,
    totalBalance: spendableBalance + lockedBalance,
    isLoading: isLoading || sharedAccount.isLoading,
    error,
    refresh: loadBalances,
  };
}

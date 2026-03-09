import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";

interface SpendablePawBucksResult {
  spendableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  welcomeCreditBalance: number;
  hasWelcomeCredit: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get the user's spendable PawBucks balance (excludes locked/pending rewards).
 * Also fetches Welcome Credit balance for new users - returns only the currently available phase amount.
 * Use this hook in checkout flows to ensure users can only spend available rewards.
 */
export function useSpendablePawBucks(userId: string | undefined): SpendablePawBucksResult {
  const [spendableBalance, setSpendableBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [welcomeCreditBalance, setWelcomeCreditBalance] = useState(0);
  const [hasWelcomeCredit, setHasWelcomeCredit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

  const loadBalances = useCallback(async () => {
    if (!effectiveUserId) {
      setSpendableBalance(0);
      setLockedBalance(0);
      setWelcomeCreditBalance(0);
      setHasWelcomeCredit(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch wallet balance, locked rewards, and welcome credit in parallel
      const [walletResult, lockedResult, welcomeCreditResult] = await Promise.all([
        supabase
          .from("pawbucks_wallet")
          .select("balance")
          .eq("user_id", effectiveUserId)
          .single(),
        supabase
          .from("pawbucks_activity")
          .select("amount")
          .eq("user_id", effectiveUserId)
          .eq("pawbucks_status", "pending")
          .eq("type", "credit")
          .not("slice_id", "is", null),
        supabase
          .from("user_welcome_credits")
          .select("credit_amount, status, expires_at, phase_1_amount, phase_2_amount, phase_1_used, phase_2_unlocked")
          .eq("user_id", effectiveUserId)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (walletResult.error && walletResult.error.code !== "PGRST116") {
        throw new Error(walletResult.error.message);
      }

      if (lockedResult.error) {
        console.error("Error fetching locked rewards:", lockedResult.error);
      }

      const spendable = walletResult.data?.balance || 0;
      const locked = lockedResult.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      // Check welcome credit - determine available phase amount
      let wcBalance = 0;
      let wcActive = false;
      if (welcomeCreditResult.data && welcomeCreditResult.data.status === "active") {
        const expiresAt = new Date(welcomeCreditResult.data.expires_at);
        if (expiresAt > new Date()) {
          const phase1Used = welcomeCreditResult.data.phase_1_used ?? false;
          const phase2Unlocked = welcomeCreditResult.data.phase_2_unlocked ?? false;

          if (!phase1Used) {
            wcBalance = welcomeCreditResult.data.phase_1_amount || 0;
            wcActive = true;
          } else if (phase2Unlocked) {
            wcBalance = welcomeCreditResult.data.phase_2_amount || 0;
            wcActive = true;
          }
          // If phase1 used but phase2 not unlocked, no credit available yet
        }
      }

      setSpendableBalance(spendable);
      setLockedBalance(locked);
      setWelcomeCreditBalance(wcBalance);
      setHasWelcomeCredit(wcActive);
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
    welcomeCreditBalance,
    hasWelcomeCredit,
    isLoading: isLoading || sharedAccount.isLoading,
    error,
    refresh: loadBalances,
  };
}

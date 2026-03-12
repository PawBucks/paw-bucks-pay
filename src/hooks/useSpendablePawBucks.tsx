import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";

interface SpendablePawBucksResult {
  spendableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  welcomeCreditBalance: number;
  hasWelcomeCredit: boolean;
  petFundBalance: number;
  hasPetFund: boolean;
  petFundMinTransactionUsd: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get the user's spendable PawBucks balance (excludes locked/pending rewards).
 * Also fetches Pet Fund balance (Quarter-Million Sign Up Bonus).
 * Falls back to legacy welcome credits for existing users.
 */
export function useSpendablePawBucks(userId: string | undefined): SpendablePawBucksResult {
  const [spendableBalance, setSpendableBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [petFundBalance, setPetFundBalance] = useState(0);
  const [hasPetFund, setHasPetFund] = useState(false);
  const [petFundMinTransactionUsd, setPetFundMinTransactionUsd] = useState(20);
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
      setPetFundBalance(0);
      setHasPetFund(false);
      setWelcomeCreditBalance(0);
      setHasWelcomeCredit(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch wallet balance, locked rewards, pet fund, and legacy welcome credit in parallel
      const [walletResult, lockedResult, petFundResult, legacyResult] = await Promise.all([
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
          .from("pet_fund_ledgers")
          .select("available_balance, status")
          .eq("user_id", effectiveUserId)
          .eq("status", "active")
          .maybeSingle(),
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

      const spendable = walletResult.data?.balance || 0;
      const locked = lockedResult.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      setSpendableBalance(spendable);
      setLockedBalance(locked);

      // Check Pet Fund (new system)
      if (petFundResult.data && petFundResult.data.status === "active") {
        const pfBalance = petFundResult.data.available_balance || 0;
        setPetFundBalance(pfBalance);
        setHasPetFund(pfBalance > 0);

        // Determine min transaction: query releases to check if month 0 is still available
        const { data: releases } = await supabase
          .from("pet_fund_releases")
          .select("month_number, used_at")
          .eq("user_id", effectiveUserId)
          .eq("status", "released")
          .is("used_at", null)
          .order("month_number", { ascending: true })
          .limit(1);

        const oldestAvailable = releases?.[0];
        setPetFundMinTransactionUsd(oldestAvailable?.month_number === 0 ? 40 : 20);

        // Map pet fund to welcome credit interface for backwards compatibility
        setWelcomeCreditBalance(pfBalance);
        setHasWelcomeCredit(pfBalance > 0);
      } else if (legacyResult.data && legacyResult.data.status === "active") {
        // Legacy welcome credit fallback
        const expiresAt = new Date(legacyResult.data.expires_at);
        if (expiresAt > new Date()) {
          const phase1Used = legacyResult.data.phase_1_used ?? false;
          const phase2Unlocked = legacyResult.data.phase_2_unlocked ?? false;
          let wcBalance = 0;
          if (!phase1Used) {
            wcBalance = legacyResult.data.phase_1_amount || 0;
          } else if (phase2Unlocked) {
            wcBalance = legacyResult.data.phase_2_amount || 0;
          }
          setWelcomeCreditBalance(wcBalance);
          setHasWelcomeCredit(wcBalance > 0);
        }
        setPetFundBalance(0);
        setHasPetFund(false);
      } else {
        setWelcomeCreditBalance(0);
        setHasWelcomeCredit(false);
        setPetFundBalance(0);
        setHasPetFund(false);
      }
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
    petFundBalance,
    hasPetFund,
    petFundMinTransactionUsd,
    isLoading: isLoading || sharedAccount.isLoading,
    error,
    refresh: loadBalances,
  };
}

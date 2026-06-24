import { useEffect, useState, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";

interface SpendablePawBucksResult {
 spendableBalance: number;
 lockedBalance: number;
 totalBalance: number;
 welcomeCreditBalance: number;
 hasWelcomeCredit: boolean;
 petFundBalance: number;
 hasPetFund: boolean;
 petFundMinTransactionUsd: number;
 /** Soonest-expiring date for earned PawBucks (ISO string), if any. */
 earnedNextExpiresAt: string | null;
 /** Amount in the soonest-expiring earned PawBucks batch, in raw PB. */
 earnedNextExpiringAmount: number;
 /** Original earned timestamp for the soonest-expiring earned batch. */
 earnedNextEarnedAt: string | null;
 /** Soonest-expiring date for promotional credit (ISO string), if any. */
 promotionalNextExpiresAt: string | null;
 isLoading: boolean;
 error: Error | null;
 refresh: () => Promise<void>;
}

/**
 * Hook to get the user's spendable PawBucks balance (excludes locked/pending rewards).
 * Also fetches Pet Fund balance (tiered welcome credit: Series A/B/C/Standard).
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
 const [earnedNextExpiresAt, setEarnedNextExpiresAt] = useState<string | null>(null);
 const [earnedNextExpiringAmount, setEarnedNextExpiringAmount] = useState(0);
 const [earnedNextEarnedAt, setEarnedNextEarnedAt] = useState<string | null>(null);
 const [promotionalNextExpiresAt, setPromotionalNextExpiresAt] = useState<string | null>(null);
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
 setEarnedNextExpiresAt(null);
 setEarnedNextExpiringAmount(0);
 setEarnedNextEarnedAt(null);
 setPromotionalNextExpiresAt(null);
 setIsLoading(false);
 return;
 }

 try {
 setIsLoading(true);
 setError(null);

 // Fetch wallet balance, locked rewards, pet fund, and legacy welcome credit in parallel
  const [walletResult, lockedResult, petFundResult, legacyResult, earnedExpiryResult] = await Promise.all([
 supabase
 .from("pawbucks_wallet")
 .select("balance")
 .eq("user_id", effectiveUserId)
 .single(),
 supabase
 .from("pawbucks_activity")
 .select("amount")
 .eq("user_id", effectiveUserId)
 .eq("pawbucks_status","pending")
 .eq("type","earn")
 .not("slice_id","is", null),
 supabase
 .from("pet_fund_ledgers")
 .select("available_balance, status")
 .eq("user_id", effectiveUserId)
 .eq("status","active")
 .maybeSingle(),
 supabase
 .from("user_welcome_credits")
 .select("credit_amount, status, expires_at, phase_1_amount, phase_2_amount, phase_1_used, phase_2_unlocked")
 .eq("user_id", effectiveUserId)
 .eq("status","active")
 .maybeSingle(),
  supabase
  .from("pawbucks_activity")
  .select("amount, created_at, expires_at")
  .eq("user_id", effectiveUserId)
  .eq("pawbucks_status","available")
  .eq("type","earn")
  .not("expires_at","is", null)
  .gt("expires_at", new Date().toISOString())
  .order("expires_at", { ascending: true })
  .limit(1),
 ]);

 if (walletResult.error && walletResult.error.code !=="PGRST116") {
 throw new Error(walletResult.error.message);
 }

 const spendable = walletResult.data?.balance || 0;
 const locked = lockedResult.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

 setSpendableBalance(spendable);
 setLockedBalance(locked);

  const nextEarnedExpiry = earnedExpiryResult.data?.[0] ?? null;
  setEarnedNextExpiresAt(nextEarnedExpiry?.expires_at ?? null);
  setEarnedNextExpiringAmount(nextEarnedExpiry?.amount ?? 0);
  setEarnedNextEarnedAt(nextEarnedExpiry?.created_at ?? null);

 // Check Pet Fund (new system)
 if (petFundResult.data && petFundResult.data.status ==="active") {
 const pfBalance = petFundResult.data.available_balance || 0;
 setPetFundBalance(pfBalance);
 setHasPetFund(pfBalance > 0);

  // Determine min transaction + soonest promotional expiration
  const { data: releases } = await supabase
  .from("pet_fund_releases")
  .select("month_number, used_at, expires_at, min_transaction_usd")
  .eq("user_id", effectiveUserId)
  .eq("status","released")
  .is("used_at", null)
  .order("month_number", { ascending: true });

  const oldestAvailable = releases?.[0];
  // Use the per-release minimum stored in the DB so client always
  // matches server-side enforcement ($60 for the $20 upfront drip,
  // $30 for the $10 monthly drips on Series A).
  setPetFundMinTransactionUsd(
    oldestAvailable?.min_transaction_usd != null
      ? Number(oldestAvailable.min_transaction_usd)
      : (oldestAvailable?.month_number === 0 ? 60 : 30)
  );

  const now = new Date();
  const soonestPromo = (releases || [])
  .map(r => r.expires_at)
  .filter((d): d is string => !!d && new Date(d) > now)
  .sort()[0] ?? null;
  setPromotionalNextExpiresAt(soonestPromo);

    // Pet fund and legacy welcome credit are mutually exclusive sources.
    // Do NOT mirror pet fund into welcomeCreditBalance, otherwise consumers
    // that sum both fields would double-count (e.g. SimpleHome shows $40
    // instead of $20 for a Series A upfront deposit).
    setWelcomeCreditBalance(0);
    setHasWelcomeCredit(false);
 } else if (legacyResult.data && legacyResult.data.status ==="active") {
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
  setPromotionalNextExpiresAt(legacyResult.data.expires_at ?? null);
 }
 setPetFundBalance(0);
 setHasPetFund(false);
 } else {
 setWelcomeCreditBalance(0);
 setHasWelcomeCredit(false);
 setPetFundBalance(0);
 setHasPetFund(false);
  setPromotionalNextExpiresAt(null);
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
 earnedNextExpiresAt,
 earnedNextExpiringAmount,
 earnedNextEarnedAt,
 promotionalNextExpiresAt,
 isLoading: isLoading || sharedAccount.isLoading,
 error,
 refresh: loadBalances,
 };
}

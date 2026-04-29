import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";

export interface PetFundRelease {
 id: string;
 monthNumber: number;
 amount: number;
 minTransactionUsd: number;
 status:'pending' |'released' |'used';
 scheduledAt: string;
 releasedAt?: string;
 usedAt?: string;
}

export interface ReferrerBonus {
 refereeId: string;
 amount: number;
 status: string;
 releaseAt?: string;
 releasedAt?: string;
}

export interface PetFundData {
 hasPetFund: boolean;
 hasLegacyCredit?: boolean;
 ledger?: {
 id: string;
 totalAmount: number;
 availableBalance: number;
 escrowBalance: number;
 totalReleased: number;
 totalUsed: number;
 status: string;
 createdAt: string;
 };
 releases: PetFundRelease[];
 nextRelease?: {
 monthNumber: number;
 amount: number;
 scheduledAt: string;
 };
 availableCredits: number;
 currentMinTransactionUsd: number;
 referrerBonuses: ReferrerBonus[];
}

export const usePetFund = (userId: string | undefined) => {
 const [fund, setFund] = useState<PetFundData | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadFund = useCallback(async () => {
 if (!userId) {
 setLoading(false);
 return;
 }

 try {
 setLoading(true);
 const { data, error: fnError } = await supabase.functions.invoke('pet-fund-check');

 if (fnError) throw new Error(fnError.message);

 setFund(data);
 setError(null);
 } catch (err) {
 console.error('Error loading pet fund:', err);
 setError(err instanceof Error ? err.message :'Failed to load pet fund');
 } finally {
 setLoading(false);
 }
 }, [userId]);

 useEffect(() => {
 loadFund();
 }, [loadFund]);

 const availableBalanceUsd = fund?.ledger ? fund.ledger.availableBalance / 1000 : 0;
 const escrowBalanceUsd = fund?.ledger ? fund.ledger.escrowBalance / 1000 : 0;
 const totalAmountUsd = fund?.ledger ? fund.ledger.totalAmount / 1000 : 0;
 const totalUsedUsd = fund?.ledger ? fund.ledger.totalUsed / 1000 : 0;
 const totalRemainingUsd = totalAmountUsd - totalUsedUsd;

 return {
 fund,
 loading,
 error,
 refresh: loadFund,
 hasPetFund: fund?.hasPetFund ?? false,
 availableBalance: fund?.ledger?.availableBalance ?? 0,
 availableBalanceUsd,
 escrowBalance: fund?.ledger?.escrowBalance ?? 0,
 escrowBalanceUsd,
 totalAmount: fund?.ledger?.totalAmount ?? 0,
 totalAmountUsd,
 totalUsed: fund?.ledger?.totalUsed ?? 0,
 totalUsedUsd,
 totalRemainingUsd,
 nextRelease: fund?.nextRelease,
 releases: fund?.releases ?? [],
 currentMinTransactionUsd: fund?.currentMinTransactionUsd ?? 20,
 referrerBonuses: fund?.referrerBonuses ?? [],
 };
};

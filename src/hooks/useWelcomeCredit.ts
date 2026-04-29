import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";

export interface WelcomeCreditStatus {
 hasCredit: boolean;
 isEligible: boolean;
 status?:'active' |'used' |'expired' |'revoked';
 promotionType?:'pet_fund' |'welcome_credit';
 spotsRemaining?: number;
 creditId?: string;
 creditAmount?: number;
 totalCreditAmount?: number;
 totalFundAmount?: number;
 phase1Amount?: number;
 phase2Amount?: number;
 phase1Used?: boolean;
 phase1UsedAt?: string;
 phase2Unlocked?: boolean;
 phase2UnlockedAt?: string;
 currentPhase?: number;
 currentPhaseAmount?: number;
 expiresAt?: string;
 daysRemaining?: number;
 canIssue?: boolean;
 usedAt?: string;
 merchantEligible?: boolean;
 merchantName?: string;
 minimumTransactionCents?: number;
 reason?: string;
}

export const useWelcomeCredit = (userId: string | undefined, merchantId?: string) => {
 const [status, setStatus] = useState<WelcomeCreditStatus | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const checkCredit = useCallback(async () => {
 if (!userId) {
 setLoading(false);
 return;
 }

 try {
 setLoading(true);
 const { data, error: fnError } = await supabase.functions.invoke('welcome-credit-check', {
 body: { merchantId },
 });

 if (fnError) {
 throw new Error(fnError.message);
 }

 setStatus(data);
 setError(null);
 } catch (err) {
 console.error('Error checking welcome credit:', err);
 setError(err instanceof Error ? err.message :'Failed to check welcome credit');
 setStatus(null);
 } finally {
 setLoading(false);
 }
 }, [userId, merchantId]);

 useEffect(() => {
 checkCredit();
 }, [checkCredit]);

 const issueCredit = async (deviceFingerprint?: string): Promise<boolean> => {
 try {
 const { data, error: fnError } = await supabase.functions.invoke('welcome-credit-issue', {
 body: { deviceFingerprint },
 });

 if (fnError) {
 throw new Error(fnError.message);
 }

 if (data?.success) {
 await checkCredit();
 return true;
 }

 return false;
 } catch (err) {
 console.error('Error issuing welcome credit:', err);
 setError(err instanceof Error ? err.message :'Failed to issue welcome credit');
 return false;
 }
 };

 const canUseWelcomeCredit = useCallback((transactionAmountCents: number): {
 canUse: boolean;
 reason?: string;
 creditAmount?: number;
 } => {
 if (!status?.hasCredit || status.status !=='active') {
 return { canUse: false, reason:'No active welcome credit' };
 }

 const minAmount = status.minimumTransactionCents || 7500;
 if (transactionAmountCents < minAmount) {
 return { 
 canUse: false, 
 reason: `Minimum $${(minAmount / 100).toFixed(2)} transaction required` 
 };
 }

 if (status.merchantEligible === false) {
 return { 
 canUse: false, 
 reason:'This merchant does not accept PawBucks' 
 };
 }

 // Use currentPhaseAmount - only the active phase's credit
 const phaseCredit = status.currentPhaseAmount || 0;
 if (phaseCredit <= 0) {
 return { canUse: false, reason:'No available welcome credit for current phase' };
 }

 const creditToApply = Math.min(phaseCredit, transactionAmountCents);

 return { 
 canUse: true, 
 creditAmount: creditToApply 
 };
 }, [status]);

 const currentPhaseAmount = status?.currentPhaseAmount || 0;

 return {
 status,
 loading,
 error,
 checkCredit,
 issueCredit,
 canUseWelcomeCredit,
 hasActiveCredit: status?.hasCredit && status?.status ==='active',
 creditAmountUSD: currentPhaseAmount / 1000,
 daysRemaining: status?.daysRemaining,
 phase1Used: status?.phase1Used ?? false,
 phase2Unlocked: status?.phase2Unlocked ?? false,
 phase2AmountUSD: status?.phase2Amount ? status.phase2Amount / 1000 : 0,
 currentPhase: status?.currentPhase || 0,
 currentPhaseAmount,
 promotionType: status?.promotionType ||'pet_fund',
 spotsRemaining: status?.spotsRemaining,
 };
};

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Clock, ChevronRight, Sparkles, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { PAWBUCKS_CONVERSION } from "@/lib/constants";

interface WelcomeCreditCardProps {
  userId: string;
}

interface WelcomeCreditStatus {
  hasCredit: boolean;
  isEligible: boolean;
  status?: string;
  creditAmount?: number;
  expiresAt?: string;
  daysRemaining?: number;
  canIssue?: boolean;
  usedAt?: string;
}

export const WelcomeCreditCard = ({ userId }: WelcomeCreditCardProps) => {
  const navigate = useNavigate();
  const [creditStatus, setCreditStatus] = useState<WelcomeCreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  const fetchCreditStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('welcome-credit-check', {
        body: {},
      });

      if (error) {
        console.error('Error checking welcome credit:', error);
        return;
      }

      setCreditStatus(data);
    } catch (err) {
      console.error('Failed to fetch credit status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchCreditStatus();
    }
  }, [userId, fetchCreditStatus]);

  const handleIssueCredit = async () => {
    setIssuing(true);
    try {
      // Get device fingerprint (simple version - in production use a proper library)
      const fingerprint = `${navigator.userAgent}-${screen.width}x${screen.height}-${new Date().getTimezoneOffset()}`;

      const { data, error } = await supabase.functions.invoke('welcome-credit-issue', {
        body: { 
          deviceFingerprint: btoa(fingerprint).slice(0, 32),
        },
      });

      if (error) {
        console.error('Error issuing credit:', error);
        return;
      }

      if (data?.success) {
        setCreditStatus({
          hasCredit: true,
          isEligible: true,
          status: 'active',
          creditAmount: data.credit.amount,
          expiresAt: data.credit.expiresAt,
          daysRemaining: data.credit.daysRemaining,
        });
      }
    } catch (err) {
      console.error('Failed to issue credit:', err);
    } finally {
      setIssuing(false);
    }
  };

  // Don't show if loading or if user is not eligible and doesn't have credit
  if (loading) return null;
  if (!creditStatus) return null;
  if (!creditStatus.hasCredit && !creditStatus.isEligible && !creditStatus.canIssue) return null;
  if (creditStatus.status === 'used') return null; // Don't show if already used

  const creditValueUSD = (creditStatus.creditAmount || 50000) / PAWBUCKS_CONVERSION.PET_OWNER_TO_USD;
  const isUrgent = creditStatus.daysRemaining !== undefined && creditStatus.daysRemaining <= 7;
  const isCritical = creditStatus.daysRemaining !== undefined && creditStatus.daysRemaining <= 2;

  // Show "Claim Your Credit" card if eligible but not issued yet
  if (creditStatus.canIssue && !creditStatus.hasCredit) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <GradientCard className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 border-amber-500/30 overflow-hidden relative">
          {/* Sparkle effects */}
          <div className="absolute top-2 right-8 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <div className="absolute top-6 right-4 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse delay-150" />
          <div className="absolute bottom-4 right-12 w-1 h-1 bg-orange-400 rounded-full animate-pulse delay-300" />

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
              <Gift className="w-7 h-7 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground">
                  🎉 Welcome to PawBucks!
                </h3>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                  New Member
                </Badge>
              </div>
              
              <p className="text-muted-foreground mb-3">
                Claim your <span className="font-semibold text-amber-600 dark:text-amber-400">50,000 PawBucks Welcome Credit</span> — 
                that's <span className="font-bold">${creditValueUSD} toward your first booking</span> with participating partners!
              </p>

              <div className="flex items-center gap-3">
                <Button 
                  onClick={handleIssueCredit}
                  disabled={issuing}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                >
                  {issuing ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Claim My Credit
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  One-time use • Expires in 45 days
                </span>
              </div>
            </div>
          </div>
        </GradientCard>
      </motion.div>
    );
  }

  // Show active credit card with countdown
  if (creditStatus.hasCredit && creditStatus.status === 'active') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <GradientCard 
          className={`overflow-hidden relative ${
            isCritical 
              ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-amber-500/20 border-red-500/30' 
              : isUrgent 
                ? 'bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-yellow-500/20 border-orange-500/30'
                : 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-emerald-500/30'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isCritical 
                ? 'bg-gradient-to-br from-red-500 to-orange-500' 
                : isUrgent 
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-500'
            }`}>
              <Gift className="w-7 h-7 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-bold text-foreground">
                  50,000 PawBucks Welcome Credit
                </h3>
                <Badge className={`${
                  isCritical 
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 animate-pulse' 
                    : isUrgent 
                      ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}>
                  {isCritical ? '⚠️ Expiring Soon!' : isUrgent ? '⏰ Use Soon' : '✨ Active'}
                </Badge>
              </div>
              
              <p className="text-muted-foreground mb-3">
                <span className="font-bold text-foreground">${creditValueUSD} toward your first booking</span> with a participating partner. 
                Minimum purchase: $75.
              </p>

              {/* Countdown Timer */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isCritical ? 'text-red-500 animate-pulse' : isUrgent ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${
                    isCritical ? 'text-red-600 dark:text-red-400' : isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'
                  }`}>
                    {creditStatus.daysRemaining} {creditStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
                  </span>
                </div>
                
                {/* Progress bar showing time remaining */}
                <div className="flex-1 max-w-32">
                  <Progress 
                    value={Math.max(0, Math.min(100, ((creditStatus.daysRemaining || 0) / 45) * 100))} 
                    className={`h-2 ${
                      isCritical ? '[&>div]:bg-red-500' : isUrgent ? '[&>div]:bg-orange-500' : '[&>div]:bg-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <Button 
                onClick={() => navigate('/discover')}
                className={`${
                  isCritical 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600' 
                    : isUrgent 
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                } text-white shadow-md`}
              >
                Find Participating Partners
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </GradientCard>
      </motion.div>
    );
  }

  return null;
};

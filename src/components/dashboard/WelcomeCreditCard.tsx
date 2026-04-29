import { useState, useEffect, useCallback } from"react";
import { motion } from"framer-motion";
import { Gift, Clock, ChevronRight, Sparkles } from"lucide-react";
import { useNavigate } from"react-router-dom";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { supabase } from"@/integrations/supabase/client";
import { PAWBUCKS_CONVERSION } from"@/lib/constants";

interface WelcomeCreditCardProps {
 userId: string;
}

interface WelcomeCreditStatus {
 hasCredit: boolean;
 isEligible: boolean;
 status?: string;
 creditAmount?: number;
 currentPhaseAmount?: number;
 currentPhase?: number;
 phase1Amount?: number;
 phase2Amount?: number;
 phase1Used?: boolean;
 phase2Unlocked?: boolean;
 expiresAt?: string;
 daysRemaining?: number;
}

export const WelcomeCreditCard = ({ userId }: WelcomeCreditCardProps) => {
 const navigate = useNavigate();
 const [creditStatus, setCreditStatus] = useState<WelcomeCreditStatus | null>(null);
 const [loading, setLoading] = useState(true);
 const [now, setNow] = useState(() => new Date());

 useEffect(() => {
 const interval = setInterval(() => setNow(new Date()), 60_000);
 return () => clearInterval(interval);
 }, []);

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

 if (loading) return null;
 if (!creditStatus) return null;
 if (creditStatus.status !=='active') return null;

 const phase1Used = creditStatus.phase1Used ?? false;
 const phase2Unlocked = creditStatus.phase2Unlocked ?? false;
 const currentPhase = creditStatus.currentPhase || 0;
 const currentPhaseAmount = creditStatus.currentPhaseAmount || 0;

 // Nothing spendable right now (phase1 used, phase2 not unlocked yet)
 const waitingForPhase2 = phase1Used && !phase2Unlocked;

 // If fully used or nothing to show, hide
 if (!creditStatus.hasCredit && !waitingForPhase2) return null;

 const expiresAt = creditStatus.expiresAt ? new Date(creditStatus.expiresAt) : null;
 const msRemaining = expiresAt ? Math.max(0, expiresAt.getTime() - now.getTime()) : 0;
 const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
 const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
 const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

 const creditValueUSD = currentPhaseAmount / PAWBUCKS_CONVERSION.PET_OWNER_TO_USD;
 const isUrgent = daysRemaining <= 7;
 const isCritical = daysRemaining <= 2;

 const countdownText = daysRemaining > 1
 ? `${daysRemaining} days remaining`
 : daysRemaining === 1
 ? `${hoursRemaining}h ${minutesRemaining}m remaining`
 : hoursRemaining > 0
 ? `${hoursRemaining}h ${minutesRemaining}m remaining`
 : `${minutesRemaining}m remaining`;

 // Phase-aware title and description
 const title = waitingForPhase2
 ?'20,000 PawBucks Bonus Pending'
 : currentPhase === 2
 ?'20,000 PawBucks Welcome Bonus'
 :'30,000 PawBucks Welcome Credit';

 const description = waitingForPhase2
 ?'Complete your first purchase to unlock your $20 bonus PawBucks!'
 : currentPhase === 2
 ? `$${creditValueUSD} bonus toward your next booking with a participating partner. Minimum purchase: $75.`
 : `$${creditValueUSD} toward your first booking with a participating partner. Minimum purchase: $75.`;

 const badgeText = waitingForPhase2
 ?'⏳ Pending Unlock'
 : isCritical
 ?'⚠️ Expiring Soon!'
 : isUrgent
 ?'⏰ Use Soon'
 : currentPhase === 2
 ?'🎁 Bonus Unlocked!'
 :'✨ Active';

 return (
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.4 }}
 >
 <GradientCard 
 className={`overflow-hidden relative ${
 waitingForPhase2
 ?'bg-gradient-to-r from-accent/20 via-accent/20 to-accent/20 border-accent/30'
 : isCritical 
 ?'bg-gradient-to-r from-destructive/20 via-warning/20 to-warning/20 border-destructive/30' 
 : isUrgent 
 ?'bg-gradient-to-r from-warning/20 via-warning/20 to-warning/20 border-warning/30'
 : currentPhase === 2
 ?'bg-gradient-to-r from-warning/20 via-warning/20 to-success/20 border-warning/30'
 :'bg-gradient-to-r from-success/20 via-success/20 to-info/20 border-success/30'
 }`}
 >
 <div className="flex items-start gap-4">
 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
 waitingForPhase2
 ?'bg-gradient-to-br from-accent to-accent'
 : isCritical 
 ?'bg-gradient-to-br from-destructive to-warning' 
 : isUrgent 
 ?'bg-gradient-to-br from-warning to-warning'
 : currentPhase === 2
 ?'bg-gradient-to-br from-warning to-warning'
 :'bg-gradient-to-br from-success to-success'
 }`}>
 {waitingForPhase2 ? (
 <Sparkles className="w-7 h-7 text-white" />
 ) : (
 <Gift className="w-7 h-7 text-white" />
 )}
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h3 className="text-lg font-bold text-foreground">
 {title}
 </h3>
 <Badge className={`${
 waitingForPhase2
 ?'bg-accent/20 text-accent border-accent/30'
 : isCritical 
 ?'bg-destructive/20 text-destructive border-destructive/30 animate-pulse' 
 : isUrgent 
 ?'bg-warning/20 text-warning border-warning/30'
 : currentPhase === 2
 ?'bg-warning/20 text-warning border-warning/30'
 :'bg-success/20 text-success border-success/30'
 }`}>
 {badgeText}
 </Badge>
 </div>
 
 <p className="text-muted-foreground mb-3">
 <span className="font-bold text-foreground">{description}</span>
 </p>

 {/* Countdown Timer */}
 <div className="flex items-center gap-4 mb-3">
 <div className="flex items-center gap-2">
 <Clock className={`w-4 h-4 ${isCritical ?'text-destructive animate-pulse' : isUrgent ?'text-warning' :'text-muted-foreground'}`} />
 <span className={`text-sm font-medium ${
 isCritical ?'text-destructive' : isUrgent ?'text-warning' :'text-foreground'
 }`}>
 {countdownText}
 </span>
 </div>
 
 <div className="flex-1 max-w-32">
 <Progress 
 value={Math.max(0, Math.min(100, (daysRemaining / 45) * 100))} 
 className={`h-2 ${
 isCritical ?'[&>div]:bg-destructive' : isUrgent ?'[&>div]:bg-warning' :'[&>div]:bg-success'
 }`}
 />
 </div>
 </div>

 {!waitingForPhase2 && (
 <Button 
 onClick={() => navigate('/discover')}
 className={`${
 isCritical 
 ?'bg-gradient-to-r from-destructive to-warning hover:from-destructive hover:to-warning' 
 : isUrgent 
 ?'bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning'
 : currentPhase === 2
 ?'bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning'
 :'bg-gradient-to-r from-success to-success hover:from-success hover:to-success'
 } text-white shadow-md`}
 >
 Find Participating Partners
 <ChevronRight className="w-4 h-4 ml-1" />
 </Button>
 )}
 </div>
 </div>
 </GradientCard>
 </motion.div>
 );
};

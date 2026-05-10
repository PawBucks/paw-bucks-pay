import { motion } from"framer-motion";
import { CheckCircle } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { LoyaltyProgressRing } from"./LoyaltyProgressRing";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import type { LoyaltyMilestone } from"@/services/api/loyalty.service";
import { formatDistanceToNow, isPast } from"date-fns";

interface MilestoneCardProps {
 milestone: LoyaltyMilestone;
 onRedeem?: () => void;
 compact?: boolean;
}

export const MilestoneCard = ({ milestone, onRedeem, compact = false }: MilestoneCardProps) => {
 const isComplete = milestone.status ==='completed';
 const isExpired = milestone.status ==='expired';
 const isRedeemed = milestone.status ==='redeemed';
 const periodEnd = new Date(milestone.period_end);
 const isExpiring = !isPast(periodEnd) && new Date(milestone.period_end).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000; // 30 days

 const remaining = milestone.target_count - milestone.current_count;
 const merchantName = milestone.merchants?.business_name ||'Any Partner';

 if (compact) {
 return (
 <motion.div
 whileHover={{ scale: 1.02 }}
 className={`p-4 rounded-md border ${
 isComplete 
 ?'bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30' 
 :'bg-card border-border'
 }`}
 >
 <div className="flex items-center gap-4">
 <LoyaltyProgressRing 
 current={milestone.current_count} 
 target={milestone.target_count}
 size={56}
 strokeWidth={6}
 >
 <div className="text-center">
 <div className="text-sm font-bold">{milestone.current_count}/{milestone.target_count}</div>
 </div>
 </LoyaltyProgressRing>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm">
 {isComplete 
 ? `🎉 Free $${milestone.credit_value} credit ready!` 
 : `${remaining} more visit${remaining !== 1 ?'s' :''} → Free $${milestone.credit_value} credit`}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 {merchantName}
 </p>
 </div>
 </div>
 </motion.div>
 );
 }

 return (
 <GradientCard gradient={isComplete}>
 <div className="flex items-start gap-4">
 {/* Progress Ring */}
 <LoyaltyProgressRing 
 current={milestone.current_count} 
 target={milestone.target_count}
 size={100}
 strokeWidth={8}
 >
 <div className="text-center">
 <div className="text-2xl font-bold">{milestone.current_count}</div>
 <div className="text-xs text-muted-foreground">of {milestone.target_count}</div>
 </div>
 </LoyaltyProgressRing>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🎁</span>
 <h3 className="font-semibold text-lg">Loyal Pet Parent Guarantee</h3>
 </div>
 
 {/* Merchant info */}
 <div className="flex items-center gap-2 mb-3">
 {milestone.merchants?.logo_url ? (
 <img 
 src={milestone.merchants.logo_url} 
 alt={merchantName}
 className="w-6 h-6 rounded-full object-cover border border-border"
 />
 ) : (
 <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
 <span className="w-3 h-3 text-muted-foreground" aria-hidden="true">🏪</span>
 </div>
 )}
 <span className="text-sm text-muted-foreground">{merchantName}</span>
 </div>

 {/* Status Message */}
 {isComplete && !isRedeemed ? (
 <div className="space-y-2">
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-2 text-primary"
 >
 <Sparkles className="w-5 h-5 animate-pulse" />
 <span className="font-semibold">
 You've unlocked a ${milestone.credit_value} free service credit!
 </span>
 </motion.div>
 {onRedeem && (
 <Button onClick={onRedeem} className="w-full">
 Claim Your Free Credit
 </Button>
 )}
 </div>
 ) : isRedeemed ? (
 <div className="flex items-center gap-2 text-primary">
 <CheckCircle className="w-5 h-5" />
 <span className="font-medium">Credit redeemed!</span>
 </div>
 ) : isExpired ? (
 <div className="text-destructive text-sm">
 This milestone period has expired. Keep visiting to start fresh!
 </div>
 ) : (
 <div className="space-y-2">
 <p className="text-lg">
 <span className="font-bold text-primary">{remaining}</span> more visit{remaining !== 1 ?'s' :''} → 
 <span className="font-bold text-accent"> Free ${milestone.credit_value} service</span>
 </p>
 
 {/* Time remaining */}
 <div className="flex items-center gap-1 text-xs text-muted-foreground">
 <span className="w-3 h-3" aria-hidden="true">⏰</span>
 <span>
 {isExpiring ? (
 <span className="text-warning font-medium">
 Expires {formatDistanceToNow(periodEnd, { addSuffix: true })}
 </span>
 ) : (
 <>Resets {formatDistanceToNow(periodEnd, { addSuffix: true })}</>
 )}
 </span>
 </div>
 </div>
 )}
 </div>
 </div>
 </GradientCard>
 );
};

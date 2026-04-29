import { useNavigate } from"react-router-dom";
import { motion } from"framer-motion";
import { Trophy, ChevronRight, Gift, Zap, Crown, AlertCircle } from"lucide-react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { LoyaltyProgressRing } from"./LoyaltyProgressRing";
import { TierBadge } from"./TierBadge";
import { useLoyaltySummary } from"@/hooks/useLoyaltyData";

interface LoyaltyDashboardWidgetProps {
 userId: string;
}

export const LoyaltyDashboardWidget = ({ userId }: LoyaltyDashboardWidgetProps) => {
 const navigate = useNavigate();
 const { data: summary, isLoading } = useLoyaltySummary(userId);

 if (isLoading) {
 return (
 <GradientCard className="animate-pulse">
 <div className="h-40 bg-muted rounded-md" />
 </GradientCard>
 );
 }

 const tier = summary?.tier?.current_tier ||'silver';
 const milestone = summary?.activeMilestone;
 const completedMilestone = summary?.completedMilestone;
 const hasUrgentWarnings = (summary?.urgentWarnings?.length || 0) > 0;

 return (
 <GradientCard gradient className="cursor-pointer" onClick={() => navigate('/loyalty')}>
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <TierBadge tier={tier as'silver' |'gold' |'platinum'} size="md" />
 <div>
 <h3 className="font-semibold flex items-center gap-2">
 Your Rewards
 {hasUrgentWarnings && (
 <AlertCircle className="w-4 h-4 text-warning animate-pulse" />
 )}
 </h3>
 <p className="text-sm text-muted-foreground capitalize">{tier} Member</p>
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-muted-foreground" />
 </div>

 {/* Main Content - Milestone Progress or Completed */}
 {completedMilestone ? (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="p-4 rounded-md bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 text-center"
 >
 <Gift className="w-10 h-10 mx-auto text-primary mb-2" />
 <p className="text-lg font-bold text-primary mb-1">
 🎉 Free ${completedMilestone.credit_value} Credit Ready!
 </p>
 <p className="text-sm text-muted-foreground">
 Tap to claim your guaranteed reward
 </p>
 </motion.div>
 ) : milestone ? (
 <div className="flex items-center gap-4">
 <LoyaltyProgressRing
 current={milestone.current_count}
 target={milestone.target_count}
 size={80}
 strokeWidth={6}
 >
 <div className="text-center">
 <div className="text-lg font-bold">{milestone.current_count}</div>
 <div className="text-[10px] text-muted-foreground">of {milestone.target_count}</div>
 </div>
 </LoyaltyProgressRing>
 <div className="flex-1">
 <p className="font-medium text-sm mb-1">Loyal Pet Parent Guarantee</p>
 <p className="text-lg">
 <span className="font-bold text-primary">{milestone.target_count - milestone.current_count}</span>
 {""}more visit{milestone.target_count - milestone.current_count !== 1 ?'s' :''} →
 <span className="font-bold text-accent"> Free ${milestone.credit_value}</span>
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {milestone.merchants?.business_name ||'Any partner merchant'}
 </p>
 </div>
 </div>
 ) : (
 <div className="text-center py-4">
 <Trophy className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
 <p className="text-sm text-muted-foreground">
 Start earning rewards with your first purchase!
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 12 visits = guaranteed free service
 </p>
 </div>
 )}

 {/* Stats Row */}
 <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-primary mb-1">
 <Gift className="w-4 h-4" />
 <span className="font-bold">${summary?.totalCredits?.toFixed(0) || 0}</span>
 </div>
 <p className="text-[10px] text-muted-foreground">Credits Available</p>
 </div>
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-accent mb-1">
 <Zap className="w-4 h-4" />
 <span className="font-bold">{summary?.monthlyStreak || 0}</span>
 </div>
 <p className="text-[10px] text-muted-foreground">Month Streak</p>
 </div>
 <div className="text-center">
 <div className="flex items-center justify-center gap-1 text-secondary mb-1">
 <Crown className="w-4 h-4" />
 <span className="font-bold capitalize">{tier}</span>
 </div>
 <p className="text-[10px] text-muted-foreground">Your Tier</p>
 </div>
 </div>

 {/* CTA */}
 <Button variant="ghost" size="sm" className="w-full mt-3 text-primary">
 View All Rewards <ChevronRight className="w-4 h-4 ml-1" />
 </Button>
 </GradientCard>
 );
};

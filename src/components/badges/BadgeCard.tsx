import { motion } from"framer-motion";
import { cn } from"@/lib/utils";
import { Badge } from"@/components/ui/badge";
import { CheckCircle } from "lucide-react";

import { Formatters } from "@/utils/formatters";
interface BadgeCardProps {
 badge: {
 id: string;
 badge_key: string;
 name: string;
 description: string;
 emoji: string;
 reward_description?: string;
 threshold_amount: number;
 threshold_period: string;
 };
 earned?: {
 earned_at: string;
 reward_expires_at?: string;
 reward_claimed: boolean;
 } | null;
 progress?: {
 current_amount: number;
 } | null;
 onClick?: () => void;
 compact?: boolean;
}

export const BadgeCard = ({ badge, earned, progress, onClick, compact = false }: BadgeCardProps) => {
 const isEarned = !!earned;
 const progressPercent = progress 
 ? Math.min(100, (progress.current_amount / badge.threshold_amount) * 100)
 : 0;
 
 const rewardExpired = earned?.reward_expires_at 
 ? new Date(earned.reward_expires_at) < new Date()
 : false;

 const timeRemaining = earned?.reward_expires_at 
 ? getTimeRemaining(earned.reward_expires_at)
 : null;

 if (compact) {
 return (
 <motion.div
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 onClick={onClick}
 className={cn(
"relative flex flex-col items-center justify-center p-3 rounded-md border cursor-pointer transition-all",
 isEarned 
 ?"bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30 shadow-lg" 
 :"bg-muted/30 border-border/50 opacity-60"
 )}
 >
 <span className="text-3xl">{badge.emoji}</span>
 <span className="text-xs font-medium mt-1 text-center line-clamp-1">{badge.name}</span>
 {isEarned && (
 <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-primary fill-background" />
 )}
 </motion.div>
 );
 }

 return (
 <motion.div
 whileHover={{ scale: 1.02, y: -2 }}
 whileTap={{ scale: 0.98 }}
 onClick={onClick}
 className={cn(
"relative p-4 rounded-md border cursor-pointer transition-all",
 isEarned 
 ?"bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 border-primary/30 shadow-lg" 
 :"bg-card border-border hover:border-primary/30"
 )}
 >
 {/* Badge Icon & Name */}
 <div className="flex items-start gap-3">
 <div className={cn(
"w-14 h-14 rounded-md flex items-center justify-center text-3xl",
 isEarned 
 ?"bg-gradient-to-br from-primary/30 to-accent/30 shadow-inner" 
 :"bg-muted"
 )}>
 {badge.emoji}
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold text-foreground">{badge.name}</h3>
 {isEarned && (
 <Badge variant="default" className="text-[10px] px-1.5 py-0">Earned!</Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground line-clamp-1">{badge.description}</p>
 </div>
 </div>

 {/* Progress or Reward */}
 {isEarned ? (
 <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
 <div className="flex items-center gap-2 text-sm">
 <span className="w-4 h-4 text-primary" aria-hidden="true">🎁</span>
 <span className="text-primary font-medium">{badge.reward_description}</span>
 </div>
 {timeRemaining && !rewardExpired && !earned.reward_claimed && (
 <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
 <span className="w-3 h-3" aria-hidden="true">⏰</span>
 <span>{timeRemaining} left to claim</span>
 </div>
 )}
 {rewardExpired && !earned.reward_claimed && (
 <div className="text-xs text-destructive mt-1">Reward expired</div>
 )}
 {earned.reward_claimed && (
 <div className="flex items-center gap-1 mt-1 text-xs text-primary">
 <CheckCircle className="w-3 h-3" />
 <span>Reward claimed!</span>
 </div>
 )}
 </div>
 ) : (
 <div className="mt-3">
 <div className="flex justify-between text-xs text-muted-foreground mb-1">
 <span>Progress this {badge.threshold_period}</span>
              <span>{Formatters.currency(progress?.current_amount || 0)} / {Formatters.currency(badge.threshold_amount)}</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <motion.div 
 initial={{ width: 0 }}
 animate={{ width: `${progressPercent}%` }}
 transition={{ duration: 0.5, ease:"easeOut" }}
 className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
 />
 </div>
 </div>
 )}
 </motion.div>
 );
};

function getTimeRemaining(expiresAt: string): string {
 const now = new Date();
 const expires = new Date(expiresAt);
 const diff = expires.getTime() - now.getTime();
 
 if (diff <= 0) return'';
 
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 
 if (hours >= 24) {
 const days = Math.floor(hours / 24);
 return `${days}d ${hours % 24}h`;
 }
 
 return `${hours}h ${minutes}m`;
}

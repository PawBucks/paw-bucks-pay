import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { motion, AnimatePresence } from"framer-motion";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { BadgeCard } from"./BadgeCard";
import { ChevronRight, Target } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";

interface BadgeDefinition {
 id: string;
 badge_key: string;
 name: string;
 description: string;
 emoji: string;
 threshold_amount: number;
 threshold_period: string;
 reward_description: string | null;
}

interface UserBadge {
 id: string;
 badge_id: string;
 earned_at: string;
 reward_claimed: boolean;
 reward_expires_at: string | null;
 guilt_badge_definitions: BadgeDefinition;
}

interface BadgeTeaserProps {
 userId: string;
}

export const BadgeTeaser = ({ userId }: BadgeTeaserProps) => {
 const navigate = useNavigate();
 const [recentBadges, setRecentBadges] = useState<UserBadge[]>([]);
 const [totalBadges, setTotalBadges] = useState(0);
 const [earnedCount, setEarnedCount] = useState(0);
 const [activeRewards, setActiveRewards] = useState(0);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 fetchBadgeData();

 // Subscribe to realtime updates
 const channel = supabase
 .channel('badge-teaser-updates')
 .on(
'postgres_changes',
 {
 event:'INSERT',
 schema:'public',
 table:'user_guilt_badges',
 filter: `user_id=eq.${userId}`,
 },
 () => {
 fetchBadgeData();
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [userId]);

 const fetchBadgeData = async () => {
 try {
 // Fetch recent earned badges with definitions
 const { data: recent } = await supabase
 .from('user_guilt_badges')
 .select(`
 id,
 badge_id,
 earned_at,
 reward_claimed,
 reward_expires_at,
 guilt_badge_definitions (
 id,
 badge_key,
 name,
 description,
 emoji,
 threshold_amount,
 threshold_period,
 reward_description
 )
 `)
 .eq('user_id', userId)
 .order('earned_at', { ascending: false })
 .limit(3);

 // Get total badge count
 const { count: total } = await supabase
 .from('guilt_badge_definitions')
 .select('*', { count:'exact', head: true })
 .eq('is_active', true);

 // Get earned count
 const { count: earned } = await supabase
 .from('user_guilt_badges')
 .select('*', { count:'exact', head: true })
 .eq('user_id', userId);

 // Count active rewards
 const activeCount = (recent || []).filter(b => {
 if (b.reward_claimed) return false;
 if (!b.reward_expires_at) return false;
 return new Date(b.reward_expires_at) > new Date();
 }).length;

 setRecentBadges(recent as unknown as UserBadge[] || []);
 setTotalBadges(total || 0);
 setEarnedCount(earned || 0);
 setActiveRewards(activeCount);
 } catch (error) {
 console.error('Error fetching badge data:', error);
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return (
 <GradientCard className="animate-pulse">
 <div className="h-32 bg-muted rounded-md" />
 </GradientCard>
 );
 }

 return (
 <GradientCard 
 gradient 
 onClick={() => navigate('/badges')}
 className="cursor-pointer"
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
 <span className="w-5 h-5 text-primary-foreground" aria-hidden="true">🏆</span>
 </div>
 <div>
 <h3 className="font-semibold flex items-center gap-2">
 Guilt-Free Badges
 {activeRewards > 0 && (
 <Badge variant="default" className="text-[10px] animate-pulse">
 {activeRewards} Active Reward{activeRewards > 1 ?'s' :''}!
 </Badge>
 )}
 </h3>
 <p className="text-sm text-muted-foreground">
 Your guilt is a secret superpower ✨
 </p>
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-muted-foreground" />
 </div>

 {/* Badge Showcase */}
 {recentBadges.length > 0 ? (
 <div className="space-y-3">
 {/* Recent Badges Row */}
 <div className="flex items-center gap-2 overflow-x-auto pb-2">
 {recentBadges.map((badge, index) => (
 <motion.div
 key={badge.id}
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: index * 0.1 }}
 className="flex-shrink-0"
 >
 <div className="w-14 h-14 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center text-2xl shadow-lg">
 {badge.guilt_badge_definitions.emoji}
 </div>
 </motion.div>
 ))}
 {earnedCount > 3 && (
 <div className="flex-shrink-0 w-14 h-14 rounded-md bg-muted border border-border flex items-center justify-center text-sm font-medium text-muted-foreground">
 +{earnedCount - 3}
 </div>
 )}
 </div>

 {/* Progress Text */}
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">
 You've earned <span className="text-primary font-semibold">{earnedCount}</span> of {totalBadges} badges this month!
 </span>
 <Button variant="ghost" size="sm" className="text-primary gap-1">
 View All <ChevronRight className="w-4 h-4" />
 </Button>
 </div>
 </div>
 ) : (
 <div className="text-center py-4">
 <Target className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
 <p className="text-sm text-muted-foreground">
 Start spending at partner merchants to earn badges!
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Each badge unlocks exclusive rewards 🎁
 </p>
 </div>
 )}

 {/* CTA Banner for Active Rewards */}
 <AnimatePresence>
 {activeRewards > 0 && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height:'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="mt-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30"
 >
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-primary animate-pulse" />
 <span className="text-sm font-medium">
 You have {activeRewards} reward{activeRewards > 1 ?'s' :''} waiting! Tap to claim before {activeRewards > 1 ?'they' :'it'} expire{activeRewards > 1 ?'' :'s'}.
 </span>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </GradientCard>
 );
};

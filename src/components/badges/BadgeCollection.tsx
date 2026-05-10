import { useState, useEffect } from"react";
import { motion, AnimatePresence } from"framer-motion";
import { supabase } from"@/integrations/supabase/client";
import { BadgeCard } from"./BadgeCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";

interface BadgeDefinition {
 id: string;
 badge_key: string;
 name: string;
 description: string;
 emoji: string;
 category: string;
 threshold_amount: number;
 threshold_period: string;
 reward_type: string | null;
 reward_value: number | null;
 reward_description: string | null;
 reward_duration_hours: number;
}

interface UserBadge {
 id: string;
 badge_id: string;
 earned_at: string;
 spending_amount: number;
 reward_claimed: boolean;
 reward_expires_at: string | null;
}

interface BadgeProgress {
 badge_id: string;
 current_amount: number;
 period_start: string;
 period_end: string;
}

interface BadgeCollectionProps {
 userId: string;
 onBadgeClick?: (badge: BadgeDefinition, earned: UserBadge | null) => void;
}

export const BadgeCollection = ({ userId, onBadgeClick }: BadgeCollectionProps) => {
 const [badges, setBadges] = useState<BadgeDefinition[]>([]);
 const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
 const [progress, setProgress] = useState<BadgeProgress[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState("all");

 useEffect(() => {
 fetchBadgeData();
 
 // Subscribe to realtime updates
 const channel = supabase
 .channel('badge-updates')
 .on(
'postgres_changes',
 {
 event:'*',
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
 // Fetch all badge definitions
 const { data: badgeDefs } = await supabase
 .from('guilt_badge_definitions')
 .select('*')
 .eq('is_active', true)
 .order('display_order');

 // Fetch user's earned badges
 const { data: userBadges } = await supabase
 .from('user_guilt_badges')
 .select('*')
 .eq('user_id', userId)
 .order('earned_at', { ascending: false });

 // Fetch current progress
 const { data: progressData } = await supabase
 .from('guilt_badge_progress')
 .select('*')
 .eq('user_id', userId);

 setBadges(badgeDefs || []);
 setEarnedBadges(userBadges || []);
 setProgress(progressData || []);
 } catch (error) {
 console.error('Error fetching badge data:', error);
 } finally {
 setLoading(false);
 }
 };

 const getEarnedBadge = (badgeId: string): UserBadge | null => {
 return earnedBadges.find(eb => eb.badge_id === badgeId) || null;
 };

 const getProgress = (badgeId: string): BadgeProgress | null => {
 return progress.find(p => p.badge_id === badgeId) || null;
 };

 const earnedBadgeIds = new Set(earnedBadges.map(eb => eb.badge_id));
 const earnedBadgeList = badges.filter(b => earnedBadgeIds.has(b.id));
 const inProgressBadges = badges.filter(b => !earnedBadgeIds.has(b.id));
 
 // Badges with active rewards
 const activeRewardBadges = earnedBadges.filter(eb => {
 if (eb.reward_claimed) return false;
 if (!eb.reward_expires_at) return false;
 return new Date(eb.reward_expires_at) > new Date();
 });

 const totalEarned = earnedBadges.length;
 const totalBadges = badges.length;

 if (loading) {
 return (
 <div className="space-y-4">
 {[1, 2, 3].map(i => (
 <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
 ))}
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Stats Header */}
 <div className="grid grid-cols-3 gap-3">
 <div className="p-3 rounded-md bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center">
 <span className="w-5 h-5 mx-auto text-primary mb-1" aria-hidden="true">🏆</span>
 <div className="text-2xl font-bold text-primary">{totalEarned}</div>
 <div className="text-xs text-muted-foreground">Earned</div>
 </div>
 <div className="p-3 rounded-md bg-muted border border-border text-center">
 <span className="w-5 h-5 mx-auto text-muted-foreground mb-1" aria-hidden="true">🎯</span>
 <div className="text-2xl font-bold">{totalBadges - totalEarned}</div>
 <div className="text-xs text-muted-foreground">To Unlock</div>
 </div>
 <div className="p-3 rounded-md bg-gradient-to-br from-accent/10 to-secondary/10 border border-accent/20 text-center">
 <span className="w-5 h-5 mx-auto text-accent mb-1" aria-hidden="true">⏰</span>
 <div className="text-2xl font-bold text-accent">{activeRewardBadges.length}</div>
 <div className="text-xs text-muted-foreground">Active Rewards</div>
 </div>
 </div>

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="all">All Badges</TabsTrigger>
 <TabsTrigger value="earned">
 Earned ({earnedBadgeList.length})
 </TabsTrigger>
 <TabsTrigger value="progress">
 In Progress ({inProgressBadges.length})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="all" className="mt-4">
 <AnimatePresence>
 <div className="space-y-3">
 {badges.map((badge, index) => (
 <motion.div
 key={badge.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 >
 <BadgeCard
 badge={badge}
 earned={getEarnedBadge(badge.id)}
 progress={getProgress(badge.id)}
 onClick={() => onBadgeClick?.(badge, getEarnedBadge(badge.id))}
 />
 </motion.div>
 ))}
 </div>
 </AnimatePresence>
 </TabsContent>

 <TabsContent value="earned" className="mt-4">
 <AnimatePresence>
 {earnedBadgeList.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <span className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true">🏆</span>
 <p>No badges earned yet!</p>
 <p className="text-sm">Keep spending at partner merchants to unlock badges.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {earnedBadgeList.map((badge, index) => (
 <motion.div
 key={badge.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 >
 <BadgeCard
 badge={badge}
 earned={getEarnedBadge(badge.id)}
 progress={getProgress(badge.id)}
 onClick={() => onBadgeClick?.(badge, getEarnedBadge(badge.id))}
 />
 </motion.div>
 ))}
 </div>
 )}
 </AnimatePresence>
 </TabsContent>

 <TabsContent value="progress" className="mt-4">
 <AnimatePresence>
 {inProgressBadges.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <span className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true">🎯</span>
 <p>You've earned all available badges!</p>
 <p className="text-sm">Check back next week for new opportunities.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {inProgressBadges.map((badge, index) => (
 <motion.div
 key={badge.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 >
 <BadgeCard
 badge={badge}
 earned={null}
 progress={getProgress(badge.id)}
 onClick={() => onBadgeClick?.(badge, null)}
 />
 </motion.div>
 ))}
 </div>
 )}
 </AnimatePresence>
 </TabsContent>
 </Tabs>
 </div>
 );
};

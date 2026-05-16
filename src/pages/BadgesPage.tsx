import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { motion } from"framer-motion";
import { useAuth } from"@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { BottomNav } from"@/components/BottomNav";
import { BadgeCollection } from"@/components/badges";
import { Button } from"@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from"@/components/ui/dialog";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
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

const BadgesPage = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
 const navigate = useNavigate();
 const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
 const [selectedEarned, setSelectedEarned] = useState<UserBadge | null>(null);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [claiming, setClaiming] = useState(false);

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const handleSignOut = async () => {
 await signOut();
 navigate("/auth");
 };

 const handleBadgeClick = (badge: BadgeDefinition, earned: UserBadge | null) => {
 setSelectedBadge(badge);
 setSelectedEarned(earned);
 setDialogOpen(true);
 };

 const handleClaimReward = async () => {
 if (!selectedBadge || !selectedEarned || !user) return;
 
 setClaiming(true);
 try {
 // For percentage/fixed discounts, we mark as claimed and they can use it at checkout
 // For PawBucks bonuses, they're auto-claimed when badge is earned
 
 const { error } = await supabase
 .from('user_guilt_badges')
 .update({ 
 reward_claimed: true,
 reward_claimed_at: new Date().toISOString()
 })
 .eq('id', selectedEarned.id);

 if (error) throw error;

 // Update the reward status
 await supabase
 .from('guilt_badge_rewards')
 .update({ 
 status:'used',
 used_at: new Date().toISOString()
 })
 .eq('user_badge_id', selectedEarned.id);

 toast.success(`${selectedBadge.emoji} Reward claimed! ${selectedBadge.reward_description}`);
 setDialogOpen(false);
 
 // Refresh the page data
 window.location.reload();
 } catch (error) {
 console.error('Error claiming reward:', error);
 toast.error('Failed to claim reward. Please try again.');
 } finally {
 setClaiming(false);
 }
 };

 const rewardExpired = selectedEarned?.reward_expires_at 
 ? new Date(selectedEarned.reward_expires_at) < new Date()
 : false;

 const canClaim = selectedEarned && 
 !selectedEarned.reward_claimed && 
 !rewardExpired && 
 selectedBadge?.reward_type;

 if (authLoading || !user) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 return (
 <>
 <SEO 
 title="Guilt-Free Badges - PawBucks"
 description="Turn your pet spending guilt into collectible badges and unlock exclusive rewards!"
 keywords={["pet badges","rewards","gamification","pet spending"]}
 noIndex={true}
 />
 <div className="min-h-[100dvh] bg-background flex flex-col">
 <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
 
 <main className="flex-1 container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-4xl lg:max-w-6xl">
 {/* Back Button & Title */}
 <div className="mb-6">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => navigate('/home')}
 className="mb-4 -ml-2"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Dashboard
 </Button>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-center"
 >
 <h1 className="text-3xl font-bold mb-2">
 <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
 Guilt-Free Badges
 </span>
 </h1>
 <p className="text-muted-foreground">
 Your guilt is a secret superpower. Turn every splurge into a badge of honor! 🎖️
 </p>
 </motion.div>
 </div>

 {/* Motivational Quote */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.1 }}
 className="mb-6 p-4 rounded-md bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border border-primary/20 text-center"
 >
 <Sparkles className="w-6 h-6 mx-auto text-primary mb-2" />
 <p className="text-sm font-medium">
"Spoiling your pet isn't a guilt trip — it's a badge of honor."
 </p>
 </motion.div>

 {/* Badge Collection */}
 <BadgeCollection userId={effectiveUserId || user.id} onBadgeClick={handleBadgeClick} />
 </main>
 
 <BottomNav />

 {/* Badge Detail Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="sm:max-w-md">
 {selectedBadge && (
 <>
 <DialogHeader className="text-center">
 <div className="w-20 h-20 mx-auto mb-3 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center text-5xl">
 {selectedBadge.emoji}
 </div>
 <DialogTitle className="text-xl">{selectedBadge.name}</DialogTitle>
 <DialogDescription>{selectedBadge.description}</DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4">
 {/* Badge Details */}
 <div className="p-3 rounded-lg bg-muted">
 <div className="text-sm text-muted-foreground">
 <p><strong>Threshold:</strong> ${selectedBadge.threshold_amount} per {selectedBadge.threshold_period}</p>
 <p><strong>Category:</strong> {selectedBadge.category}</p>
 </div>
 </div>

 {/* Earned Status */}
 {selectedEarned ? (
 <div className="p-4 rounded-md bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
 <div className="flex items-center gap-2 text-primary mb-2">
 <CheckCircle className="w-5 h-5" />
 <span className="font-semibold">Badge Earned!</span>
 </div>
 <p className="text-sm text-muted-foreground">
 Earned on {new Date(selectedEarned.earned_at).toLocaleDateString()} by spending {Formatters.currency(selectedEarned.spending_amount)}
 </p>
 </div>
 ) : (
 <div className="p-4 rounded-md bg-muted border border-border text-center">
 <p className="text-muted-foreground">
 Keep spending in the {selectedBadge.category} category to unlock this badge!
 </p>
 </div>
 )}

 {/* Reward Section */}
 {selectedBadge.reward_description && selectedEarned && (
 <div className="p-4 rounded-md bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
 <div className="flex items-center gap-2 mb-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🎁</span>
 <span className="font-semibold">Your Reward</span>
 </div>
 <p className="text-sm mb-3">{selectedBadge.reward_description}</p>
 
 {selectedEarned.reward_claimed ? (
 <div className="flex items-center gap-2 text-sm text-primary">
 <CheckCircle className="w-4 h-4" />
 <span>Reward claimed!</span>
 </div>
 ) : rewardExpired ? (
 <div className="text-sm text-destructive">
 Reward expired
 </div>
 ) : (
 <>
 {selectedEarned.reward_expires_at && (
 <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
 <span className="w-3 h-3" aria-hidden="true">⏰</span>
 <span>Expires: {new Date(selectedEarned.reward_expires_at).toLocaleString()}</span>
 </div>
 )}
 <Button 
 onClick={handleClaimReward} 
 disabled={claiming}
 className="w-full"
 >
 {claiming ?'Claiming...' :'Claim Reward'}
 </Button>
 </>
 )}
 </div>
 )}
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>
 </div>
 </>
 );
};

export default BadgesPage;

import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { motion, AnimatePresence } from"framer-motion";
import { useAuth } from"@/hooks/useAuth";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { BottomNav } from"@/components/BottomNav";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { GradientCard } from"@/components/ui/gradient-card";
import { 
 ArrowLeft, 
 Gift, 
 Trophy, 
 Crown, 
 Zap, 
 Star,
 CheckCircle,
 Lock,
 ChevronRight
} from"lucide-react";
import { 
 TierBadge, 
 MilestoneCard, 
 ServiceCreditCard,
 LoyaltyWarningBanner,
 LoyaltyProgressRing
} from"@/components/loyalty";
import { 
 useLoyaltySummary, 
 useTierDefinitions, 
 useUserMilestones,
 useUserCredits,
 useLoyaltyWarnings,
 useUserPersonalityPerks
} from"@/hooks/useLoyaltyData";
import { loyaltyService } from"@/services/api/loyalty.service";
import { toast } from"sonner";

const LoyaltyPage = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [activeTab, setActiveTab] = useState("overview");

 const { data: summary, refetch: refetchSummary } = useLoyaltySummary(user?.id);
 const { data: tierDefinitions } = useTierDefinitions();
 const { data: milestones, refetch: refetchMilestones } = useUserMilestones(user?.id);
 const { data: credits, refetch: refetchCredits } = useUserCredits(user?.id);
 const { data: warnings, refetch: refetchWarnings } = useLoyaltyWarnings(user?.id);
 const { data: perks } = useUserPersonalityPerks(user?.id);

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const handleSignOut = async () => {
 await signOut();
 navigate("/auth");
 };

 const handleDismissWarning = async (id: string) => {
 try {
 await loyaltyService.dismissWarning(id);
 refetchWarnings();
 toast.success("Notification dismissed");
 } catch (error) {
 console.error("Error dismissing warning:", error);
 }
 };

 const currentTier = summary?.tier?.current_tier ||'silver';
 const currentTierDef = tierDefinitions?.data?.find(t => t.tier === currentTier);
 const nextTierDef = tierDefinitions?.data?.find(t => {
 if (currentTier ==='silver') return t.tier ==='gold';
 if (currentTier ==='gold') return t.tier ==='platinum';
 return false;
 });

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
 title="My Rewards - PawBucks"
 description="Track your loyalty rewards, tier status, and free service credits!"
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
 onClick={() => navigate('/dashboard')}
 className="mb-4 -ml-2"
 >
 <ArrowLeft className="w-4 h-4 mr-1" />
 Back to Dashboard
 </Button>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-4"
 >
 <TierBadge tier={currentTier as'silver' |'gold' |'platinum'} size="lg" />
 <div>
 <h1 className="text-2xl font-bold">
 Your Rewards
 </h1>
 <p className="text-muted-foreground capitalize">
 {currentTier} Member • {summary?.monthlyStreak || 0} month streak
 </p>
 </div>
 </motion.div>
 </div>

 {/* Warnings */}
 {warnings?.data && warnings.data.length > 0 && (
 <div className="mb-6">
 <LoyaltyWarningBanner 
 warnings={warnings.data}
 onDismiss={handleDismissWarning}
 onAction={(w) => {
 if (w.related_entity_type ==='milestone') {
 setActiveTab('milestones');
 } else if (w.related_entity_type ==='credit') {
 setActiveTab('credits');
 }
 }}
 />
 </div>
 )}

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-4">
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="milestones">Progress</TabsTrigger>
 <TabsTrigger value="credits">Credits</TabsTrigger>
 <TabsTrigger value="tiers">Tiers</TabsTrigger>
 </TabsList>

 {/* Overview Tab */}
 <TabsContent value="overview" className="mt-6 space-y-6">
 {/* Stats Cards */}
 <div className="grid grid-cols-2 gap-4">
 <GradientCard className="text-center">
 <Gift className="w-8 h-8 mx-auto text-primary mb-2" />
 <div className="text-2xl font-bold text-primary">
                  {Formatters.currency(summary?.totalCredits || 0)}
 </div>
 <p className="text-sm text-muted-foreground">Available Credits</p>
 </GradientCard>
 <GradientCard className="text-center">
 <Zap className="w-8 h-8 mx-auto text-accent mb-2" />
 <div className="text-2xl font-bold text-accent">
 {summary?.monthlyStreak || 0}
 </div>
 <p className="text-sm text-muted-foreground">Month Streak</p>
 </GradientCard>
 </div>

 {/* Active Milestone */}
 {(summary?.activeMilestone || summary?.completedMilestone) && (
 <div>
 <h3 className="font-semibold mb-3 flex items-center gap-2">
 <Trophy className="w-5 h-5 text-primary" />
 Loyal Pet Parent Guarantee
 </h3>
 <MilestoneCard 
 milestone={summary.completedMilestone || summary.activeMilestone!}
 />
 </div>
 )}

 {/* Quick Stats */}
 <div className="p-4 rounded-md bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border border-primary/10">
 <h4 className="font-semibold mb-3">Why You'll Never Pay Full Price</h4>
 <ul className="space-y-2 text-sm">
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-primary" />
 <span>12 visits = guaranteed free service ($50 value)</span>
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-primary" />
 <span>Earn badges for instant rewards</span>
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-primary" />
 <span>Higher tiers = bigger annual credits</span>
 </li>
 <li className="flex items-center gap-2">
 <CheckCircle className="w-4 h-4 text-primary" />
 <span>Personality perks unlock exclusive deals</span>
 </li>
 </ul>
 </div>

 {/* Personality Perks Teaser */}
 {perks?.data && perks.data.length > 0 && (
 <GradientCard gradient>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Star className="w-8 h-8 text-primary" />
 <div>
 <h4 className="font-semibold">Personality Perks Active</h4>
 <p className="text-sm text-muted-foreground">
 {perks.data.filter(p => p.status ==='available').length} perks available to claim
 </p>
 </div>
 </div>
 <Button variant="ghost" size="sm" onClick={() => navigate('/badges')}>
 <ChevronRight className="w-5 h-5" />
 </Button>
 </div>
 </GradientCard>
 )}
 </TabsContent>

 {/* Milestones Tab */}
 <TabsContent value="milestones" className="mt-6 space-y-4">
 <div className="text-center p-4 rounded-md bg-muted/30 border border-border mb-4">
 <Trophy className="w-10 h-10 mx-auto text-primary mb-2" />
 <h3 className="font-semibold">Loyal Pet Parent Guarantee</h3>
 <p className="text-sm text-muted-foreground">
 Complete 12 qualifying visits in 12 months to unlock a <strong>free $50 service credit</strong>
 </p>
 </div>

 {milestones?.data && milestones.data.length > 0 ? (
 <div className="space-y-4">
 {milestones.data.map((milestone) => (
 <MilestoneCard key={milestone.id} milestone={milestone} />
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>No active milestones yet</p>
 <p className="text-sm">Make your first purchase to start tracking!</p>
 </div>
 )}
 </TabsContent>

 {/* Credits Tab */}
 <TabsContent value="credits" className="mt-6 space-y-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold">Your Service Credits</h3>
 <div className="text-right">
 <div className="text-2xl font-bold text-primary">
                  {Formatters.currency(summary?.totalCredits || 0)}
 </div>
 <p className="text-xs text-muted-foreground">Total Available</p>
 </div>
 </div>

 {credits?.data && credits.data.length > 0 ? (
 <div className="space-y-3">
 {credits.data.map((credit) => (
 <ServiceCreditCard key={credit.id} credit={credit} />
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>No credits available yet</p>
 <p className="text-sm">Complete milestones and earn badges to get free credits!</p>
 </div>
 )}
 </TabsContent>

 {/* Tiers Tab */}
 <TabsContent value="tiers" className="mt-6 space-y-4">
 {tierDefinitions?.data?.map((tierDef, index) => {
 const isCurrentTier = tierDef.tier === currentTier;
 const isLocked = 
 (currentTier ==='silver' && tierDef.tier !=='silver') ||
 (currentTier ==='gold' && tierDef.tier ==='platinum');

 return (
 <motion.div
 key={tierDef.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.1 }}
 >
 <GradientCard 
 gradient={isCurrentTier}
 className={isLocked ?'opacity-60' :''}
 >
 <div className="flex items-start gap-4">
 <TierBadge 
 tier={tierDef.tier as'silver' |'gold' |'platinum'} 
 size="lg" 
 />
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-semibold text-lg">{tierDef.display_name}</h3>
 {isCurrentTier && (
 <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
 Current
 </span>
 )}
 {isLocked && (
 <Lock className="w-4 h-4 text-muted-foreground" />
 )}
 </div>
 <p className="text-sm text-muted-foreground mb-3">
 {tierDef.description}
 </p>
 
 {/* Requirements */}
 <div className="text-xs text-muted-foreground mb-3">
 <p>• {tierDef.min_consecutive_months}+ consecutive active months</p>
 <p>• {tierDef.min_badges_per_year}+ badges per year</p>
 <p>• {tierDef.min_transactions_per_year}+ transactions per year</p>
 </div>

 {/* Benefits */}
 <div className="p-3 rounded-lg bg-muted">
 <p className="text-sm font-medium mb-2">Benefits:</p>
 <ul className="text-xs space-y-1">
 {tierDef.annual_free_credit_value > 0 && (
 <li className="flex items-center gap-2">
 <Gift className="w-3 h-3 text-primary" />
 <span>${tierDef.annual_free_credit_value} annual free credit</span>
 </li>
 )}
 <li className="flex items-center gap-2">
 <Zap className="w-3 h-3 text-accent" />
 <span>{tierDef.reward_multiplier}x reward multiplier</span>
 </li>
 {tierDef.priority_offers && (
 <li className="flex items-center gap-2">
 <Star className="w-3 h-3 text-secondary" />
 <span>Priority merchant offers</span>
 </li>
 )}
 </ul>
 </div>
 </div>
 </div>
 </GradientCard>
 </motion.div>
 );
 })}

 {/* Tier Progress */}
 {nextTierDef && (
 <div className="p-4 rounded-md bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-center">
 <p className="text-sm mb-2">
 Progress to <strong className="capitalize">{nextTierDef.tier}</strong>
 </p>
 <div className="flex justify-center gap-4 text-xs text-muted-foreground">
 <div>
 <span className="font-bold text-foreground">
 {summary?.tier?.consecutive_active_months || 0}
 </span>
 /{nextTierDef.min_consecutive_months} months
 </div>
 <div>
 <span className="font-bold text-foreground">
 {summary?.tier?.badges_earned_this_year || 0}
 </span>
 /{nextTierDef.min_badges_per_year} badges
 </div>
 <div>
 <span className="font-bold text-foreground">
 {summary?.tier?.transactions_this_year || 0}
 </span>
 /{nextTierDef.min_transactions_per_year} transactions
 </div>
 </div>
 </div>
 )}
 </TabsContent>
 </Tabs>
 </main>
 
 <BottomNav />
 </div>
 </>
 );
};

export default LoyaltyPage;

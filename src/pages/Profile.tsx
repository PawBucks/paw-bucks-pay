import { useEffect, useState, useCallback, useMemo } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useSubscription } from"@/hooks/useSubscription";
import { usePullToRefresh } from"@/hooks/usePullToRefresh";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Label } from"@/components/ui/label";
import { Avatar, AvatarFallback } from"@/components/ui/avatar";
import { Badge } from"@/components/ui/badge";
import { BottomNav } from"@/components/BottomNav";
import { AdPlacement } from"@/components/AdPlacement";
import { FeedbackButton } from"@/components/FeedbackButton";
import { PullToRefresh } from"@/components/PullToRefresh";
import { DeleteMyAccountCard } from"@/components/profile/DeleteMyAccountCard";
import { LogOut, Settings, Loader2, Info } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { toast } from"sonner";
import { format } from"date-fns";
import { getSubscriptionTier } from"@/lib/constants";

type Profile = {
 full_name: string;
 email: string;
 user_type: string;
 created_at: string;
};

const Profile = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const { subscription, loading: subLoading, createCheckout, manageSubscription } = useSubscription();
 const navigate = useNavigate();
 const [profile, setProfile] = useState<Profile | null>(null);
 const [loading, setLoading] = useState(true);
 const [isSubscribing, setIsSubscribing] = useState(false);
 const [feedbackOpen, setFeedbackOpen] = useState(false);

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 useEffect(() => {
 if (user) {
 loadProfile();
 }
 }, [user]);

 const loadProfile = useCallback(async () => {
 if (!user) return;

 try {
 const { data, error } = await supabase
 .from("profiles")
 .select("*")
 .eq("id", user.id)
 .single();

 if (error) throw error;
 setProfile(data);
 } catch (error) {
 console.error("Error loading profile:", error);
 toast.error("Failed to load profile");
 } finally {
 setLoading(false);
 }
 }, [user]);

 const handleSignOut = useCallback(async () => {
 await signOut();
 navigate("/auth");
 }, [signOut, navigate]);

 const handleSubscribe = async (tier:'basic' |'plus') => {
 setIsSubscribing(true);
 try {
 const checkoutUrl = await createCheckout(tier);
 if (checkoutUrl) {
 toast.success("Redirecting to checkout...");
 // Use window.open with _top target to work in iframe contexts (like Lovable preview)
 // This ensures the navigation happens at the top-level window, not within the iframe
 const opened = window.open(checkoutUrl,'_top');
 // Fallback if window.open fails (popup blocker, etc.)
 if (!opened) {
 window.location.assign(checkoutUrl);
 }
 } else {
 throw new Error('No checkout URL received');
 }
 } catch (error) {
 console.error("Subscription error:", error);
 toast.error("Failed to start subscription. Please try again.");
 setIsSubscribing(false);
 }
 };

 const handleManageSubscription = async () => {
 try {
 await manageSubscription();
 toast.success("Opening subscription management...");
 } catch (error) {
 console.error("Portal error:", error);
 toast.error("Failed to open subscription portal. Please try again.");
 }
 };

 // Pull to refresh
 const handleRefresh = useCallback(async () => {
 setLoading(true);
 await loadProfile();
 }, [loadProfile]);

 const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
 onRefresh: handleRefresh,
 });

 if (loading || authLoading || !profile) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <p className="text-muted-foreground">Loading...</p>
 </div>
 );
 }

 const initials = profile.full_name
 .split("")
 .map((n) => n[0])
 .join("")
 .toUpperCase()
 .slice(0, 2);

 return (
 <>
 <SEO 
 title="My Profile - PawBucks"
 description="Manage your PawBucks profile, subscription settings, and notification preferences."
 keywords={["PawBucks profile","account settings","subscription management"]}
 noIndex={true}
 />
 <div className="min-h-[100dvh] bg-[var(--gradient-hero)] flex flex-col">
 <Header isAuthenticated={true} onLogout={handleSignOut} />
 <PullToRefresh
 ref={containerRef}
 isRefreshing={isRefreshing}
 pullDistance={pullDistance}
 progress={progress}
 className="flex-1 overflow-auto"
 >
     <div className="container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-4xl lg:max-w-6xl">
 {/* Ad Placement for Free Users */}
 <div className="mb-4 sm:mb-6">
 <AdPlacement />
 </div>

  {/* Header */}
  <div className="mb-6">
   <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight">Profile</h1>
  </div>

      {/* Profile Card (full width header) */}
      <GradientCard gradient className="mb-6">
 <div className="flex flex-col items-center text-center space-y-4">
       <Avatar className="w-24 h-24 lg:w-32 lg:h-32 bg-primary/20 border-4 border-background">
        <AvatarFallback className="text-2xl lg:text-4xl font-bold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
 {initials}
 </AvatarFallback>
 </Avatar>
 <div>
       <h2 className="text-2xl lg:text-3xl font-bold">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground capitalize">
                  {profile.user_type === "pet_owner" ? "Pet Owner" : profile.user_type.replace("_", " ")}
                </p>
 </div>
 {subscription.subscribed && (
 <Badge className="bg-gradient-to-r from-warning to-warning border-0">
                  <span className="text-xs mr-1">👑</span>
 Premium Member
 </Badge>
 )}
 </div>
      </GradientCard>

       {/* Pet Owner information — 3 cards spanning full width */}
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GradientCard>
         <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
           <span className="w-5 h-5 text-primary" aria-hidden="true">📧</span>
          </div>
          <div className="flex-1 min-w-0">
           <Label className="text-xs text-muted-foreground">Email</Label>
           <p className="text-sm font-medium truncate">{profile.email}</p>
          </div>
         </div>
        </GradientCard>
        <GradientCard>
         <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
           <span className="w-5 h-5 text-primary" aria-hidden="true">👤</span>
          </div>
          <div className="flex-1">
           <Label className="text-xs text-muted-foreground">Account Type</Label>
           <p className="text-sm font-medium capitalize">
            {profile.user_type.replace("_","")}
           </p>
          </div>
         </div>
        </GradientCard>
        <GradientCard>
         <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
           <span className="w-5 h-5 text-primary" aria-hidden="true">📅</span>
          </div>
          <div className="flex-1">
           <Label className="text-xs text-muted-foreground">Member Since</Label>
           <p className="text-sm font-medium">
            {format(new Date(profile.created_at),"MMMM d, yyyy")}
           </p>
          </div>
         </div>
        </GradientCard>
       </div>

 {/* Subscription Cards */}
 {profile.user_type ==="pet_owner" && !subscription.subscribed && (
 <div className="space-y-4 mb-6">
 <h2 className="text-2xl font-bold text-center">Choose Your Plan</h2>
 <p className="text-center text-muted-foreground mb-6">7-Day Free Trial on Both Plans</p>
 
 {/* PawBucks Comparison Table */}
 <GradientCard className="mb-6">
 <h3 className="text-lg font-semibold text-center mb-4 inline-flex items-center gap-2 justify-center w-full">
 PawBucks Earning Comparison
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <Info className="w-4 h-4 text-muted-foreground cursor-help" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs p-3">
 <p className="font-semibold mb-1">Points Multiplier System</p>
 <p className="text-xs text-muted-foreground">
 The multiplier (10x, 20x, 30x) shows how many PawBucks you earn per dollar spent. 
 Higher tiers earn more rewards on every purchase!
 </p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </h3>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border">
 <th className="py-3 px-2 text-left font-medium text-muted-foreground">You Spend</th>
 <th className="py-3 px-2 text-center font-medium text-muted-foreground">
 <span className="block">Free</span>
 <span className="text-xs text-muted-foreground/70">(10x)</span>
 </th>
 <th className="py-3 px-2 text-center font-medium text-warning">
 <span className="block">PawPass</span>
 <span className="text-xs text-muted-foreground/70">(20x)</span>
 </th>
 <th className="py-3 px-2 text-center font-medium text-accent">
 <span className="block">PawPass+</span>
 <span className="text-xs text-muted-foreground/70">(30x)</span>
 </th>
 </tr>
 </thead>
 <tbody>
 <tr className="border-b border-border/50">
 <td className="py-3 px-2 font-medium">$10</td>
 <td className="py-3 px-2 text-center">100</td>
 <td className="py-3 px-2 text-center text-warning font-medium">200</td>
 <td className="py-3 px-2 text-center text-accent font-semibold">300</td>
 </tr>
 <tr className="border-b border-border/50">
 <td className="py-3 px-2 font-medium">$100</td>
 <td className="py-3 px-2 text-center">1,000</td>
 <td className="py-3 px-2 text-center text-warning font-medium">2,000</td>
 <td className="py-3 px-2 text-center text-accent font-semibold">3,000</td>
 </tr>
 <tr>
 <td className="py-3 px-2 font-medium">$1,000</td>
 <td className="py-3 px-2 text-center">10,000</td>
 <td className="py-3 px-2 text-center text-warning font-medium">20,000</td>
 <td className="py-3 px-2 text-center text-accent font-semibold">30,000</td>
 </tr>
 </tbody>
 </table>
 </div>
 <p className="text-xs text-center text-muted-foreground mt-4">
 1,000 PawBucks = $1.00 in rewards value
 </p>
 </GradientCard>
 
 {/* PawPass Basic */}
 <GradientCard className="relative" gradient={false}>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-warning to-warning flex items-center justify-center">
 <Sparkles className="w-6 h-6 text-white" />
 </div>
 <div>
 <h3 className="font-semibold text-lg">PawPass</h3>
 <p className="text-sm text-muted-foreground">$10/month</p>
 </div>
 </div>
 </div>

 <div className="bg-primary/10 rounded-lg p-3">
 <p className="text-sm font-semibold mb-2">Included Benefits:</p>
 <ul className="text-xs text-muted-foreground space-y-1">
 <li>• 24/7 customer support</li>
 <li>• <span className="font-semibold text-warning">20x points in PawBucks</span> ($1 = 20 PawBucks) at PawBucks Partners</li>
 <li>• Priority access to new features</li>
 </ul>
 </div>

 <Button 
 className="w-full bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning"
 onClick={() => handleSubscribe('basic')}
 disabled={isSubscribing || subLoading}
 >
 {isSubscribing ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 <>
                      <span className="text-base mr-2">👑</span>
 Start 7-Day Free Trial
 </>
 )}
 </Button>
 </div>
 </GradientCard>

 {/* PawPass+ */}
 <GradientCard className="relative border-2 border-primary" gradient={true}>
 <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-accent to-accent border-0">
 Most Popular
 </Badge>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent flex items-center justify-center">
  <span className="text-xl leading-none">👑</span>
 </div>
 <div>
 <h3 className="font-semibold text-lg">PawPass+</h3>
 <p className="text-sm text-muted-foreground">$20/month</p>
 </div>
 </div>
 </div>

 <div className="bg-primary/10 rounded-lg p-3">
 <p className="text-sm font-semibold mb-2">Everything in PawPass, plus:</p>
 <ul className="text-xs text-muted-foreground space-y-1">
 <li>• <span className="font-semibold text-primary">Ad-Free experience</span></li>
 <li>• <span className="font-semibold text-accent">30x points in PawBucks</span> ($1 = 30 PawBucks) at PawBucks Partners</li>
 <li>• <span className="font-semibold text-accent">5x points in PawBucks</span> ($1 = 5 PawBucks) at non-partner merchants</li>
 <li>• Exclusive premium partner offers</li>
 <li>• VIP customer support with priority response</li>
 <li>• Early access to beta features</li>
 </ul>
 </div>

 <Button 
 className="w-full bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent"
 onClick={() => handleSubscribe('plus')}
 disabled={isSubscribing || subLoading}
 >
 {isSubscribing ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 <>
                      <span className="text-base mr-2">👑</span>
 Start 7-Day Free Trial
 </>
 )}
 </Button>
 </div>
 </GradientCard>
 </div>
 )}

 {/* Active Subscription Display */}
 {profile.user_type ==="pet_owner" && subscription.subscribed && (
 <GradientCard className="mb-6" gradient={subscription.subscribed}>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
 getSubscriptionTier(subscription.product_id, subscription.subscription_tier) ==='pawpass_plus'
 ?'bg-gradient-to-br from-accent to-accent'
 :'bg-gradient-to-br from-warning to-warning'
 }`}>
 {getSubscriptionTier(subscription.product_id, subscription.subscription_tier) ==='pawpass_plus' ? (
 <span className="text-xl leading-none">👑</span>
 ) : (
 <Sparkles className="w-6 h-6 text-white" />
 )}
 </div>
 <div>
 <h3 className="font-semibold text-lg">
 {getSubscriptionTier(subscription.product_id, subscription.subscription_tier) ==='pawpass_plus' ?'PawPass+' :'PawPass'}
 </h3>
 <p className="text-sm text-muted-foreground">Active Subscription</p>
 </div>
 </div>
 <Badge variant="outline" className="bg-success/10 text-success border-success/20">
 {subscription.status ==='trialing' ?'Trial' :'Active'}
 </Badge>
 </div>

 <div className="space-y-3">
 <div className="bg-background/50 rounded-lg p-3 space-y-2">
 {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Trial ends:</span>
 <span className="font-medium">
 {format(new Date(subscription.trial_end),"MMM d, yyyy")}
 </span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Renews on:</span>
 <span className="font-medium">
 {subscription.subscription_end 
 ? format(new Date(subscription.subscription_end),"MMM d, yyyy")
 :"N/A"}
 </span>
 </div>
 </div>
 <div className="flex flex-col gap-2">
 <Button 
 variant="outline" 
 className="w-full"
 onClick={handleManageSubscription}
 >
 <Settings className="w-4 h-4 mr-2" />
 Manage Billing
 </Button>
 <Button 
 variant="ghost" 
 className="w-full text-muted-foreground"
 onClick={() => navigate("/my-subscriptions")}
 >
 View All Subscriptions
 </Button>
 </div>
 </div>
 </div>
 </GradientCard>
 )}

      {/* Action Buttons (full width below both columns) */}
      <div className="mt-8 space-y-3 mb-6 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
 <Button
 variant="outline"
 className="w-full"
 onClick={() => navigate("/notification-preferences")}
 >
 <Settings className="w-4 h-4 mr-2" />
 Settings
 </Button>
 <Button
 variant="outline"
 className="w-full"
  onClick={() => navigate("/home")}
 >
 Back to Home
 </Button>
 <FeedbackButton open={feedbackOpen} onOpenChange={setFeedbackOpen} trigger={
 <Button
 variant="outline"
 className="w-full"
 onClick={() => setFeedbackOpen(true)}
 >
 <span className="w-4 h-4 mr-2" aria-hidden="true">💬</span>
 Support & Feedback
 </Button>
 } />
 <Button
 variant="ghost"
 className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
 onClick={handleSignOut}
 >
 <LogOut className="w-4 h-4 mr-2" />
 Sign Out
 </Button>
       <div className="lg:col-span-2">
        <DeleteMyAccountCard />
       </div>
      </div>
 </div>
 </PullToRefresh>
 <BottomNav />
 </div>
 </>
 );
};

export default Profile;
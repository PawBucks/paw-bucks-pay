import { useEffect, useState, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { BottomNav } from"@/components/BottomNav";
import { 
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from"@/components/ui/alert-dialog";
import { 
 ArrowLeft, 
 Crown, 
 Store, 
 Calendar, 
 Loader2,
 XCircle,
 RefreshCw,
 AlertTriangle
} from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";

type Subscription = {
 id: string;
 type:"platform" |"merchant";
 name: string;
 status: string;
 current_period_end: string;
 cancel_at_period_end: boolean;
 canceled_at: string | null;
 merchant_name: string;
 merchant_id: string | null;
 connected_account_id: string | null;
 amount: number | null;
 currency: string;
 interval: string;
 logo_url: string | null;
};

const MySubscriptions = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
 const [loading, setLoading] = useState(true);
 const [cancelingId, setCancelingId] = useState<string | null>(null);
 const [confirmDialog, setConfirmDialog] = useState<{
 open: boolean;
 subscription: Subscription | null;
 }>({ open: false, subscription: null });

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const loadSubscriptions = useCallback(async () => {
 if (!user) return;

 setLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke("list-user-subscriptions");

 if (error) throw error;

 setSubscriptions(data?.subscriptions || []);
 } catch (error) {
 console.error("Error loading subscriptions:", error);
 toast.error("Failed to load subscriptions");
 } finally {
 setLoading(false);
 }
 }, [user]);

 useEffect(() => {
 loadSubscriptions();
 }, [loadSubscriptions]);

 const handleCancelClick = (subscription: Subscription) => {
 setConfirmDialog({ open: true, subscription });
 };

 const handleCancelConfirm = async () => {
 const subscription = confirmDialog.subscription;
 if (!subscription) return;

 setConfirmDialog({ open: false, subscription: null });
 setCancelingId(subscription.id);

 try {
 const { data, error } = await supabase.functions.invoke("cancel-subscription", {
 body: {
 subscription_id: subscription.id,
 connected_account_id: subscription.connected_account_id,
 cancel_immediately: false, // Cancel at period end
 },
 });

 if (error) throw error;

 toast.success("Subscription will be canceled at the end of the billing period");
 await loadSubscriptions();
 } catch (error) {
 console.error("Error canceling subscription:", error);
 toast.error("Failed to cancel subscription. Please try again.");
 } finally {
 setCancelingId(null);
 }
 };

 const getStatusBadge = (subscription: Subscription) => {
 if (subscription.cancel_at_period_end) {
 return (
 <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
 Canceling
 </Badge>
 );
 }

 switch (subscription.status) {
 case"active":
 return (
 <Badge variant="outline" className="bg-success/10 text-success border-success/20">
 Active
 </Badge>
 );
 case"trialing":
 return (
 <Badge variant="outline" className="bg-info/10 text-info border-info/20">
 Trial
 </Badge>
 );
 case"past_due":
 return (
 <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
 Past Due
 </Badge>
 );
 default:
 return (
 <Badge variant="outline">
 {subscription.status}
 </Badge>
 );
 }
 };

 const formatPrice = (amount: number | null, currency: string, interval: string) => {
 if (!amount) return"Price unavailable";
 const formatted = new Intl.NumberFormat("en-US", {
 style:"currency",
 currency: currency.toUpperCase(),
 }).format(amount);
 return `${formatted}/${interval}`;
 };

 if (authLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <>
 <SEO
 title="My Subscriptions - PawBucks"
 description="Manage your PawBucks and merchant subscriptions."
 noIndex={true}
 />
 <div className="min-h-[100dvh] bg-[var(--gradient-hero)] flex flex-col">
 <Header isAuthenticated={true} onLogout={signOut} />
 <div className="flex-1 container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-4xl lg:max-w-5xl">
 {/* Header */}
 <div className="flex items-center gap-3 mb-6">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => navigate("/profile")}
 className="min-h-10 min-w-10"
 >
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div className="flex-1">
 <h1 className="text-2xl font-bold">My Subscriptions</h1>
 <p className="text-sm text-muted-foreground">
 Manage all your active subscriptions
 </p>
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={loadSubscriptions}
 disabled={loading}
 className="min-h-10 min-w-10"
 >
 <RefreshCw className={`w-5 h-5 ${loading ?"animate-spin" :""}`} />
 </Button>
 </div>

 {/* Loading State */}
 {loading && (
 <div className="flex flex-col items-center justify-center py-12 space-y-4">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 <p className="text-muted-foreground">Loading subscriptions...</p>
 </div>
 )}

 {/* Empty State */}
 {!loading && subscriptions.length === 0 && (
 <GradientCard className="text-center py-12">
 <span className="text-5xl block text-center mb-4 text-muted-foreground">👑</span>
 <h3 className="text-lg font-semibold mb-2">No Active Subscriptions</h3>
 <p className="text-muted-foreground mb-6">
 You don't have any active subscriptions yet.
 </p>
 <Button onClick={() => navigate("/profile")}>
 View Subscription Plans
 </Button>
 </GradientCard>
 )}

 {/* Subscriptions List */}
 {!loading && subscriptions.length > 0 && (
 <div className="space-y-4">
 {subscriptions.map((subscription) => (
 <GradientCard key={subscription.id} className="space-y-4">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 {subscription.type ==="platform" ? (
 <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-accent to-accent">
 <span className="text-xl leading-none">👑</span>
 </div>
 ) : subscription.logo_url ? (
 <img
 src={subscription.logo_url}
 alt={`${subscription.merchant_name} logo`}
 className="w-12 h-12 rounded-full object-cover border border-border"
 />
 ) : (
 <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-info to-info">
 <Store className="w-6 h-6 text-white" />
 </div>
 )}
 <div>
 <h3 className="font-semibold">{subscription.name}</h3>
 <p className="text-sm text-muted-foreground">
 {subscription.merchant_name}
 </p>
 </div>
 </div>
 {getStatusBadge(subscription)}
 </div>

 <div className="bg-background/50 rounded-lg p-3 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Price:</span>
 <span className="font-medium">
 {formatPrice(
 subscription.amount,
 subscription.currency,
 subscription.interval
 )}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">
 {subscription.cancel_at_period_end ?"Ends on:" :"Renews on:"}
 </span>
 <span className="font-medium flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {format(new Date(subscription.current_period_end),"MMM d, yyyy")}
 </span>
 </div>
 </div>

 {subscription.cancel_at_period_end ? (
 <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3">
 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
 <span>
 This subscription will end on{""}
 {format(new Date(subscription.current_period_end),"MMMM d, yyyy")}
 </span>
 </div>
 ) : (
 <Button
 variant="outline"
 className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
 onClick={() => handleCancelClick(subscription)}
 disabled={cancelingId === subscription.id}
 >
 {cancelingId === subscription.id ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Canceling...
 </>
 ) : (
 <>
 <XCircle className="w-4 h-4 mr-2" />
 Cancel Subscription
 </>
 )}
 </Button>
 )}
 </GradientCard>
 ))}
 </div>
 )}
 </div>
 <BottomNav />
 </div>

 {/* Cancel Confirmation Dialog */}
 <AlertDialog
 open={confirmDialog.open}
 onOpenChange={(open) =>
 setConfirmDialog({ open, subscription: open ? confirmDialog.subscription : null })
 }
 >
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
 <AlertDialogDescription className="space-y-2">
 <p>
 Are you sure you want to cancel your{""}
 <strong>{confirmDialog.subscription?.name}</strong> subscription from{""}
 <strong>{confirmDialog.subscription?.merchant_name}</strong>?
 </p>
 <p>
 Your subscription will remain active until{""}
 <strong>
 {confirmDialog.subscription?.current_period_end
 ? format(
 new Date(confirmDialog.subscription.current_period_end),
"MMMM d, yyyy"
 )
 :"the end of your billing period"}
 </strong>
 . You won't be charged again after that date.
 </p>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
 <AlertDialogAction
 onClick={handleCancelConfirm}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 Yes, Cancel Subscription
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </>
 );
};

export default MySubscriptions;

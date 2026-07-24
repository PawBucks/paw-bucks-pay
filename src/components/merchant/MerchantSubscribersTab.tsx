import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
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
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
import { AlertCircle, Loader2, MoreVertical, PauseCircle, PlayCircle, RefreshCw, Users, XCircle } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { format } from"date-fns";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
type Subscriber = {
 id: string;
 user_id: string;
 product_name: string;
 amount: number;
 currency: string;
 status: string;
 billing_interval: string;
 billing_interval_count: number;
 current_period_start: string;
 current_period_end: string;
 next_billing_date: string;
 cancel_at_period_end: boolean;
 created_at: string;
 profiles: { full_name: string; email: string } | null;
};

type MerchantSubscribersTabProps = {
 merchantId: string;
};

const statusVariant = (status: string) => {
 switch (status) {
 case"active":
 return"default";
 case"past_due":
 return"destructive";
 case"paused":
 return"outline";
 case"canceled":
 return"secondary";
 default:
 return"outline";
 }
};

export function MerchantSubscribersTab({ merchantId }: MerchantSubscribersTabProps) {
 const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [cancelDialog, setCancelDialog] = useState<{
 open: boolean;
 subscriber: Subscriber | null;
 immediately: boolean;
 }>({ open: false, subscriber: null, immediately: false });
 const [cancelReason, setCancelReason] = useState("");
 const [canceling, setCanceling] = useState(false);

 const [pauseDialog, setPauseDialog] = useState<{
 open: boolean;
 subscriber: Subscriber | null;
 action: "pause" | "resume";
 }>({ open: false, subscriber: null, action: "pause" });
 const [pauseReason, setPauseReason] = useState("");
 const [pausing, setPausing] = useState(false);

 const fetchSubscribers = async () => {
 setLoading(true);
 setError(null);
 try {
 const { data, error: fetchError } = await supabase
 .from("merchant_subscriptions")
  .select("*")
 .eq("merchant_id", merchantId)
   .in("status", ["active","past_due","paused"])
 .order("created_at", { ascending: false });

 if (fetchError) throw fetchError;
      const nowMs = Date.now();
      // Hide any row whose cancellation has already taken effect (period ended)
      // even if a cron sweep hasn't yet flipped status to 'canceled'.
      const rows = ((data || []) as any[]).filter((r) => {
        if (!r.cancel_at_period_end) return true;
        const end = r.current_period_end ? new Date(r.current_period_end).getTime() : 0;
        return end > nowMs;
      });
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const profileById = new Map<string, { full_name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.rpc(
      "get_customer_profiles_for_merchant",
      { p_user_ids: userIds }
    );
    (profiles || []).forEach((p: any) => {
      if (p?.id) profileById.set(p.id, { full_name: p.full_name || "", email: p.email || "" });
    });
  }
  const enriched: Subscriber[] = rows.map((r) => ({
    ...r,
    profiles: profileById.get(r.user_id) || null,
  })) as Subscriber[];
  setSubscribers(enriched);
 } catch (err: any) {
 console.error("Error fetching subscribers:", err);
 setError(err.message ||"Failed to load subscribers");
 } finally {
 setLoading(false);
 }
 };

 const handlePauseResume = async () => {
 if (!pauseDialog.subscriber) return;
 if (pauseReason.trim().length < 3) {
 toast.error("Please provide a reason (at least 3 characters).");
 return;
 }
 setPausing(true);
 try {
 const { data, error } = await supabase.functions.invoke("merchant-pause-subscription", {
 body: {
 subscriptionId: pauseDialog.subscriber.id,
 action: pauseDialog.action,
 reason: pauseReason.trim(),
 },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 toast.success(pauseDialog.action === "pause" ? "Subscription paused" : "Subscription resumed");
 setPauseDialog({ open: false, subscriber: null, action: "pause" });
 setPauseReason("");
 await fetchSubscribers();
 } catch (err: any) {
 console.error("Error updating subscription:", err);
 toast.error(err.message || "Failed to update subscription");
 } finally {
 setPausing(false);
 }
 };

 useEffect(() => {
 fetchSubscribers();
 }, [merchantId]);

 const handleCancelSubscription = async () => {
 if (!cancelDialog.subscriber) return;

 setCanceling(true);
 try {
 const { data, error } = await supabase.functions.invoke("merchant-cancel-subscription", {
 body: {
 subscriptionId: cancelDialog.subscriber.id,
 cancelImmediately: cancelDialog.immediately,
 reason: cancelReason.trim() || undefined,
 },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 toast.success(
 cancelDialog.immediately
 ?"Subscription canceled immediately"
 :"Subscription will cancel at end of billing period"
 );

 setCancelDialog({ open: false, subscriber: null, immediately: false });
 setCancelReason("");
 await fetchSubscribers();
 } catch (err: any) {
 console.error("Error canceling subscription:", err);
 toast.error(err.message ||"Failed to cancel subscription");
 } finally {
 setCanceling(false);
 }
 };

 const activeCount = subscribers.filter((s) => s.status ==="active").length;
 const pastDueCount = subscribers.filter((s) => s.status ==="past_due").length;
 const totalMRR = subscribers
 .filter((s) => s.status ==="active")
 .reduce((sum, s) => sum + s.amount, 0);

 if (loading) {
 return (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-3xl font-bold">Subscribers</h2>
 <p className="text-muted-foreground">View all active subscribers and their plans.</p>
 </div>
 <Button variant="outline" size="sm" onClick={fetchSubscribers}>
 <RefreshCw className="w-4 h-4 mr-2" />
 Refresh
 </Button>
 </div>

 {/* Summary cards */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Users className="w-5 h-5 text-primary" aria-hidden="true" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Active Subscribers</p>
 <p className="text-2xl font-bold">{activeCount}</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
 <AlertCircle className="w-5 h-5 text-accent" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Past Due</p>
 <p className="text-2xl font-bold">{pastDueCount}</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
 <span className="text-lg font-bold text-secondary">$</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Monthly Recurring</p>
 <p className="text-2xl font-bold">{Formatters.currency((totalMRR / 100))}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* Subscriber table */}
 {error ? (
 <GradientCard className="text-center py-8">
 <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
 <p className="text-destructive">{error}</p>
 </GradientCard>
 ) : subscribers.length === 0 ? (
 <GradientCard className="text-center py-12">
 <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
 <p className="text-muted-foreground font-medium">No active subscribers yet</p>
 <p className="text-sm text-muted-foreground mt-1">
 Subscribers will appear here once customers subscribe to your plans.
 </p>
 </GradientCard>
 ) : (
 <GradientCard className="p-0 overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Subscriber</TableHead>
 <TableHead>Plan</TableHead>
 <TableHead>Amount</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Next Billing</TableHead>
 <TableHead>Since</TableHead>
 <TableHead className="w-12"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {subscribers.map((sub) => (
 <TableRow key={sub.id}>
 <TableCell>
 <div>
 <p className="font-medium">
 {sub.profiles?.full_name ||"Unknown"}
 </p>
 <p className="text-xs text-muted-foreground">
 {sub.profiles?.email ||"—"}
 </p>
 </div>
 </TableCell>
 <TableCell>
 <span className="font-medium">{sub.product_name}</span>
 </TableCell>
 <TableCell>
 {Formatters.currency((sub.amount / 100))}
 <span className="text-xs text-muted-foreground ml-1">
 /{sub.billing_interval_count > 1 ? `${sub.billing_interval_count} ` :""}
 {sub.billing_interval}
 </span>
 </TableCell>
 <TableCell>
 <Badge variant={statusVariant(sub.status)}>
 {sub.status ==="active" && sub.cancel_at_period_end
 ?"Canceling"
 : sub.status.replace(/_/g, " ")}
 </Badge>
 </TableCell>
 <TableCell className="text-sm">
 {sub.cancel_at_period_end
 ?"—"
 : format(new Date(sub.next_billing_date),"MMM d, yyyy")}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(sub.created_at),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 {!sub.cancel_at_period_end && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreVertical className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
                 {sub.status === "paused" ? (
                 <DropdownMenuItem
                 onClick={() =>
                 setPauseDialog({ open: true, subscriber: sub, action: "resume" })
                 }
                 >
                 <PlayCircle className="h-4 w-4 mr-2" />
                 Resume Subscription
                 </DropdownMenuItem>
                 ) : (
                 <DropdownMenuItem
                 onClick={() =>
                 setPauseDialog({ open: true, subscriber: sub, action: "pause" })
                 }
                 >
                 <PauseCircle className="h-4 w-4 mr-2" />
                 Pause Subscription
                 </DropdownMenuItem>
                 )}
 <DropdownMenuItem
 onClick={() =>
 setCancelDialog({ open: true, subscriber: sub, immediately: false })
 }
 >
 <XCircle className="h-4 w-4 mr-2" />
 Cancel at Period End
 </DropdownMenuItem>
 <DropdownMenuItem
 className="text-destructive"
 onClick={() =>
 setCancelDialog({ open: true, subscriber: sub, immediately: true })
 }
 >
 <XCircle className="h-4 w-4 mr-2" />
 Cancel Immediately
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </GradientCard>
 )}

 {/* Cancel confirmation dialog */}
 <AlertDialog
 open={cancelDialog.open}
 onOpenChange={(open) => {
 if (!open) {
 setCancelDialog({ open: false, subscriber: null, immediately: false });
 setCancelReason("");
 }
 }}
 >
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>
 Cancel Subscription{cancelDialog.immediately ?" Immediately" :""}
 </AlertDialogTitle>
 <AlertDialogDescription>
 {cancelDialog.immediately
 ? `This will immediately cancel ${cancelDialog.subscriber?.profiles?.full_name ||"this subscriber"}'s subscription to ${cancelDialog.subscriber?.product_name}. They will lose access right away.`
 : `${cancelDialog.subscriber?.profiles?.full_name ||"This subscriber"}'s subscription to ${cancelDialog.subscriber?.product_name} will be canceled at the end of their current billing period. They will retain access until then.`}
 </AlertDialogDescription>
 </AlertDialogHeader>

 <div className="space-y-2">
  <Label htmlFor="cancel-reason">Reason <span className="text-destructive">*</span></Label>
 <Textarea
 id="cancel-reason"
 placeholder="Provide a reason for cancellation..."
 value={cancelReason}
 onChange={(e) => setCancelReason(e.target.value)}
 rows={3}
 />
 </div>

 <AlertDialogFooter>
 <AlertDialogCancel disabled={canceling}>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={handleCancelSubscription}
  disabled={canceling || cancelReason.trim().length < 3}
 className={cancelDialog.immediately ?"bg-destructive text-destructive-foreground hover:bg-destructive/90" :""}
 >
 {canceling ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : cancelDialog.immediately ? (
"Cancel Immediately"
 ) : (
"Cancel at Period End"
 )}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Pause / Resume confirmation dialog */}
 <AlertDialog
 open={pauseDialog.open}
 onOpenChange={(open) => {
 if (!open) {
 setPauseDialog({ open: false, subscriber: null, action: "pause" });
 setPauseReason("");
 }
 }}
 >
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>
 {pauseDialog.action === "pause" ? "Pause Subscription" : "Resume Subscription"}
 </AlertDialogTitle>
 <AlertDialogDescription>
 {pauseDialog.action === "pause"
 ? `${pauseDialog.subscriber?.profiles?.full_name || "This subscriber"}'s subscription to ${pauseDialog.subscriber?.product_name} will be paused. They will not be billed until you resume it. Please provide a reason — the subscriber will be notified.`
 : `${pauseDialog.subscriber?.profiles?.full_name || "This subscriber"}'s subscription to ${pauseDialog.subscriber?.product_name} will resume and billing will continue on the next scheduled date. Please provide a reason — the subscriber will be notified.`}
 </AlertDialogDescription>
 </AlertDialogHeader>

 <div className="space-y-2">
 <Label htmlFor="pause-reason">Reason <span className="text-destructive">*</span></Label>
 <Textarea
 id="pause-reason"
 placeholder={pauseDialog.action === "pause" ? "Why are you pausing this subscription?" : "Why are you resuming this subscription?"}
 value={pauseReason}
 onChange={(e) => setPauseReason(e.target.value)}
 rows={3}
 />
 </div>

 <AlertDialogFooter>
 <AlertDialogCancel disabled={pausing}>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={handlePauseResume}
 disabled={pausing || pauseReason.trim().length < 3}
 >
 {pausing ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : pauseDialog.action === "pause" ? (
 "Pause Subscription"
 ) : (
 "Resume Subscription"
 )}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}

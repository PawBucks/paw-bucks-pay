import { useEffect, useState } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Building2, Clock, Loader2 } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";

type FeeModel ="full_ecosystem" |"acquisition_only";

type Props = {
 merchantId: string;
 feeModel: FeeModel;
 acquisitionFeeRate?: number | null;
};

type ChangeRequest = {
 id: string;
 requested_fee_model: FeeModel;
 status: string;
 created_at: string;
};

const labelFor = (m: FeeModel) =>
 m ==="acquisition_only" ?"Acquisition-Only" :"Full Ecosystem";

export function AccountTypeCard({ merchantId, feeModel, acquisitionFeeRate }: Props) {
 const [pending, setPending] = useState<ChangeRequest | null>(null);
 const [open, setOpen] = useState(false);
 const [reason, setReason] = useState("");
 const [submitting, setSubmitting] = useState(false);

 const targetModel: FeeModel =
 feeModel ==="acquisition_only" ?"full_ecosystem" :"acquisition_only";

 const loadPending = async () => {
 const { data } = await supabase
 .from("merchant_account_type_change_requests")
 .select("id, requested_fee_model, status, created_at")
 .eq("merchant_id", merchantId)
 .eq("status","pending")
 .maybeSingle();
 setPending((data as ChangeRequest | null) ?? null);
 };

 useEffect(() => {
 if (merchantId) loadPending();
 }, [merchantId]);

 const submitRequest = async () => {
 setSubmitting(true);
 try {
 const { data: userRes } = await supabase.auth.getUser();
 const uid = userRes.user?.id;
 if (!uid) throw new Error("Not authenticated");

 const { error } = await supabase
 .from("merchant_account_type_change_requests")
 .insert({
 merchant_id: merchantId,
 user_id: uid,
 current_fee_model: feeModel,
 requested_fee_model: targetModel,
 reason: reason.trim() || null,
 });
 if (error) throw error;
 toast.success("Request submitted. An admin will review it shortly.");
 setOpen(false);
 setReason("");
 loadPending();
 } catch (e: any) {
 toast.error(e.message ||"Failed to submit request");
 } finally {
 setSubmitting(false);
 }
 };

 const cancelRequest = async () => {
 if (!pending) return;
 setSubmitting(true);
 try {
 const { error } = await supabase
 .from("merchant_account_type_change_requests")
 .update({ status:"cancelled" })
 .eq("id", pending.id);
 if (error) throw error;
 toast.success("Request cancelled");
 loadPending();
 } catch (e: any) {
 toast.error(e.message ||"Failed to cancel");
 } finally {
 setSubmitting(false);
 }
 };

 const isAcq = feeModel ==="acquisition_only";

 return (
 <GradientCard gradient>
 <div className="flex items-start justify-between gap-4 flex-wrap">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
 {isAcq ? (
 <Building2 className="w-6 h-6 text-primary" />
 ) : (
 <Sparkles className="w-6 h-6 text-primary" />
 )}
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h3 className="font-semibold">Account Type</h3>
 <Badge variant={isAcq ?"secondary" :"default"}>{labelFor(feeModel)}</Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 {isAcq
 ? `You pay a one-time ${acquisitionFeeRate ?? 10}% acquisition fee on each new customer's first purchase only.`
 :"You pay a 3% success fee on every transaction and participate in the full PawBucks rewards ecosystem."}
 </p>
 </div>
 </div>
 <div className="flex flex-col items-end gap-2">
 {pending ? (
 <>
 <Badge variant="outline" className="gap-1">
 <Clock className="w-3 h-3" />
 Pending: {labelFor(pending.requested_fee_model)}
 </Badge>
 <Button size="sm" variant="ghost" onClick={cancelRequest} disabled={submitting}>
 Cancel request
 </Button>
 </>
 ) : (
 <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
 Request change to {labelFor(targetModel)}
 </Button>
 )}
 </div>
 </div>

 <Dialog open={open} onOpenChange={setOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Request Account Type Change</DialogTitle>
 <DialogDescription>
 You're requesting to switch from <strong>{labelFor(feeModel)}</strong> to{""}
 <strong>{labelFor(targetModel)}</strong>. An admin will review and apply
 the change manually. You'll be notified when it's processed.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-2">
 <Label htmlFor="reason">Reason (optional)</Label>
 <Textarea
 id="reason"
 placeholder="Tell us why you'd like to change your account type..."
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={4}
 maxLength={1000}
 />
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
 Cancel
 </Button>
 <Button onClick={submitRequest} disabled={submitting}>
 {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
 Submit Request
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </GradientCard>
 );
}
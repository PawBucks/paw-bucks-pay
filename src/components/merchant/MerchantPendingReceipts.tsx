import { useState, useEffect, useCallback } from"react";
import { SignedReceiptImage } from"@/components/shared/SignedReceiptImage";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent } from"@/components/ui/card";
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from"@/components/ui/table";
import {
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from"@/components/ui/dialog";
import { Check, Eye, Loader2, Receipt } from "lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";

import { Formatters } from "@/utils/formatters";
type PendingReceipt = {
 id: string;
 user_id: string;
 receipt_image_url: string;
 merchant_name: string;
 purchase_amount: number;
 receipt_date: string;
 status: string;
 created_at: string;
 confirmation_id: string | null;
};

interface MerchantPendingReceiptsProps {
 merchantId: string;
}

export const MerchantPendingReceipts = ({ merchantId }: MerchantPendingReceiptsProps) => {
 const [receipts, setReceipts] = useState<PendingReceipt[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedReceipt, setSelectedReceipt] = useState<PendingReceipt | null>(null);
 const [confirming, setConfirming] = useState(false);

 const loadReceipts = useCallback(async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from("receipt_submissions")
 .select("id, user_id, receipt_image_url, merchant_name, purchase_amount, receipt_date, status, created_at, confirmation_id")
 .eq("merchant_id", merchantId)
 .order("created_at", { ascending: false })
 .limit(50);

 if (!error && data) {
 setReceipts(data);
 }
 } finally {
 setLoading(false);
 }
 }, [merchantId]);

 useEffect(() => {
 loadReceipts();
 }, [loadReceipts]);

 // Realtime subscription
 useEffect(() => {
 const channel = supabase
 .channel(`receipts-merchant-${merchantId}`)
 .on(
"postgres_changes",
 {
 event:"*",
 schema:"public",
 table:"receipt_submissions",
 filter: `merchant_id=eq.${merchantId}`,
 },
 () => {
 loadReceipts();
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [merchantId, loadReceipts]);

 const handleConfirmReceipt = async (receipt: PendingReceipt) => {
 setConfirming(true);
 try {
 // Create a merchant sale confirmation linked to this receipt
 const user = (await supabase.auth.getUser()).data.user;
 const { data: confirmation, error: confirmError } = await supabase
 .from("merchant_sale_confirmations")
 .insert({
 merchant_id: merchantId,
 customer_email:"receipt-submission",
 amount: receipt.purchase_amount,
 confirmed_by: user?.id,
 receipt_submission_id: receipt.id,
 })
 .select("id")
 .single();

 if (confirmError) throw confirmError;

 toast.success("Receipt confirmed! This helps speed up the customer's PawBucks credit.");
 setSelectedReceipt(null);
 loadReceipts();
 } catch (error) {
 console.error("Error confirming receipt:", error);
 toast.error("Failed to confirm receipt");
 } finally {
 setConfirming(false);
 }
 };

 const getStatusBadge = (status: string, hasConfirmation: boolean) => {
 if (hasConfirmation) return <Badge className="bg-success">Confirmed</Badge>;
 switch (status) {
 case"pending": return <Badge variant="secondary"><span className="w-3 h-3 mr-1" aria-hidden="true">⏰</span>Pending Review</Badge>;
 case"approved": return <Badge className="bg-success">Approved</Badge>;
 case"rejected": return <Badge variant="destructive">Rejected</Badge>;
 default: return <Badge variant="outline">{status}</Badge>;
 }
 };

 const pendingCount = receipts.filter(r => r.status ==="pending" && !r.confirmation_id).length;

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🧾</span>
 <h3 className="text-lg font-semibold">Customer Receipts</h3>
 {pendingCount > 0 && (
 <Badge variant="destructive" className="ml-1">{pendingCount} pending</Badge>
 )}
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-5 h-5 animate-spin text-primary" />
 </div>
 ) : receipts.length === 0 ? (
 <Card>
 <CardContent className="py-8 text-center">
 <span className="w-10 h-10 mx-auto text-muted-foreground mb-2" aria-hidden="true">🧾</span>
 <p className="text-sm text-muted-foreground">No customer receipt submissions yet.</p>
 </CardContent>
 </Card>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {receipts.map((r) => (
 <TableRow key={r.id} className={r.status ==="pending" && !r.confirmation_id ?"bg-warning/5" :""}>
 <TableCell className="text-sm whitespace-nowrap">
 {format(new Date(r.created_at),"MMM d, yyyy")}
 </TableCell>
 <TableCell className="text-right font-medium">
 {Formatters.currency(r.purchase_amount)}
 </TableCell>
 <TableCell>
 {getStatusBadge(r.status, !!r.confirmation_id)}
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(r)}>
 <Eye className="w-4 h-4 mr-1" />
 View
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}

 {/* Receipt Detail Dialog */}
 <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
 <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Receipt Details</DialogTitle>
 <DialogDescription>
 Review the customer's receipt submission.
 </DialogDescription>
 </DialogHeader>

 {selectedReceipt && (
 <div className="space-y-4">
 <div className="aspect-[3/4] max-h-[300px] overflow-hidden rounded-lg border bg-muted">
 <SignedReceiptImage receiptPath={selectedReceipt.receipt_image_url} />
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <span className="text-muted-foreground">Amount</span>
 <p className="font-semibold">{Formatters.currency(selectedReceipt.purchase_amount)}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Receipt Date</span>
 <p className="font-semibold">{format(new Date(selectedReceipt.receipt_date),"MMM d, yyyy")}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Submitted</span>
 <p className="font-semibold">{format(new Date(selectedReceipt.created_at),"MMM d, yyyy h:mm a")}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Status</span>
 <div className="mt-0.5">{getStatusBadge(selectedReceipt.status, !!selectedReceipt.confirmation_id)}</div>
 </div>
 </div>

 {selectedReceipt.status ==="pending" && !selectedReceipt.confirmation_id && (
 <Button
 onClick={() => handleConfirmReceipt(selectedReceipt)}
 disabled={confirming}
 className="w-full"
 >
 {confirming ? (
 <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Confirming...</>
 ) : (
 <><Check className="mr-2 h-4 w-4" />Confirm This Sale</>
 )}
 </Button>
 )}
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
};

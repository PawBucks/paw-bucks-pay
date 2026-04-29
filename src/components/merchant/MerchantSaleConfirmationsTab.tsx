import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from"@/components/ui/table";
import {
 Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from"@/components/ui/dialog";
import { Check, Loader2, Plus, RefreshCw, Receipt, Users } from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import { MerchantPendingReceipts } from"./MerchantPendingReceipts";
import { Separator } from"@/components/ui/separator";

type Confirmation = {
 id: string;
 customer_email: string;
 customer_name: string | null;
 amount: number;
 confirmation_code: string;
 status: string;
 receipt_submission_id: string | null;
 created_at: string;
};

interface MerchantSaleConfirmationsTabProps {
 merchantId: string;
}

export const MerchantSaleConfirmationsTab = ({ merchantId }: MerchantSaleConfirmationsTabProps) => {
 const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
 const [loading, setLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Form state
 const [customerEmail, setCustomerEmail] = useState("");
 const [customerName, setCustomerName] = useState("");
 const [saleAmount, setSaleAmount] = useState("");

 const loadConfirmations = useCallback(async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from("merchant_sale_confirmations")
 .select("*")
 .eq("merchant_id", merchantId)
 .order("created_at", { ascending: false })
 .limit(50);

 if (!error && data) {
 setConfirmations(data);
 }
 } finally {
 setLoading(false);
 }
 }, [merchantId]);

 useEffect(() => {
 loadConfirmations();
 }, [loadConfirmations]);

 const handleConfirmSale = async () => {
 if (!customerEmail.trim()) {
 toast.error("Customer email is required");
 return;
 }
 if (!saleAmount || isNaN(parseFloat(saleAmount)) || parseFloat(saleAmount) <= 0) {
 toast.error("Please enter a valid sale amount");
 return;
 }

 setSubmitting(true);
 try {
 const { error } = await supabase
 .from("merchant_sale_confirmations")
 .insert({
 merchant_id: merchantId,
 customer_email: customerEmail.trim().toLowerCase(),
 customer_name: customerName.trim() || null,
 amount: parseFloat(saleAmount),
 confirmed_by: (await supabase.auth.getUser()).data.user?.id,
 });

 if (error) throw error;

 toast.success("Sale confirmed! This will be matched with the customer's receipt.");
 setDialogOpen(false);
 setCustomerEmail("");
 setCustomerName("");
 setSaleAmount("");
 loadConfirmations();
 } catch (error) {
 console.error("Error confirming sale:", error);
 toast.error("Failed to confirm sale");
 } finally {
 setSubmitting(false);
 }
 };

 const getStatusBadge = (status: string, hasReceipt: boolean) => {
 if (hasReceipt) return <Badge className="bg-success">Matched</Badge>;
 switch (status) {
 case"pending": return <Badge variant="secondary">Awaiting Receipt</Badge>;
 case"matched": return <Badge className="bg-success">Matched</Badge>;
 default: return <Badge variant="outline">{status}</Badge>;
 }
 };

 return (
 <div className="space-y-6">
 {/* Header with instructions */}
 <Card className="bg-primary/5 border-primary/20">
 <CardContent className="py-4">
 <div className="flex items-start gap-3">
 <Receipt className="w-5 h-5 text-primary mt-0.5" />
 <div>
 <h3 className="font-semibold text-sm">Confirm Customer Sales</h3>
 <p className="text-xs text-muted-foreground mt-1">
 Review customer receipt submissions and confirm sales manually.
 Confirmed receipts get matched faster for PawBucks crediting.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Pending Customer Receipts */}
 <MerchantPendingReceipts merchantId={merchantId} />

 <Separator />

 {/* Actions */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Users className="w-5 h-5 text-primary" />
 <h3 className="text-lg font-semibold">Sale Confirmations</h3>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={loadConfirmations} disabled={loading}>
 <RefreshCw className={`w-4 h-4 mr-2 ${loading ?"animate-spin" :""}`} />
 Refresh
 </Button>
 <Button size="sm" onClick={() => setDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-2" />
 Confirm Sale
 </Button>
 </div>
 </div>

 {/* Confirmations Table */}
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 </div>
 ) : confirmations.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
 <h3 className="font-semibold mb-1">No sale confirmations yet</h3>
 <p className="text-sm text-muted-foreground mb-4">
 When a PawBucks customer makes a purchase, confirm it here for faster rewards.
 </p>
 <Button onClick={() => setDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-2" />
 Confirm a Sale
 </Button>
 </CardContent>
 </Card>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Code</TableHead>
 <TableHead>Status</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {confirmations.map((c) => (
 <TableRow key={c.id}>
 <TableCell className="whitespace-nowrap text-sm">
 {format(new Date(c.created_at),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <div>
 <span className="font-medium">{c.customer_name ||"—"}</span>
 <p className="text-xs text-muted-foreground">{c.customer_email}</p>
 </div>
 </TableCell>
 <TableCell className="text-right font-medium">
 ${c.amount.toFixed(2)}
 </TableCell>
 <TableCell>
 <code className="text-xs bg-muted px-2 py-1 rounded">{c.confirmation_code}</code>
 </TableCell>
 <TableCell>
 {getStatusBadge(c.status, !!c.receipt_submission_id)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}

 {/* Confirm Sale Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Check className="w-5 h-5 text-primary" />
 Confirm Customer Sale
 </DialogTitle>
 <DialogDescription>
 Enter the customer's details to confirm a PawBucks-eligible sale.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="custEmail">Customer Email *</Label>
 <Input
 id="custEmail"
 type="email"
 placeholder="customer@email.com"
 value={customerEmail}
 onChange={(e) => setCustomerEmail(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="custName">Customer Name</Label>
 <Input
 id="custName"
 placeholder="John Doe"
 value={customerName}
 onChange={(e) => setCustomerName(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="saleAmt">Sale Amount (USD) *</Label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
 <Input
 id="saleAmt"
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 value={saleAmount}
 onChange={(e) => setSaleAmount(e.target.value)}
 className="pl-7"
 />
 </div>
 </div>
 </div>

 <div className="flex gap-3">
 <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
 Cancel
 </Button>
 <Button onClick={handleConfirmSale} disabled={submitting} className="flex-1">
 {submitting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Confirming...
 </>
 ) : (
 <>
 <Check className="mr-2 h-4 w-4" />
 Confirm Sale
 </>
 )}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
};

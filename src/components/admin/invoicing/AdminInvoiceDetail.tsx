import { useState, useEffect } from"react";
import { format } from"date-fns";
import { ArrowLeft, Send, Edit, DollarSign, Loader2, Printer } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from"@/components/ui/select";
import {
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from"@/components/ui/dialog";
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from"@/components/ui/table";
import { Separator } from"@/components/ui/separator";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { toast } from"sonner";
import type { AdminInvoice } from"./AdminInvoiceList";

interface Props {
 invoice: AdminInvoice;
 onBack: () => void;
 onEdit: () => void;
 onRefresh: () => void;
}

const statusColors: Record<string, string> = {
 draft:"bg-muted text-muted-foreground",
 sent:"bg-info/15 text-info dark:text-info",
 paid:"bg-success/15 text-success dark:text-success",
 partially_paid:"bg-warning/15 text-warning",
 overdue:"bg-destructive/15 text-destructive dark:text-destructive",
 cancelled:"bg-muted text-muted-foreground dark:bg-foreground dark:text-muted-foreground",
 void:"bg-muted text-muted-foreground dark:bg-foreground dark:text-muted-foreground",
};

export function AdminInvoiceDetail({ invoice, onBack, onEdit, onRefresh }: Props) {
 const { user } = useAuth();
 const [items, setItems] = useState<any[]>([]);
 const [payments, setPayments] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [paymentOpen, setPaymentOpen] = useState(false);
 const [recording, setRecording] = useState(false);

 // Payment form
 const [payAmount, setPayAmount] = useState(String(invoice.amount_due));
 const [payMethod, setPayMethod] = useState("manual");
 const [payRef, setPayRef] = useState("");
 const [payNotes, setPayNotes] = useState("");

 useEffect(() => {
 loadDetails();
 }, [invoice.id]);

 const loadDetails = async () => {
 setLoading(true);
 const [{ data: itemsData }, { data: paymentsData }] = await Promise.all([
 supabase.from("admin_invoice_items").select("*").eq("invoice_id", invoice.id).order("display_order"),
 supabase.from("admin_invoice_payments").select("*").eq("invoice_id", invoice.id).order("paid_at", { ascending: false }),
 ]);
 setItems(itemsData || []);
 setPayments(paymentsData || []);
 setLoading(false);
 };

 const [sending, setSending] = useState(false);

 const handleSendInvoice = async () => {
 if (!invoice.recipient_email) {
 toast.error("Recipient has no email address on file");
 return;
 }
 setSending(true);
 try {
 const { data, error } = await supabase.functions.invoke("send-admin-invoice-email", {
 body: { invoiceId: invoice.id },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 toast.success("Invoice sent successfully!");
 onRefresh();
 } catch (err: any) {
 toast.error(err.message ||"Failed to send invoice");
 } finally {
 setSending(false);
 }
 };

 const handleRecordPayment = async () => {
 const amount = parseFloat(payAmount);
 if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
 setRecording(true);
 try {
 const { error } = await supabase.from("admin_invoice_payments").insert({
 invoice_id: invoice.id,
 amount,
 payment_method: payMethod,
 reference_number: payRef || null,
 notes: payNotes || null,
 recorded_by: user?.id ||"",
 });
 if (error) throw error;
 toast.success("Payment recorded!");
 setPaymentOpen(false);
 setPayRef("");
 setPayNotes("");
 onRefresh();
 loadDetails();
 } catch (err: any) {
 toast.error(err.message ||"Failed to record payment");
 } finally {
 setRecording(false);
 }
 };

 const handleVoid = async () => {
 const { error } = await supabase
 .from("admin_invoices")
 .update({ status:"void" })
 .eq("id", invoice.id);
 if (error) { toast.error("Failed to void"); return; }
 toast.success("Invoice voided");
 onRefresh();
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="sm" onClick={onBack}>
 <ArrowLeft className="w-4 h-4 mr-1" /> Back
 </Button>
 <div>
 <h2 className="text-lg font-semibold">{invoice.invoice_number}</h2>
 <p className="text-sm text-muted-foreground">{invoice.title ||"Admin Invoice"}</p>
 </div>
 <Badge className={`${statusColors[invoice.status]} capitalize`}>{invoice.status.replace("_","")}</Badge>
 </div>
 <div className="flex gap-2">
 {!["paid","void"].includes(invoice.status) && (
 <>
 <Button variant="outline" size="sm" onClick={onEdit}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
 <Button size="sm" onClick={handleSendInvoice} disabled={sending}>
 {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
 {invoice.status ==="draft" ?"Send" :"Resend"}
 </Button>
 </>
 )}
 {["sent","partially_paid","overdue"].includes(invoice.status) && (
 <Button size="sm" onClick={() => { setPayAmount(String(invoice.amount_due)); setPaymentOpen(true); }}>
 <DollarSign className="w-4 h-4 mr-1" /> Record Payment
 </Button>
 )}
 {!["paid","void","cancelled"].includes(invoice.status) && (
 <Button variant="outline" size="sm" className="text-destructive" onClick={handleVoid}>Void</Button>
 )}
 </div>
 </div>

 <div className="grid md:grid-cols-3 gap-6">
 {/* Invoice Info */}
 <Card className="md:col-span-2">
 <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
 <CardContent className="space-y-6">
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-muted-foreground">Bill To</p>
 <p className="font-medium">{invoice.recipient_name}</p>
 <p className="text-muted-foreground capitalize">{invoice.recipient_type}</p>
 {invoice.recipient_email && <p className="text-muted-foreground">{invoice.recipient_email}</p>}
 </div>
 <div className="text-right">
 <p className="text-muted-foreground">Invoice Type</p>
 <p className="font-medium capitalize">{invoice.invoice_type?.replace("_","") ||"Ad-hoc"}</p>
 <p className="text-muted-foreground mt-2">Issue Date</p>
 <p>{format(new Date(invoice.issue_date +"T00:00:00"),"MMM d, yyyy")}</p>
 <p className="text-muted-foreground mt-2">Due Date</p>
 <p>{format(new Date(invoice.due_date +"T00:00:00"),"MMM d, yyyy")}</p>
 </div>
 </div>

 <Separator />

 {/* Line Items */}
 {loading ? (
 <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Description</TableHead>
 <TableHead className="text-center w-20">Qty</TableHead>
 <TableHead className="text-right w-28">Rate</TableHead>
 <TableHead className="text-right w-28">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item) => (
 <TableRow key={item.id}>
 <TableCell>{item.description}</TableCell>
 <TableCell className="text-center">{Number(item.quantity)}</TableCell>
 <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
 <TableCell className="text-right">${Number(item.amount).toFixed(2)}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}

 {/* Totals */}
 <div className="flex justify-end">
 <div className="w-64 space-y-2 text-sm">
 <div className="flex justify-between"><span>Subtotal</span><span>${Number(invoice.subtotal).toFixed(2)}</span></div>
 {Number(invoice.discount_amount) > 0 && (
 <div className="flex justify-between text-success"><span>Discount</span><span>-${Number(invoice.discount_amount).toFixed(2)}</span></div>
 )}
 {Number(invoice.tax_amount) > 0 && (
 <div className="flex justify-between"><span>Tax ({invoice.tax_rate}%)</span><span>${Number(invoice.tax_amount).toFixed(2)}</span></div>
 )}
 <div className="flex justify-between font-bold text-base border-t pt-2">
 <span>Total</span><span>${Number(invoice.total).toFixed(2)}</span>
 </div>
 <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>${Number(invoice.amount_paid).toFixed(2)}</span></div>
 <div className="flex justify-between font-bold text-primary">
 <span>Balance Due</span><span>${Number(invoice.amount_due).toFixed(2)}</span>
 </div>
 </div>
 </div>

 {/* Notes */}
 {invoice.notes && (
 <>
 <Separator />
 <div>
 <p className="text-sm font-medium mb-1">Notes</p>
 <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
 </div>
 </>
 )}
 {invoice.terms_conditions && (
 <div>
 <p className="text-sm font-medium mb-1">Terms & Conditions</p>
 <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms_conditions}</p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Payment History */}
 <Card>
 <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
 <CardContent>
 {payments.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">No payments recorded</p>
 ) : (
 <div className="space-y-3">
 {payments.map((p) => (
 <div key={p.id} className="p-3 rounded-md bg-muted/50 text-sm">
 <div className="flex justify-between items-center">
 <span className="font-medium text-success">${Number(p.amount).toFixed(2)}</span>
 <Badge variant="outline" className="text-xs capitalize">{p.payment_method.replace("_","")}</Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-1">{format(new Date(p.paid_at),"MMM d, yyyy h:mm a")}</p>
 {p.reference_number && <p className="text-xs text-muted-foreground">Ref: {p.reference_number}</p>}
 {p.notes && <p className="text-xs mt-1">{p.notes}</p>}
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Record Payment Dialog */}
 <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
 <DialogContent>
 <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <Label>Amount ($)</Label>
 <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="0" step="0.01" />
 <p className="text-xs text-muted-foreground">Balance due: ${Number(invoice.amount_due).toFixed(2)}</p>
 </div>
 <div className="space-y-1.5">
 <Label>Payment Method</Label>
 <Select value={payMethod} onValueChange={setPayMethod}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="stripe">Stripe</SelectItem>
 <SelectItem value="manual">Manual / Cash</SelectItem>
 <SelectItem value="check">Check</SelectItem>
 <SelectItem value="ach">ACH</SelectItem>
 <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label>Reference # (optional)</Label>
 <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Check #, transaction ID, etc." />
 </div>
 <div className="space-y-1.5">
 <Label>Notes (optional)</Label>
 <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
 <Button onClick={handleRecordPayment} disabled={recording}>
 {recording && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 Record Payment
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}

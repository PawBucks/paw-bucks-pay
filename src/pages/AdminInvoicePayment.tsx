import { useState, useEffect } from"react";
import { useParams, useSearchParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import logo from"@/assets/logo.png";

import { Formatters } from "@/utils/formatters";
export default function AdminInvoicePayment() {
 const { invoiceId } = useParams();
 const [searchParams] = useSearchParams();
 const token = searchParams.get("token");

 const [invoice, setInvoice] = useState<any>(null);
 const [items, setItems] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [paying, setPaying] = useState(false);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 loadInvoice();
 }, [invoiceId, token]);

 const loadInvoice = async () => {
 if (!invoiceId || !token) {
 setError("Invalid invoice link");
 setLoading(false);
 return;
 }

 const { data, error: fetchError } = await supabase.functions.invoke("get-public-admin-invoice", {
 body: { invoiceId, token },
 });

 if (fetchError || !data?.invoice) {
 setError("Invoice not found or link has expired");
 setLoading(false);
 return;
 }

 const invoiceData = data.invoice;

 setInvoice(invoiceData);
 setItems((invoiceData.admin_invoice_items || []).sort((a: any, b: any) => a.display_order - b.display_order));
 setLoading(false);
 };

 const handlePay = async () => {
 setPaying(true);
 try {
 const { data, error } = await supabase.functions.invoke("create-admin-invoice-payment", {
 body: { invoiceId, token },
 });
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 if (data?.url) {
 window.location.href = data.url;
 }
 } catch (err: any) {
 setError(err.message ||"Payment failed");
 setPaying(false);
 }
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-muted/30 flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 if (error && !invoice) {
 return (
 <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardContent className="pt-8 pb-6 text-center space-y-4">
 <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
 <h2 className="text-lg font-semibold">Unable to Load Invoice</h2>
 <p className="text-muted-foreground">{error}</p>
 </CardContent>
 </Card>
 </div>
 );
 }

 const amountDue = Number(invoice.amount_due ?? invoice.total);
 const isPaid = invoice.status ==="paid" || amountDue <= 0;

 return (
 <div className="min-h-screen bg-muted/30 py-8 px-4">
 <div className="max-w-2xl mx-auto space-y-6">
 {/* Logo Header */}
 <div className="text-center">
 <img src={logo} alt="PawBucks" className="h-16 mx-auto" />
 </div>

 <Card>
 <CardContent className="p-6 md:p-8 space-y-6">
 {/* Invoice Header */}
 <div className="text-center space-y-2">
 <p className="text-xs text-muted-foreground uppercase tracking-widest">Platform Invoice</p>
 <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
 {invoice.title && <p className="text-muted-foreground">{invoice.title}</p>}
 <Badge className={`capitalize ${isPaid ?"bg-success/15 text-success" :"bg-info/15 text-info"}`}>
 {isPaid ?"Paid" : invoice.status.replace("_", " ")}
 </Badge>
 </div>

 <Separator />

 {/* Dates & Recipient */}
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <p className="text-muted-foreground text-xs uppercase">Bill To</p>
 <p className="font-medium">{invoice.recipient_name}</p>
 <p className="text-muted-foreground capitalize">{invoice.recipient_type}</p>
 </div>
 <div className="text-right">
 <p className="text-muted-foreground text-xs uppercase">Due Date</p>
 <p className="font-medium">{new Date(invoice.due_date +"T00:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}</p>
 </div>
 </div>

 {invoice.description && (
 <>
 <Separator />
 <div>
 <p className="text-xs text-muted-foreground uppercase mb-1">Description</p>
 <p className="text-sm">{invoice.description}</p>
 </div>
 </>
 )}

 <Separator />

 {/* Line Items */}
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b text-muted-foreground text-xs uppercase">
 <th className="text-left py-2 pr-2">Description</th>
 <th className="text-center py-2 px-2 w-16">Qty</th>
 <th className="text-right py-2 px-2 w-24">Rate</th>
 <th className="text-right py-2 pl-2 w-24">Amount</th>
 </tr>
 </thead>
 <tbody>
 {items.map((item) => (
 <tr key={item.id} className="border-b border-border/50">
 <td className="py-3 pr-2">{item.description}</td>
 <td className="text-center py-3 px-2">{item.quantity}</td>
 <td className="text-right py-3 px-2">{Formatters.currency(Number(item.unit_price))}</td>
 <td className="text-right py-3 pl-2">{Formatters.currency(Number(item.amount))}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Totals */}
 <div className="flex justify-end">
 <div className="w-64 space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Subtotal</span>
 <span>{Formatters.currency(Number(invoice.subtotal))}</span>
 </div>
 {Number(invoice.discount_amount) > 0 && (
 <div className="flex justify-between text-success">
 <span>Discount</span>
 <span>-{Formatters.currency(Number(invoice.discount_amount))}</span>
 </div>
 )}
 {Number(invoice.tax_amount) > 0 && (
 <div className="flex justify-between">
 <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
 <span>{Formatters.currency(Number(invoice.tax_amount))}</span>
 </div>
 )}
 <div className="flex justify-between font-bold text-lg border-t pt-2">
 <span>Amount Due</span>
 <span className="text-primary">{Formatters.currency(amountDue)}</span>
 </div>
 </div>
 </div>

 {/* Pay Button */}
 {!isPaid && (
 <>
 <Separator />
 <div className="text-center space-y-3">
 {error && <p className="text-sm text-destructive">{error}</p>}
 <Button size="lg" className="w-full max-w-xs mx-auto" onClick={handlePay} disabled={paying}>
 {paying ? (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 ) : (
 <span className="w-4 h-4 mr-2" aria-hidden="true">💳</span>
 )}
 Pay {Formatters.currency(amountDue)}
 </Button>
 <p className="text-xs text-muted-foreground">Secure payment powered by Stripe</p>
 </div>
 </>
 )}

 {isPaid && (
 <div className="text-center py-4 space-y-2">
 <CheckCircle className="w-10 h-10 text-success mx-auto" />
 <p className="text-success font-medium">This invoice has been paid</p>
 </div>
 )}

 {/* Notes */}
 {invoice.notes && (
 <div className="bg-muted rounded-lg p-4">
 <p className="text-xs font-medium mb-1">Notes</p>
 <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
 </div>
 )}
 </CardContent>
 </Card>

 <p className="text-center text-xs text-muted-foreground">Powered by PawBucks</p>
 </div>
 </div>
 );
}

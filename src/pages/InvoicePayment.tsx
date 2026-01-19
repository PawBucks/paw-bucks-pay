import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  CreditCard,
  Building2,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Calendar,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { type Invoice } from "@/services/api/invoicing.service";

const InvoicePayment = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("token");
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [tipAmount, setTipAmount] = useState<string>("0");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId || !accessToken) {
        setLoading(false);
        return;
      }

      try {
        // Use edge function to securely fetch invoice with access token validation
        const { data, error } = await supabase.functions.invoke("get-public-invoice", {
          body: {
            invoiceId,
            accessToken,
          },
        });

        if (error) throw error;
        if (!data?.invoice) throw new Error("Invoice not found");
        
        setInvoice(data.invoice as any);
        setPaymentAmount((data.invoice.amount_due || data.invoice.total || 0).toFixed(2));

        if (data.merchant) setMerchant(data.merchant);
      } catch (error) {
        console.error("Error loading invoice:", error);
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, accessToken]);

  const handlePayment = async () => {
    if (!invoice || !merchant) return;

    setProcessing(true);
    try {
      const amount = parseFloat(paymentAmount) + parseFloat(tipAmount || "0");

      // Create Stripe checkout for invoice payment
      const { data, error } = await supabase.functions.invoke("create-invoice-payment", {
        body: {
          invoiceId: invoice.id,
          amount: Math.round(amount * 100), // Convert to cents
          tipAmount: Math.round(parseFloat(tipAmount || "0") * 100),
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast.error(error.message || "Failed to process payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPDF = async () => {
    // Generate and download PDF
    toast.info("Preparing PDF download...");
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoiceId: invoice?.id },
      });

      if (error) throw error;

      if (data?.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice || !accessToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
            <p className="text-muted-foreground">
              This invoice link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";
  const amountDue = invoice.amount_due || invoice.total;
  const amountPaid = invoice.amount_paid || 0;

  // Payment success page
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for your payment. A receipt has been sent to your email.
            </p>
            <p className="text-sm text-muted-foreground">
              Invoice #{invoice.invoice_number}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <SEO title={`Invoice ${invoice.invoice_number} | Payment`} />
      
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {merchant?.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={merchant.business_name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold">{merchant?.business_name}</h1>
              {merchant?.address && (
                <p className="text-sm text-muted-foreground">{merchant.address}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Invoice #{invoice.invoice_number}
                    </CardTitle>
                    <CardDescription>
                      {invoice.title || "Invoice Details"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={isPaid ? "default" : isOverdue ? "destructive" : "secondary"}
                    className="text-sm"
                  >
                    {isPaid ? "Paid" : isOverdue ? "Overdue" : invoice.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Issue Date</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(invoice.issue_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className={`font-medium flex items-center gap-1 ${isOverdue ? "text-destructive" : ""}`}>
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(invoice.due_date), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Bill To */}
                <div>
                  <h3 className="font-medium mb-2">Bill To</h3>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{invoice.client_name}</p>
                    {invoice.client_company && (
                      <p className="text-muted-foreground">{invoice.client_company}</p>
                    )}
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {invoice.client_email}
                    </p>
                    {invoice.client_phone && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {invoice.client_phone}
                      </p>
                    )}
                    {invoice.client_address && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {invoice.client_address}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Line Items */}
                <div>
                  <h3 className="font-medium mb-3">Items</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Rate</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>
                    {(invoice as any).invoice_items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 text-sm py-2 px-2 rounded bg-muted/50"
                      >
                        <div className="col-span-6">{item.description}</div>
                        <div className="col-span-2 text-right">{item.quantity}</div>
                        <div className="col-span-2 text-right">
                          ${Number(item.unit_price).toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right font-medium">
                          ${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${Number(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  {invoice.discount_amount && invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.tax_amount && invoice.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tax {invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}
                      </span>
                      <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.shipping_amount && invoice.shipping_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>${Number(invoice.shipping_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>${Number(invoice.total).toFixed(2)}</span>
                  </div>
                  {amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Amount Paid</span>
                        <span>-${Number(amountPaid).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Amount Due</span>
                        <span>${Number(amountDue).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Notes */}
                {invoice.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2">Notes</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {invoice.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Terms */}
                {invoice.terms_conditions && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2">Terms & Conditions</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {invoice.terms_conditions}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Panel */}
          <div className="space-y-4">
            {isPaid ? (
              <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-green-700 dark:text-green-400 mb-1">
                    Invoice Paid
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {invoice.paid_at
                      ? `Paid on ${format(parseISO(invoice.paid_at), "MMMM d, yyyy")}`
                      : "Thank you for your payment"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Pay Invoice
                  </CardTitle>
                  <CardDescription>
                    Secure payment via Stripe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Amount Due</p>
                    <p className="text-3xl font-bold">${Number(amountDue).toFixed(2)}</p>
                  </div>

                  {invoice.allow_partial_payments && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount">Payment Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="paymentAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={amountDue}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Partial payments accepted
                      </p>
                    </div>
                  )}

                  {invoice.allow_tips && (
                    <div className="space-y-2">
                      <Label htmlFor="tipAmount">Add a Tip (optional)</Label>
                      <Select value={tipAmount} onValueChange={setTipAmount}>
                        <SelectTrigger>
                          <SelectValue placeholder="No tip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No tip</SelectItem>
                          <SelectItem value={(amountDue * 0.1).toFixed(2)}>
                            10% (${(amountDue * 0.1).toFixed(2)})
                          </SelectItem>
                          <SelectItem value={(amountDue * 0.15).toFixed(2)}>
                            15% (${(amountDue * 0.15).toFixed(2)})
                          </SelectItem>
                          <SelectItem value={(amountDue * 0.2).toFixed(2)}>
                            20% (${(amountDue * 0.2).toFixed(2)})
                          </SelectItem>
                          <SelectItem value="custom">Custom amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between font-semibold">
                    <span>Total to Pay</span>
                    <span>
                      ${(parseFloat(paymentAmount || "0") + parseFloat(tipAmount || "0")).toFixed(2)}
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePayment}
                    disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Secure payment powered by Stripe
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            {(invoice as any).invoice_payments?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(invoice as any).invoice_payments.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">${Number(payment.amount).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(payment.payment_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {payment.payment_method}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Contact */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  Questions about this invoice?
                </p>
                <p className="text-sm font-medium text-center">
                  Contact {merchant?.contact_person || merchant?.business_name}
                </p>
                {merchant?.phone && (
                  <p className="text-sm text-center text-primary">
                    {merchant.phone}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        {invoice.footer && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            {invoice.footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicePayment;

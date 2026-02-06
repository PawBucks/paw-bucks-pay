import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
  Coins,
  Sparkles,
  UserX,
  ArrowLeft,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { type Invoice } from "@/services/api/invoicing.service";

const PAWBUCKS_TO_USD = 0.001; // 1 PawBuck = $0.001

const InvoicePayment = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const accessToken = searchParams.get("token");
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [tipAmount, setTipAmount] = useState<string>("0");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Guest checkout state
  const [guestCheckoutConfirmed, setGuestCheckoutConfirmed] = useState(false);
  const [showGuestOption, setShowGuestOption] = useState(false);
  
  // PawBucks state
  const [pawbucksBalance, setPawbucksBalance] = useState(0);
  const [pawbucksToUse, setPawbucksToUse] = useState(0);
  const [loadingPawbucks, setLoadingPawbucks] = useState(false);

  // Track the specific error reason for better UX
  const [errorReason, setErrorReason] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      // Log debugging info
      console.log("[InvoicePayment] Loading invoice:", { 
        invoiceId, 
        hasToken: !!accessToken,
        tokenLength: accessToken?.length,
        fullUrl: window.location.href 
      });

      if (!invoiceId) {
        console.error("[InvoicePayment] Missing invoice ID in URL");
        setErrorReason("missing_id");
        setLoading(false);
        return;
      }

      if (!accessToken) {
        console.error("[InvoicePayment] Missing access token in URL. Expected format: /invoice/:id/pay?token=xxx");
        setErrorReason("missing_token");
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

        console.log("[InvoicePayment] Edge function response:", { 
          hasData: !!data, 
          hasInvoice: !!data?.invoice, 
          error: error?.message 
        });

        if (error) throw error;
        if (!data?.invoice) {
          setErrorReason("not_found");
          throw new Error("Invoice not found");
        }
        
        setInvoice(data.invoice as any);
        setPaymentAmount((data.invoice.amount_due || data.invoice.total || 0).toFixed(2));

        if (data.merchant) setMerchant(data.merchant);
      } catch (error: any) {
        console.error("[InvoicePayment] Error loading invoice:", error);
        if (!errorReason) {
          setErrorReason("not_found");
        }
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId, accessToken]);

  // Check auth state - REQUIRED for all invoice payments
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("[Auth] Error getting user:", error);
          setUser(null);
        } else {
          console.log("[Auth] Current user:", currentUser?.id, currentUser?.email);
          setUser(currentUser);
        }
      } catch (error) {
        console.error("[Auth] Unexpected error:", error);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes (e.g., user logs in from redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Auth state changed:", event, session?.user?.email);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load PawBucks balance when user is authenticated and invoice is loaded
  // Load PawBucks balance when user is authenticated and invoice is loaded
  useEffect(() => {
    const loadPawbucksBalance = async () => {
      // Always try to load if user is logged in (even if invoice doesn't accept pawbucks, for display)
      if (!user) {
        console.log("[PawBucks] No user logged in, skipping balance load");
        return;
      }
      
      console.log("[PawBucks] Loading balance for user:", user.id, "email:", user.email);
      console.log("[PawBucks] Invoice accepts PawBucks:", invoice?.accept_pawbucks);
      
      setLoadingPawbucks(true);
      try {
        const { data: wallet, error } = await supabase
          .from("pawbucks_wallet")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error) {
          console.error("[PawBucks] Error fetching wallet:", error);
        } else if (wallet) {
          console.log("[PawBucks] Wallet found! Balance:", wallet.balance);
          setPawbucksBalance(wallet.balance);
        } else {
          console.log("[PawBucks] No wallet found for user");
          setPawbucksBalance(0);
        }
      } catch (error) {
        console.error("[PawBucks] Unexpected error loading balance:", error);
      } finally {
        setLoadingPawbucks(false);
      }
    };

    loadPawbucksBalance();
  }, [user, invoice]);

  const totalPayment = parseFloat(paymentAmount || "0") + parseFloat(tipAmount || "0");
  const pawbucksValueUSD = pawbucksToUse * PAWBUCKS_TO_USD;
  const stripeAmount = Math.max(0, totalPayment - pawbucksValueUSD);
  const maxPawbucksCanUse = Math.min(
    pawbucksBalance,
    Math.floor(totalPayment / PAWBUCKS_TO_USD)
  );

  const handlePayment = async () => {
    if (!invoice || !merchant) return;

    // Determine if this is a guest checkout
    const isGuestCheckout = !user && guestCheckoutConfirmed;

    setProcessing(true);
    try {
      const totalCents = Math.round(totalPayment * 100);
      // Guests cannot use PawBucks
      const pawbucksCents = isGuestCheckout ? 0 : Math.round(pawbucksValueUSD * 100);
      const tipCents = Math.round(parseFloat(tipAmount || "0") * 100);

      // Use the edge function that handles PawBucks
      const { data, error } = await supabase.functions.invoke("process-invoice-pawbucks-payment", {
        body: {
          invoiceId: invoice.id,
          totalAmountCents: totalCents,
          pawbucksAmountCents: pawbucksCents,
          tipAmountCents: tipCents,
          userId: user?.id,
          accessToken,
          isGuestCheckout,
        },
      });

      if (error) throw error;

      if (data?.success && data?.paymentMethod === "pawbucks") {
        // Full PawBucks payment completed
        toast.success(`Payment completed with ${data.pawbucksUsed} PawBucks!`);
        navigate(`/invoice/${invoiceId}/success?pawbucks=true`);
      } else if (data?.checkoutUrl || data?.url) {
        // Redirect to Stripe checkout (handle both field names for compatibility)
        window.location.href = data.checkoutUrl || data.url;
      } else if (data?.success) {
        // Success but no redirect needed
        toast.success("Payment processed successfully!");
        navigate(`/invoice/${invoiceId}/success`);
      } else {
        throw new Error("No checkout URL received from payment processor");
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
    // Determine the specific error message based on what's missing
    const getErrorMessage = () => {
      if (errorReason === "missing_token") {
        return {
          title: "Invalid Invoice Link",
          message: "The invoice link is incomplete. Please use the full link from your email or request a new one from the sender."
        };
      }
      if (errorReason === "missing_id") {
        return {
          title: "Invalid Invoice Link",
          message: "The invoice link is malformed. Please use the link from your email or request a new one from the sender."
        };
      }
      return {
        title: "Invoice Not Found",
        message: "This invoice link is invalid, has expired, or the invoice no longer exists. Please contact the sender for a new link."
      };
    };

    const errorInfo = getErrorMessage();

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{errorInfo.title}</h2>
            <p className="text-muted-foreground mb-4">
              {errorInfo.message}
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/"}
              className="mt-2"
            >
              Go to Home
            </Button>
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
          <div className="flex items-center gap-2">
            {user && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
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
            ) : authLoading ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Checking authentication...</p>
                </CardContent>
              </Card>
            ) : !user && !guestCheckoutConfirmed ? (
              /* Login Recommended - But can proceed as guest */
              <Card className="border-primary/50">
                <CardHeader className="text-center pb-2">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 flex items-center justify-center mx-auto mb-3">
                    <Coins className="h-8 w-8 text-amber-600" />
                  </div>
                  <CardTitle>Sign In to Earn Rewards</CardTitle>
                  <CardDescription>
                    Sign in to earn up to 30x PawBucks on this purchase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Earn up to 30x PawBucks rewards</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Pay with PawBucks + credit card</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Track all your payment history</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Receive payment receipts via email</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
                    <p className="text-2xl font-bold">${Number(amountDue).toFixed(2)}</p>
                  </div>
                  
                  <Button 
                    className="w-full"
                    size="lg"
                    onClick={() => navigate(`/auth?redirect=/invoice/${invoiceId}/pay?token=${accessToken}`)}
                  >
                    Sign In to Pay
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    Don't have an account? You can create one during sign in.
                  </p>
                  
                  <Separator />
                  
                  {/* Guest Checkout Option */}
                  {!showGuestOption ? (
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground"
                      onClick={() => setShowGuestOption(true)}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Continue without signing in
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-900 dark:text-amber-100">
                            You won't earn PawBucks
                          </p>
                          <p className="text-amber-700 dark:text-amber-300 mt-1">
                            By proceeding as a guest, you will not earn any PawBucks rewards on this purchase.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="guest-confirm"
                          checked={guestCheckoutConfirmed}
                          onCheckedChange={(checked) => setGuestCheckoutConfirmed(checked === true)}
                          className="mt-0.5"
                        />
                        <Label 
                          htmlFor="guest-confirm" 
                          className="text-sm text-amber-800 dark:text-amber-200 cursor-pointer leading-tight"
                        >
                          I understand that I will not earn PawBucks on this purchase by continuing as a guest.
                        </Label>
                      </div>
                    </div>
                  )}
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
                    {!user ? (
                      "Guest checkout - no rewards earned"
                    ) : invoice.accept_pawbucks ? (
                      "Pay with credit card, PawBucks, or both"
                    ) : (
                      "Secure payment via Stripe"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Guest checkout warning banner */}
                  {!user && guestCheckoutConfirmed && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <UserX className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Paying as guest - no PawBucks rewards will be earned.{" "}
                        <button 
                          className="underline font-medium"
                          onClick={() => {
                            setGuestCheckoutConfirmed(false);
                            setShowGuestOption(false);
                          }}
                        >
                          Sign in instead
                        </button>
                      </p>
                    </div>
                  )}

                  {/* Payment UI */}
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

                  {/* PawBucks Payment Option - Only show for logged-in users when invoice OR merchant accepts PawBucks */}
                  {user && (invoice.accept_pawbucks || merchant?.accepts_pawbucks) && (
                    <div className="space-y-3 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-amber-600" />
                          <span className="font-medium text-amber-900 dark:text-amber-100">Pay with PawBucks</span>
                        </div>
                        {loadingPawbucks ? (
                          <Badge variant="outline" className="bg-white dark:bg-background">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Loading...
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-white dark:bg-background">
                            Balance: {pawbucksBalance.toLocaleString()} PB
                          </Badge>
                        )}
                      </div>

                      {pawbucksBalance > 0 ? (
                        <>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">PawBucks to use</span>
                              <span className="font-medium">
                                {pawbucksToUse.toLocaleString()} PB = ${pawbucksValueUSD.toFixed(2)}
                              </span>
                            </div>
                            <Slider
                              value={[pawbucksToUse]}
                              min={0}
                              max={maxPawbucksCanUse}
                              step={100}
                              onValueChange={([value]) => setPawbucksToUse(value)}
                              className="py-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0 PB</span>
                              <span>{maxPawbucksCanUse.toLocaleString()} PB</span>
                            </div>
                          </div>

                          {pawbucksToUse > 0 && (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <Sparkles className="h-4 w-4" />
                              <span>Saving ${pawbucksValueUSD.toFixed(2)} with PawBucks!</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            You don't have any PawBucks yet. Pay with card and earn up to 30x PawBucks rewards on this purchase!
                          </p>
                          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                            <Sparkles className="h-3 w-3" />
                            <span>Use earned PawBucks on future invoices</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Payment Summary */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${totalPayment.toFixed(2)}</span>
                    </div>
                    {pawbucksToUse > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>PawBucks ({pawbucksToUse.toLocaleString()} PB)</span>
                        <span>-${pawbucksValueUSD.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>{stripeAmount > 0 ? "Card Payment" : "Total"}</span>
                      <span>${stripeAmount.toFixed(2)}</span>
                    </div>
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
                    ) : stripeAmount > 0 ? (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay ${stripeAmount.toFixed(2)} Now
                      </>
                    ) : (
                      <>
                        <Coins className="h-4 w-4 mr-2" />
                        Pay with PawBucks
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {stripeAmount > 0 
                      ? "Secure payment powered by Stripe"
                      : "Payment will be processed instantly"
                    }
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

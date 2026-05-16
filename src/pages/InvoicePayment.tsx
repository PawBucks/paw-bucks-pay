import { useState, useEffect } from"react";
import { useParams, useSearchParams, useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Slider } from"@/components/ui/slider";
import { Checkbox } from"@/components/ui/checkbox";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { CheckCircle, AlertCircle, Loader2, Download, UserX, ArrowLeft } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { format, parseISO } from"date-fns";
import { toast } from"sonner";
import { type Invoice } from"@/services/api/invoicing.service";

import { Formatters } from "@/utils/formatters";
import pawbucksLogo from "@/assets/pawbucks-logo.png";
import { PawBucksLogo } from "@/components/PawBucksLogo";
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
 setPaymentAmount(Formatters.money((data.invoice.amount_due || data.invoice.total || 0)));

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
 
 console.log("[PawBucks] Loading balance for user:", user.id,"email:", user.email);
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

              // Default behavior: apply the maximum PawBucks possible to the balance
              // unless the user has explicitly configured a different auto-redeem strategy.
              // This removes friction — the CDO feedback was that users shouldn't have to
              // hunt for a slider to get the discount they already earned.
 try {
 const { data: profile } = await supabase
 .from("profiles")
 .select("auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct")
 .eq("id", user.id)
 .maybeSingle();
                // Treat unset / "off" as "always apply max" by default for invoices.
                const mode = (profile?.auto_redeem_mode as string) ||"always";
 const minCoverage = profile?.auto_redeem_min_coverage_pct ?? 20;
 const maxApply = profile?.auto_redeem_max_apply_pct ?? 50;
 const baseAmount = Number((invoice as any)?.balance_due ?? invoice?.total ?? 0);
                if (baseAmount > 0 && wallet.balance > 0 && mode !== "off") {
 const PB_TO_USD = 0.001;
 const maxNeededPB = Math.floor(baseAmount / PB_TO_USD);
 let apply = 0;
                  if (mode ==="always" || mode === "smart_max") {
 apply = Math.min(wallet.balance, maxNeededPB);
 } else {
 const coveragePct = ((wallet.balance * PB_TO_USD) / baseAmount) * 100;
 if (coveragePct >= minCoverage) {
 const capPB = Math.floor(((baseAmount * maxApply) / 100) / PB_TO_USD);
 apply = Math.min(wallet.balance, capPB, maxNeededPB);
                    } else {
                      // Even if coverage is below threshold, default to applying max
                      // (better UX: never silently leave money on the table)
                      apply = Math.min(wallet.balance, maxNeededPB);
 }
 }
 if (apply > 0) {
                    console.log("[PawBucks] Auto-applied (default max):", { mode, apply });
 setPawbucksToUse(apply);
 }
 }
 } catch (arErr) {
 console.warn("[PawBucks] Auto-redeem pre-apply failed (non-fatal):", arErr);
 }
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

 const basePaymentAmount = parseFloat(paymentAmount ||"0");
 const tipValue = parseFloat(tipAmount ||"0");
 const totalPayment = basePaymentAmount + tipValue;
 const pawbucksValueUSD = pawbucksToUse * PAWBUCKS_TO_USD;
 // PawBucks can only cover the base amount, NOT the tip
 const stripeAmount = Math.max(0, basePaymentAmount - pawbucksValueUSD) + tipValue;
 const maxPawbucksCanUse = Math.min(
 pawbucksBalance,
 Math.floor(basePaymentAmount / PAWBUCKS_TO_USD) // Based on base amount only, excluding tip
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
 const tipCents = Math.round(parseFloat(tipAmount ||"0") * 100);

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

 if (data?.success && data?.paymentMethod ==="pawbucks") {
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
 toast.error(error.message ||"Failed to process payment");
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
 window.open(data.pdfUrl,"_blank");
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
 if (errorReason ==="missing_token") {
 return {
 title:"Invalid Invoice Link",
 message:"The invoice link is incomplete. Please use the full link from your email or request a new one from the sender."
 };
 }
 if (errorReason ==="missing_id") {
 return {
 title:"Invalid Invoice Link",
 message:"The invoice link is malformed. Please use the link from your email or request a new one from the sender."
 };
 }
 return {
 title:"Invoice Not Found",
 message:"This invoice link is invalid, has expired, or the invoice no longer exists. Please contact the sender for a new link."
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
 onClick={() => window.location.href ="/"}
 className="mt-2"
 >
 Go to Home
 </Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 const isPaid = invoice.status ==="paid";
  // Only treat as overdue when the due date is strictly in the past (calendar days),
  // not when the DB status was flipped on the same day. Avoids "0 days overdue" UX.
  const dueDateOnly = invoice.due_date ? parseISO(invoice.due_date) : null;
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const daysOverdue = dueDateOnly
    ? Math.floor((todayStart.getTime() - new Date(dueDateOnly.getFullYear(), dueDateOnly.getMonth(), dueDateOnly.getDate()).getTime()) / 86400000)
    : 0;
  const isOverdue = !isPaid && daysOverdue > 0;
  const isDueToday = !isPaid && daysOverdue === 0;
  const amountDue = Number(invoice.amount_due ?? invoice.total ?? 0);
  const amountPaid = Number(invoice.amount_paid ?? 0);

 // Payment success page
 if (paymentSuccess) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardContent className="pt-6 text-center">
 <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
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
  <div className="min-h-screen bg-muted/30">
  <SEO title={`Invoice ${invoice.invoice_number} | Payment`} />

  {/* Sticky top nav */}
  <div className="sticky top-0 z-20 bg-background border-b border-border">
    <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
      {user ? (
        <Button variant="ghost" size="sm" className="text-primary -ml-2" onClick={() => navigate("/home")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Button>
      ) : <div />}
      <Button variant="ghost" size="sm" className="text-primary -mr-2" onClick={handleDownloadPDF}>
        <Download className="h-4 w-4 mr-1" /> Download
      </Button>
    </div>
  </div>

  <div className="max-w-2xl mx-auto px-4 pt-4 pb-10 space-y-3">
    {/* Hero header */}
    <div className="bg-background rounded-2xl p-5 flex items-start gap-4 shadow-sm">
      {merchant?.logo_url ? (
        <img src={merchant.logo_url} alt={merchant.business_name} className="h-14 w-14 rounded-xl object-cover shadow-sm shrink-0" />
      ) : (
        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="h-7 w-7 text-primary" aria-hidden="true">🏢</span>
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight truncate">{merchant?.business_name}</h1>
        {merchant?.address && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{merchant.address}</p>
        )}
      </div>
    </div>

    {/* Invoice meta */}
    <div className="bg-background rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">#{invoice.invoice_number}</p>
          <p className="text-lg font-semibold truncate mt-0.5">{invoice.title || "Invoice"}</p>
        </div>
        <Badge
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            isPaid
              ? "bg-success text-success-foreground"
              : isOverdue
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {isPaid
            ? "Paid"
            : isOverdue
            ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`
            : isDueToday
            ? "Due Today"
            : "Due"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Issue Date</p>
          <p className="font-medium">{format(parseISO(invoice.issue_date), "MMM d, yyyy")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Due Date</p>
          <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
            {format(parseISO(invoice.due_date), "MMM d, yyyy")}
          </p>
        </div>
      </div>
    </div>

    {/* Bill To */}
    <div className="bg-background rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bill To</p>
      <p className="font-semibold">{invoice.client_name}</p>
      {invoice.client_company && <p className="text-sm text-muted-foreground">{invoice.client_company}</p>}
      <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
      {invoice.client_phone && <p className="text-sm text-muted-foreground">{invoice.client_phone}</p>}
      {invoice.client_address && <p className="text-sm text-muted-foreground">{invoice.client_address}</p>}
    </div>

    {/* Items */}
    <div className="bg-background rounded-2xl p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Items</p>
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
        <div className="col-span-6">Description</div>
        <div className="col-span-2 text-right">Qty</div>
        <div className="col-span-2 text-right">Rate</div>
        <div className="col-span-2 text-right">Amount</div>
      </div>
      {(invoice as any).invoice_items
        ?.filter((item: any) => item.description || Number(item.quantity) > 0 || Number(item.unit_price) > 0)
        .map((item: any) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 text-sm py-3 border-b border-border/60 last:border-0 items-center">
            <div className="col-span-6 font-medium">{item.description || "—"}</div>
            <div className="col-span-2 text-right">{item.quantity}</div>
            <div className="col-span-2 text-right text-muted-foreground">{Formatters.currency(Number(item.unit_price))}</div>
            <div className="col-span-2 text-right font-semibold">{Formatters.currency(Number(item.quantity) * Number(item.unit_price))}</div>
          </div>
        ))}

      {/* Totals */}
      <div className="pt-3 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{Formatters.currency(Number(invoice.subtotal))}</span>
        </div>
        {Number(invoice.discount_amount) > 0 && (
          <div className="flex justify-between text-primary">
            <span>Discount</span>
            <span className="font-semibold">-{Formatters.currency(Number(invoice.discount_amount))}</span>
          </div>
        )}
        {Number(invoice.tax_amount) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax {invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}</span>
            <span>{Formatters.currency(Number(invoice.tax_amount))}</span>
          </div>
        )}
        {Number(invoice.shipping_amount) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{Formatters.currency(Number(invoice.shipping_amount))}</span>
          </div>
        )}
        <Separator className="my-1" />
        {amountPaid > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Amount paid</span>
            <span>-{Formatters.currency(amountPaid)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1">
          <span className="text-base font-semibold">
            {isPaid ? "Total Paid" : amountPaid > 0 ? "Balance Due" : "Total"}
          </span>
          <span className="text-2xl font-bold text-primary">
            {Formatters.currency(isPaid ? Number(invoice.total ?? 0) : amountDue)}
          </span>
        </div>
      </div>
    </div>

    {/* Notes */}
    {invoice.notes && (
      <div className="bg-background rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
      </div>
    )}
    {invoice.terms_conditions && (
      <div className="bg-background rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Terms &amp; Conditions</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{invoice.terms_conditions}</p>
      </div>
    )}

    {/* Payment Panel */}
    <div className="space-y-3">
 {isPaid ? (
 <Card className="border-success/20 bg-success/10">
 <CardContent className="pt-6 text-center">
 <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
 <h3 className="font-semibold text-success mb-1">
 Invoice Paid
 </h3>
 <p className="text-sm text-success 0">
 {invoice.paid_at
 ? `Paid on ${format(parseISO(invoice.paid_at),"MMMM d, yyyy")}`
 :"Thank you for your payment"}
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
 <Card className="border-primary">
                <CardHeader className="text-center pb-2">
                  <img src={pawbucksLogo} alt="PawBucks" className="h-16 w-16 mx-auto mb-3 object-contain" />
 <CardTitle>Sign In to Earn Rewards</CardTitle>
 <CardDescription>
 Sign in to earn up to 30x PawBucks on this purchase
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2 text-sm">
 <div className="flex items-center gap-2 text-muted-foreground">
 <CheckCircle className="h-4 w-4 text-success" />
 <span>Earn up to 30x PawBucks rewards</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <CheckCircle className="h-4 w-4 text-success" />
 <span>Pay with PawBucks + credit card</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <CheckCircle className="h-4 w-4 text-success" />
 <span>Track all your payment history</span>
 </div>
 <div className="flex items-center gap-2 text-muted-foreground">
 <CheckCircle className="h-4 w-4 text-success" />
 <span>Receive payment receipts via email</span>
 </div>
 </div>
 
 <Separator />
 
 <div className="p-4 bg-muted rounded-lg text-center">
 <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
 <p className="text-2xl font-bold">{Formatters.currency(Number(amountDue))}</p>
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
 <div className="space-y-3 p-4 bg-warning/10 rounded-lg border border-warning/20">
 <div className="flex items-start gap-2">
 <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
 <div className="text-sm">
 <p className="font-medium text-warning">
 You won't earn PawBucks
 </p>
 <p className="text-warning mt-1">
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
 className="text-sm text-warning cursor-pointer leading-tight"
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
 <span className="h-5 w-5" aria-hidden="true">💳</span>
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
 <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
 <UserX className="h-4 w-4 text-warning shrink-0" />
 <p className="text-xs text-warning">
 Paying as guest - no PawBucks rewards will be earned.{""}
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
 <p className="text-3xl font-bold">{Formatters.currency(Number(amountDue))}</p>
 </div>

 {invoice.allow_partial_payments && (
 <div className="space-y-2">
 <Label htmlFor="paymentAmount">Payment Amount</Label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true">💵</span>
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
 <SelectItem value={Formatters.money((amountDue * 0.1))}>
 10% ({Formatters.currency((amountDue * 0.1))})
 </SelectItem>
 <SelectItem value={Formatters.money((amountDue * 0.15))}>
 15% ({Formatters.currency((amountDue * 0.15))})
 </SelectItem>
 <SelectItem value={Formatters.money((amountDue * 0.2))}>
 20% ({Formatters.currency((amountDue * 0.2))})
 </SelectItem>
 <SelectItem value="custom">Custom amount</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}

 {/* PawBucks Payment Option - Only show for logged-in users when invoice OR merchant accepts PawBucks */}
                {user && (invoice.accept_pawbucks || merchant?.accepts_pawbucks) && (
                  <div className="space-y-3 p-4 bg-muted/40 rounded-lg border border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
                        <PawBucksLogo className="h-5 w-5 text-primary" />
                        <span className="font-medium text-foreground">Apply PawBucks</span>
 </div>
 {loadingPawbucks ? (
                        <Badge variant="outline" className="bg-background">
 <Loader2 className="h-3 w-3 animate-spin mr-1" />
 Loading...
 </Badge>
 ) : (
                        <Badge variant="outline" className="bg-background">
 Balance: {pawbucksBalance.toLocaleString()} PB
 </Badge>
 )}
 </div>

 {pawbucksBalance > 0 ? (
 <>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Applied to this invoice</span>
 <span className="font-medium">
 {pawbucksToUse.toLocaleString()} PB = {Formatters.currency(pawbucksValueUSD)}
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
 <div className="flex items-center gap-2 text-sm text-success">
 <Sparkles className="h-4 w-4" />
 <span>Saving {Formatters.currency(pawbucksValueUSD)} with PawBucks!</span>
 </div>
 )}
 </>
 ) : (
 <div className="space-y-2">
 <p className="text-sm text-muted-foreground">
 You don't have any PawBucks yet. Pay with card and earn up to 30x PawBucks rewards on this purchase!
 </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                    <span className="text-muted-foreground">Invoice amount</span>
                    <span>{Formatters.currency(basePaymentAmount)}</span>
                  </div>
                  {tipValue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span>{Formatters.currency(tipValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>Subtotal</span>
 <span>{Formatters.currency(totalPayment)}</span>
 </div>
 {pawbucksToUse > 0 && (
 <div className="flex justify-between text-success">
                      <span>PawBucks applied ({pawbucksToUse.toLocaleString()} PB)</span>
 <span>-{Formatters.currency(pawbucksValueUSD)}</span>
 </div>
 )}
 <Separator />
 <div className="flex justify-between font-semibold text-base">
                    <span>{stripeAmount > 0 ?"Balance to charge card" :"Total"}</span>
 <span>{Formatters.currency(stripeAmount)}</span>
 </div>
                  {pawbucksToUse > 0 && user && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>PawBucks balance after payment</span>
                      <span>{Math.max(0, pawbucksBalance - pawbucksToUse).toLocaleString()} PB</span>
                    </div>
                  )}
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
 <span className="h-4 w-4 mr-2" aria-hidden="true">💳</span>
 Pay {Formatters.currency(stripeAmount)} Now
 </>
 ) : (
 <>
 <PawBucksLogo className="h-4 w-4 mr-2" />
 Pay with PawBucks
 </>
 )}
 </Button>

 <p className="text-xs text-center text-muted-foreground">
 {stripeAmount > 0 
 ?"Secure payment powered by Stripe"
 :"Payment will be processed instantly"
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
 <p className="font-medium">{Formatters.currency(Number(payment.amount))}</p>
 <p className="text-xs text-muted-foreground">
 {format(parseISO(payment.payment_date),"MMM d, yyyy")}
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

    </div>

    {/* Contact card */}
    <div className="bg-background rounded-2xl p-5 shadow-sm text-center">
      <p className="text-sm text-muted-foreground">Questions about this invoice?</p>
      <p className="text-sm font-semibold mt-1">
        Contact {merchant?.contact_person || merchant?.business_name}
      </p>
      {merchant?.phone && (
        <a href={`tel:${merchant.phone}`} className="text-sm text-primary font-semibold">
          → {merchant.phone}
        </a>
      )}
    </div>

    {invoice.footer && (
      <p className="text-center text-xs text-muted-foreground pt-2">{invoice.footer}</p>
    )}
    <p className="text-center text-xs text-muted-foreground/70 pt-1 tracking-wider">pawbucks.app</p>
  </div>
  </div>
 );
};

export default InvoicePayment;

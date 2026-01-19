import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, Download, Home, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const InvoicePaymentSuccess = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!invoiceId) {
        setError("Invalid invoice");
        setLoading(false);
        return;
      }

      try {
        // Fetch the invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoiceData) {
          throw new Error("Invoice not found");
        }

        setInvoice(invoiceData);

        // Fetch merchant
        const { data: merchantData } = await supabase
          .from("merchants")
          .select("*")
          .eq("id", invoiceData.merchant_id)
          .single();

        if (merchantData) setMerchant(merchantData);

        // If we have a session ID, the webhook will handle updating the invoice
        // Just display success to the user
        if (sessionId) {
          console.log("Payment session:", sessionId);
        }
      } catch (err: any) {
        console.error("Error verifying payment:", err);
        setError(err.message || "Failed to verify payment");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [invoiceId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link to="/">
              <Button>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20">
      <SEO title="Payment Successful" />
      
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
              Payment Successful!
            </h1>
            
            <p className="text-muted-foreground mb-6">
              Thank you for your payment. A confirmation receipt has been sent to your email.
            </p>

            {invoice && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invoice</span>
                    <p className="font-medium">#{invoice.invoice_number}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <p className="font-medium text-green-600">
                      ${Number(invoice.total).toFixed(2)}
                    </p>
                  </div>
                </div>
                {merchant && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-muted-foreground text-sm">Paid to</span>
                    <p className="font-medium">{merchant.business_name}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
              <Link to="/">
                <Button>
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-8">
          If you have any questions about this payment, please contact {merchant?.business_name || "the merchant"}.
        </p>
      </div>
    </div>
  );
};

export default InvoicePaymentSuccess;

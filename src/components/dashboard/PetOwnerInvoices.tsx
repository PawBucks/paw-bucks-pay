import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  CreditCard, 
  Calendar,
  ChevronRight,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";

interface PetOwnerInvoice {
  id: string;
  invoice_number: string;
  merchant_id: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  amount_due: number;
  access_token: string;
  client_name: string;
  title?: string;
  merchant?: {
    business_name: string;
    logo_url?: string;
  };
}

interface PetOwnerInvoicesProps {
  userEmail: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  paid: { label: "Paid", variant: "default", icon: CheckCircle2 },
  partially_paid: { label: "Partially Paid", variant: "secondary", icon: Clock },
  sent: { label: "Outstanding", variant: "outline", icon: FileText },
  viewed: { label: "Outstanding", variant: "outline", icon: FileText },
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  overdue: { label: "Overdue", variant: "destructive", icon: AlertCircle },
};

export function PetOwnerInvoices({ userEmail }: PetOwnerInvoicesProps) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<PetOwnerInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        // Fetch invoices where the client email matches the user's email
        const { data, error } = await supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            merchant_id,
            status,
            issue_date,
            due_date,
            total,
            amount_paid,
            amount_due,
            access_token,
            client_name,
            title,
            merchants!invoices_merchant_id_fkey (
              business_name,
              logo_url
            )
          `)
          .eq("client_email", userEmail)
          .in("status", ["sent", "viewed", "paid", "partially_paid", "overdue"])
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("[PetOwnerInvoices] Error fetching invoices:", error);
          setInvoices([]);
        } else {
          // Transform to flatten merchant data
          const transformedInvoices = (data || []).map((inv: any) => ({
            ...inv,
            merchant: inv.merchants,
          }));
          setInvoices(transformedInvoices);
        }
      } catch (error) {
        console.error("[PetOwnerInvoices] Unexpected error:", error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [userEmail]);

  const handlePayInvoice = (invoice: PetOwnerInvoice) => {
    // Navigate to invoice payment page with access token
    navigate(`/invoice/${invoice.id}/pay?token=${invoice.access_token}`);
  };

  const getDisplayStatus = (invoice: PetOwnerInvoice) => {
    // Check if overdue
    if (invoice.status !== "paid" && isAfter(new Date(), parseISO(invoice.due_date))) {
      return "overdue";
    }
    return invoice.status;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            My Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return null; // Don't show the card if there are no invoices
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          My Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invoices.map((invoice) => {
          const displayStatus = getDisplayStatus(invoice);
          const config = statusConfig[displayStatus] || statusConfig.sent;
          const StatusIcon = config.icon;
          const isPaid = displayStatus === "paid";
          const showPayButton = !isPaid && invoice.amount_due > 0;

          return (
            <div
              key={invoice.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              {/* Merchant Logo */}
              <div className="flex-shrink-0">
                {invoice.merchant?.logo_url ? (
                  <img
                    src={invoice.merchant.logo_url}
                    alt={invoice.merchant.business_name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">
                    {invoice.merchant?.business_name || "Unknown Merchant"}
                  </span>
                  <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>#{invoice.invoice_number}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due {format(parseISO(invoice.due_date), "MMM d, yyyy")}
                  </span>
                </div>
              </div>

              {/* Amount & Action */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  {isPaid ? (
                    <span className="text-lg font-semibold text-green-600">
                      ${Number(invoice.total).toFixed(2)}
                    </span>
                  ) : (
                    <>
                      <span className="text-lg font-semibold text-foreground">
                        ${Number(invoice.amount_due).toFixed(2)}
                      </span>
                      {invoice.amount_paid > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ${Number(invoice.amount_paid).toFixed(2)} paid
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                {showPayButton ? (
                  <Button 
                    size="sm" 
                    onClick={() => handlePayInvoice(invoice)}
                    className="gap-1"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handlePayInvoice(invoice)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { FileText, ChevronRight, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from"date-fns";

import { Formatters } from "@/utils/formatters";
import { invoicingService } from "@/services/api/invoicing.service";
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
 access_token?: string | null;
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

const statusConfig: Record<string, { label: string; variant:"default" |"secondary" |"destructive" |"outline"; icon: React.ElementType }> = {
 paid: { label:"Paid", variant:"default", icon: CheckCircle2 },
 partially_paid: { label:"Partially Paid", variant:"secondary", icon: Clock },
 sent: { label:"Outstanding", variant:"outline", icon: FileText },
 viewed: { label:"Outstanding", variant:"outline", icon: FileText },
 draft: { label:"Draft", variant:"secondary", icon: FileText },
 overdue: { label:"Overdue", variant:"destructive", icon: AlertCircle },
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
 const { data: invoicesData, error: invoicesError } = await supabase
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
 client_name,
 title
 `)
 .eq("client_email", userEmail)
 .in("status", ["sent","viewed","paid","partially_paid","overdue"])
 .order("created_at", { ascending: false })
 .limit(10);

 if (invoicesError) {
 console.error("[PetOwnerInvoices] Error fetching invoices:", invoicesError);
 setInvoices([]);
 return;
 }

 if (!invoicesData || invoicesData.length === 0) {
 setInvoices([]);
 return;
 }

 // Get unique merchant IDs and fetch from merchants_public view
 const merchantIds = [...new Set(invoicesData.map(inv => inv.merchant_id))];
 const { data: merchantsData, error: merchantsError } = await supabase
 .from("merchants_public")
 .select("id, business_name, logo_url")
 .in("id", merchantIds);

 if (merchantsError) {
 console.error("[PetOwnerInvoices] Error fetching merchants:", merchantsError);
 }

 // Create a map of merchant data for quick lookup
 const merchantMap = new Map(
 (merchantsData || []).map(m => [m.id, { business_name: m.business_name, logo_url: m.logo_url }])
 );

 // Transform invoices with merchant data
 const transformedInvoices = invoicesData.map((inv: any) => ({
 ...inv,
 merchant: merchantMap.get(inv.merchant_id) || null,
 }));
 setInvoices(transformedInvoices);
 } catch (error) {
 console.error("[PetOwnerInvoices] Unexpected error:", error);
 setInvoices([]);
 } finally {
 setLoading(false);
 }
 };

 fetchInvoices();
 }, [userEmail]);

 const handlePayInvoice = async (invoice: PetOwnerInvoice) => {
  const { data, error } = await invoicingService.getInvoicePaymentLink(invoice.id);
  if (error || !data?.paymentUrl) {
  toast.error("Unable to open invoice link");
  return;
  }
  window.location.href = data.paymentUrl;
 };

 const getDisplayStatus = (invoice: PetOwnerInvoice) => {
    // Only flag overdue when due date is strictly before today's date (whole-day comparison).
    // Prevents "Overdue" badge appearing on the same calendar day as the due date.
    if (invoice.status === "paid") return invoice.status;
    const due = parseISO(invoice.due_date);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const todayDay = new Date(); todayDay.setHours(0, 0, 0, 0);
    if (dueDay < todayDay.getTime()) return "overdue";
    return invoice.status;
 };

 if (loading) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">📄</span>
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
 <span className="h-5 w-5 text-primary" aria-hidden="true">📄</span>
 My Invoices
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {invoices.map((invoice) => {
 const displayStatus = getDisplayStatus(invoice);
 const config = statusConfig[displayStatus] || statusConfig.sent;
 const StatusIcon = config.icon;
 const isPaid = displayStatus ==="paid";
 const showPayButton = !isPaid && invoice.amount_due > 0;

 return (
 <div
 key={invoice.id}
 className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
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
 <span className="w-5 h-5 text-primary" aria-hidden="true">🏢</span>
 </div>
 )}
 </div>

 {/* Invoice Details */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="font-medium truncate">
 {invoice.merchant?.business_name ||"Unknown Merchant"}
 </span>
 <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
 <StatusIcon className="w-3 h-3" />
 {config.label}
 </Badge>
 </div>
 <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
 <span>#{invoice.invoice_number}</span>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3" aria-hidden="true">📅</span>
 Due {format(parseISO(invoice.due_date),"MMM d, yyyy")}
 </span>
 </div>
 </div>

 {/* Amount & Action */}
 <div className="flex items-center gap-3 flex-shrink-0">
 <div className="text-right">
 {isPaid ? (
 <span className="text-lg font-semibold text-success">
 {Formatters.currency(Number(invoice.total))}
 </span>
 ) : (
 <>
 <span className="text-lg font-semibold text-foreground">
 {Formatters.currency(Number(invoice.amount_due))}
 </span>
 {invoice.amount_paid > 0 && (
 <p className="text-xs text-muted-foreground">
 {Formatters.currency(Number(invoice.amount_paid))} paid
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
 <span className="w-4 h-4" aria-hidden="true">💳</span>
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

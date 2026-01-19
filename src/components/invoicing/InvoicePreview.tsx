import { format, parseISO } from "date-fns";
import { Download, Send, ArrowLeft, Printer, Link as LinkIcon, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Invoice, InvoiceItem, InvoicePayment } from "@/services/api/invoicing.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InvoicePreviewProps {
  invoice: Invoice;
  items: InvoiceItem[];
  payments?: InvoicePayment[];
  merchant: {
    business_name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
  };
  onBack?: () => void;
  onSend?: () => void;
  onDownload?: () => void;
  onRecordPayment?: () => void;
  isPublic?: boolean;
  accentColor?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Awaiting Payment", color: "bg-blue-100 text-blue-700" },
  viewed: { label: "Viewed", color: "bg-purple-100 text-purple-700" },
  partially_paid: { label: "Partially Paid", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Paid", color: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700" },
  refunded: { label: "Refunded", color: "bg-orange-100 text-orange-700" },
};

export function InvoicePreview({
  invoice,
  items,
  payments = [],
  merchant,
  onBack,
  onSend,
  onDownload,
  onRecordPayment,
  isPublic = false,
  accentColor = "#3b82f6",
}: InvoicePreviewProps) {
  const status = statusConfig[invoice.status] || statusConfig.draft;

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${invoice.access_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Payment link copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      {!isPublic && (
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">Invoice {invoice.invoice_number}</h1>
              <Badge className={cn("mt-1", status.color)}>{status.label}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={copyPaymentLink}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            {onDownload && (
              <Button variant="outline" onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            )}
            {invoice.status === 'draft' && onSend && (
              <Button onClick={onSend}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {['sent', 'viewed', 'partially_paid', 'overdue'].includes(invoice.status) && onRecordPayment && (
              <Button onClick={onRecordPayment}>
                Record Payment
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Invoice Document */}
      <Card className="max-w-4xl mx-auto print:shadow-none print:border-none">
        <CardContent className="p-8 print:p-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {merchant.logo_url ? (
                <img 
                  src={merchant.logo_url} 
                  alt={merchant.business_name}
                  className="h-16 w-auto object-contain mb-2"
                />
              ) : (
                <h2 className="text-2xl font-bold" style={{ color: accentColor }}>
                  {merchant.business_name}
                </h2>
              )}
              <div className="text-sm text-muted-foreground mt-2 space-y-1">
                {merchant.address && <p className="whitespace-pre-line">{merchant.address}</p>}
                {merchant.phone && <p>{merchant.phone}</p>}
                {merchant.email && <p>{merchant.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold" style={{ color: accentColor }}>INVOICE</h1>
              <p className="text-xl font-semibold mt-2">{invoice.invoice_number}</p>
              {!isPublic && (
                <Badge className={cn("mt-2", status.color)}>{status.label}</Badge>
              )}
            </div>
          </div>

          {/* Bill To & Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Bill To</h3>
              <div className="space-y-1">
                <p className="font-semibold text-lg">{invoice.client_name}</p>
                {invoice.client_company && <p>{invoice.client_company}</p>}
                <p>{invoice.client_email}</p>
                {invoice.client_phone && <p>{invoice.client_phone}</p>}
                {invoice.client_address && (
                  <p className="whitespace-pre-line text-muted-foreground">{invoice.client_address}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block text-left">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <span className="font-medium">{format(parseISO(invoice.issue_date), "MMM d, yyyy")}</span>
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">{format(parseISO(invoice.due_date), "MMM d, yyyy")}</span>
                  {invoice.title && (
                    <>
                      <span className="text-muted-foreground">Reference:</span>
                      <span className="font-medium">{invoice.title}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: accentColor }} className="text-white">
                  <th className="text-left p-3 font-semibold">Description</th>
                  <th className="text-right p-3 font-semibold w-24">Qty</th>
                  <th className="text-right p-3 font-semibold w-32">Rate</th>
                  <th className="text-right p-3 font-semibold w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                    <td className="p-3">
                      <p className="font-medium">{item.description}</p>
                    </td>
                    <td className="text-right p-3">
                      {Number(item.quantity).toFixed(item.unit_type === 'hour' ? 2 : 0)} {item.unit_type !== 'unit' && item.unit_type}
                    </td>
                    <td className="text-right p-3">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="text-right p-3 font-medium">${Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                  <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.shipping_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>${Number(invoice.shipping_amount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Paid</span>
                    <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg" style={{ color: accentColor }}>
                    <span>Amount Due</span>
                    <span>${Number(invoice.amount_due).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Payment History</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Method</th>
                      <th className="text-left p-2 font-medium">Reference</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-t">
                        <td className="p-2">{format(parseISO(payment.payment_date), "MMM d, yyyy")}</td>
                        <td className="p-2 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                        <td className="p-2">{payment.reference_number || '-'}</td>
                        <td className="p-2 text-right font-medium text-green-600">
                          ${Number(payment.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          {/* Terms */}
          {invoice.terms_conditions && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Terms & Conditions</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.terms_conditions}</p>
            </div>
          )}

          {/* Footer */}
          {invoice.footer && (
            <div className="text-center text-sm text-muted-foreground border-t pt-4">
              {invoice.footer}
            </div>
          )}

          {/* Pay Now Button for Public View */}
          {isPublic && Number(invoice.amount_due) > 0 && invoice.accept_credit_card && (
            <div className="mt-8 text-center print:hidden">
              <Button size="lg" style={{ backgroundColor: accentColor }} className="text-white">
                Pay ${Number(invoice.amount_due).toFixed(2)} Now
              </Button>
              {invoice.allow_partial_payments && (
                <p className="text-sm text-muted-foreground mt-2">
                  Partial payments accepted
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

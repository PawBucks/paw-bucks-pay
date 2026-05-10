import { format, parseISO } from"date-fns";
import { Download, Send, ArrowLeft, Printer, Link as LinkIcon, Copy, Eye, Receipt } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { Invoice, InvoiceItem, InvoicePayment, InvoiceRecipient } from"@/services/api/invoicing.service";
import { cn } from"@/lib/utils";
import { toast } from"sonner";
import { supabase } from"@/integrations/supabase/client";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
interface InvoicePreviewProps {
 invoice: Invoice;
 items: InvoiceItem[];
 payments?: InvoicePayment[];
 recipients?: InvoiceRecipient[];
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
 onResendReceipt?: () => void;
 isPublic?: boolean;
 accentColor?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
 draft: { label:"Draft", color:"bg-muted text-muted-foreground" },
 sent: { label:"Awaiting Payment", color:"bg-info/10 text-info" },
 viewed: { label:"Viewed", color:"bg-accent/10 text-accent" },
 partially_paid: { label:"Partially Paid", color:"bg-warning/10 text-warning" },
 paid: { label:"Paid", color:"bg-success/10 text-success" },
 overdue: { label:"Overdue", color:"bg-destructive/10 text-destructive" },
 cancelled: { label:"Cancelled", color:"bg-muted text-foreground" },
 refunded: { label:"Refunded", color:"bg-warning/10 text-warning" },
};

export function InvoicePreview({
 invoice,
 items,
 payments = [],
 recipients = [],
 merchant,
 onBack,
 onSend,
 onDownload,
 onRecordPayment,
 onResendReceipt,
 isPublic = false,
 accentColor ="#3b82f6",
}: InvoicePreviewProps) {
 const status = statusConfig[invoice.status] || statusConfig.draft;

 const copyPaymentLink = () => {
 // Use correct route: /invoice/:invoiceId/pay?token=accessToken
 const link = buildAppUrl(`/invoice/${invoice.id}/pay?token=${invoice.access_token}`);
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
 <div className="flex gap-2 flex-wrap">
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
 {['paid','partially_paid'].includes(invoice.status) && onResendReceipt && (
 <Button variant="outline" onClick={onResendReceipt}>
 <span className="h-4 w-4 mr-2" aria-hidden="true">🧾</span>
 Resend Receipt
 </Button>
 )}
 {invoice.status ==='draft' && onSend && (
 <Button onClick={onSend}>
 <Send className="h-4 w-4 mr-2" />
 Send Invoice
 </Button>
 )}
 {['sent','viewed','partially_paid','overdue'].includes(invoice.status) && onRecordPayment && (
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
 {recipients.length > 0 && (
 <div className="mt-3 pt-3 border-t">
 <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">CC Recipients</p>
 <div className="space-y-0.5">
 {recipients.filter(r => r.recipient_type ==='cc').map((r, i) => (
 <p key={i} className="text-sm text-muted-foreground">
 {r.name ? `${r.name} <${r.email}>` : r.email}
 </p>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 <div className="text-right">
 <div className="inline-block text-left">
 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
 <span className="text-muted-foreground">Invoice Date:</span>
 <span className="font-medium">{format(parseISO(invoice.issue_date),"MMM d, yyyy")}</span>
 <span className="text-muted-foreground">Due Date:</span>
 <span className="font-medium">{format(parseISO(invoice.due_date),"MMM d, yyyy")}</span>
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
 <tr key={item.id} className={index % 2 === 0 ?"bg-muted/30" :""}>
 <td className="p-3">
 <p className="font-medium">{item.description}</p>
 </td>
 <td className="text-right p-3">
                  {Formatters.decimal(Number(item.quantity), item.unit_type ==='hour' ? 2 : 0)} {item.unit_type !=='unit' && item.unit_type}
 </td>
 <td className="text-right p-3">{Formatters.currency(Number(item.unit_price))}</td>
 <td className="text-right p-3 font-medium">{Formatters.currency(Number(item.subtotal))}</td>
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
 <span>{Formatters.currency(Number(invoice.subtotal))}</span>
 </div>
 {Number(invoice.discount_amount) > 0 && (
 <div className="flex justify-between text-sm text-success">
 <span>Discount</span>
 <span>-{Formatters.currency(Number(invoice.discount_amount))}</span>
 </div>
 )}
 {Number(invoice.tax_amount) > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
 <span>{Formatters.currency(Number(invoice.tax_amount))}</span>
 </div>
 )}
 {Number(invoice.shipping_amount) > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Shipping</span>
 <span>{Formatters.currency(Number(invoice.shipping_amount))}</span>
 </div>
 )}
 <Separator />
 <div className="flex justify-between font-bold text-lg">
 <span>Total</span>
 <span>{Formatters.currency(Number(invoice.total))}</span>
 </div>
 {Number(invoice.amount_paid) > 0 && (
 <>
 <div className="flex justify-between text-sm text-success">
 <span>Paid</span>
 <span>-{Formatters.currency(Number(invoice.amount_paid))}</span>
 </div>
 <Separator />
 <div className="flex justify-between font-bold text-lg" style={{ color: accentColor }}>
 <span>Amount Due</span>
 <span>{Formatters.currency(Number(invoice.amount_due))}</span>
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
 <td className="p-2">{format(parseISO(payment.payment_date),"MMM d, yyyy")}</td>
 <td className="p-2 capitalize">{payment.payment_method.replace('_','')}</td>
 <td className="p-2">{payment.reference_number ||'-'}</td>
 <td className="p-2 text-right font-medium text-success">
 {Formatters.currency(Number(payment.amount))}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Attachments */}
 {invoice.attachment_urls && invoice.attachment_urls.length > 0 && (
 <div className="mb-6">
 <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Attachments</h3>
 <div className="space-y-2">
 {invoice.attachment_urls.map((path, index) => {
 const fileName = path.split('/').pop() ||'Attachment';
 const displayName = fileName.indexOf('_') > 30 
 ? fileName.substring(fileName.indexOf('_') + 1) 
 : fileName;
 const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(path);
 
 const handleView = async () => {
 try {
 const { data, error } = await supabase.storage
 .from("invoice-attachments")
 .createSignedUrl(path, 3600);
 if (error) throw error;
 window.open(data.signedUrl,"_blank");
 } catch (error) {
 console.error("Error getting signed URL:", error);
 toast.error("Failed to open attachment");
 }
 };
 
 return (
 <div 
 key={index} 
 className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30 hover:bg-muted cursor-pointer transition-colors"
 onClick={handleView}
 >
 {isImage ? (
 <span className="h-4 w-4 text-info" aria-hidden="true">🖼️</span>
 ) : (
 <span className="h-4 w-4 text-destructive" aria-hidden="true">📄</span>
 )}
 <span className="text-sm flex-1 truncate">{displayName}</span>
 <Eye className="h-4 w-4 text-muted-foreground" />
 </div>
 );
 })}
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
 Pay {Formatters.currency(Number(invoice.amount_due))} Now
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

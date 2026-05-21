import { useState, useMemo } from"react";
import { format, parseISO, isAfter, isBefore, addDays, formatDistanceToNow } from"date-fns";
import { AlertCircle, CheckCircle, Clock, Copy, CreditCard, DollarSign, Download, Edit, Eye, EyeOff, FileText, Filter, Link, Mail, MoreHorizontal, Plus, Printer, RefreshCw, Search, Send, Trash2, XCircle } from "lucide-react";
import { toast } from"sonner";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Skeleton } from"@/components/ui/skeleton";
import { Invoice } from"@/services/api/invoicing.service";
import { cn } from"@/lib/utils";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
interface InvoiceListProps {
 invoices: Invoice[];
 loading: boolean;
 onCreateNew: () => void;
 onEdit: (invoice: Invoice) => void;
 onView: (invoice: Invoice) => void;
 onSend: (invoice: Invoice) => void;
 onDuplicate: (invoice: Invoice) => void;
 onDelete: (invoice: Invoice) => void;
 onDownloadPdf: (invoice: Invoice) => void;
 onRefresh: () => void;
 onRecordPayment: (invoice: Invoice) => void;
 onResendReceipt?: (invoice: Invoice) => void;
 onResendInvoiceEmail?: (invoice: Invoice) => void;
 onPrintReceipt?: (invoice: Invoice) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
 draft: { label:"Draft", color:"bg-muted text-muted-foreground", icon: FileText },
 sent: { label:"Sent", color:"bg-info/10 text-info", icon: Send },
 viewed: { label:"Viewed", color:"bg-accent/10 text-accent", icon: Eye },
 partially_paid: { label:"Partial", color:"bg-warning/10 text-warning", icon: DollarSign },
 paid: { label:"Paid", color:"bg-success/10 text-success", icon: CheckCircle },
 overdue: { label:"Overdue", color:"bg-destructive/10 text-destructive", icon: AlertCircle },
 cancelled: { label:"Cancelled", color:"bg-muted text-foreground", icon: XCircle },
 refunded: { label:"Refunded", color:"bg-warning/10 text-warning", icon: RefreshCw },
};

export function InvoiceList({
 invoices,
 loading,
 onCreateNew,
 onEdit,
 onView,
 onSend,
 onDuplicate,
 onDelete,
 onDownloadPdf,
 onRefresh,
 onRecordPayment,
 onResendReceipt,
 onResendInvoiceEmail,
 onPrintReceipt,
}: InvoiceListProps) {
 const [searchTerm, setSearchTerm] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [sortBy, setSortBy] = useState<string>("created_at");

 // Calculate stats
 const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
 return {
 total: invoices.length,
 draft: invoices.filter(i => i.status ==='draft').length,
 sent: invoices.filter(i => ['sent','viewed'].includes(i.status)).length,
      overdue: invoices.filter(i => {
        if (['paid','cancelled','refunded','draft'].includes(i.status)) return false;
        const due = parseISO(i.due_date);
        const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        return dueStart.getTime() < todayStart.getTime();
      }).length,
 paid: invoices.filter(i => i.status ==='paid').length,
 totalOutstanding: invoices
 .filter(i => !['paid','cancelled','refunded'].includes(i.status))
 .reduce((sum, i) => sum + Number(i.amount_due || 0), 0),
 totalPaid: invoices
 .filter(i => i.status ==='paid')
 .reduce((sum, i) => sum + Number(i.total || 0), 0),
 };
 }, [invoices]);

 // Filter and sort invoices
 const filteredInvoices = useMemo(() => {
 let result = [...invoices];

 // Search filter
 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 result = result.filter(inv => 
 inv.invoice_number.toLowerCase().includes(term) ||
 inv.client_name.toLowerCase().includes(term) ||
 inv.client_email.toLowerCase().includes(term) ||
 inv.client_company?.toLowerCase().includes(term)
 );
 }

 // Status filter
 if (statusFilter !=="all") {
 result = result.filter(inv => inv.status === statusFilter);
 }

 // Sort
 result.sort((a, b) => {
 switch (sortBy) {
 case"invoice_number":
 return a.invoice_number.localeCompare(b.invoice_number);
 case"client_name":
 return a.client_name.localeCompare(b.client_name);
 case"total":
 return Number(b.total) - Number(a.total);
 case"due_date":
 return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
 case"created_at":
 default:
 return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
 }
 });

 return result;
 }, [invoices, searchTerm, statusFilter, sortBy]);

 const getStatusBadge = (invoice: Invoice) => {
    // Check if overdue (whole-day comparison; same-day due is "Due today", not overdue)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const due = parseISO(invoice.due_date);
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const isOverdue = !['paid','cancelled','refunded','draft'].includes(invoice.status) &&
      dueStart.getTime() < todayStart.getTime();
 
 const status = isOverdue ?'overdue' : invoice.status;
 const config = statusConfig[status] || statusConfig.draft;
 const StatusIcon = config.icon;

 return (
 <Badge variant="secondary" className={cn("gap-1", config.color)}>
 <StatusIcon className="h-3 w-3" />
 {config.label}
 </Badge>
 );
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
 </div>
 <Skeleton className="h-12" />
 <Skeleton className="h-96" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Stats Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Outstanding</p>
 <p className="text-2xl font-bold">{Formatters.currency(stats.totalOutstanding)}</p>
 </div>
 <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
 <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Paid</p>
 <p className="text-2xl font-bold">{Formatters.currency(stats.totalPaid)}</p>
 </div>
 <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
 <CheckCircle className="h-5 w-5 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Overdue</p>
 <p className="text-2xl font-bold">{stats.overdue}</p>
 </div>
 <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
 <AlertCircle className="h-5 w-5 text-destructive" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Drafts</p>
 <p className="text-2xl font-bold">{stats.draft}</p>
 </div>
 <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
 <FileText className="h-5 w-5 text-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Toolbar */}
 <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
 <div className="flex flex-1 gap-2 w-full md:w-auto">
 <div className="relative flex-1 md:max-w-sm">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search invoices..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[140px]">
 <Filter className="h-4 w-4 mr-2" />
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="draft">Draft</SelectItem>
 <SelectItem value="sent">Sent</SelectItem>
 <SelectItem value="viewed">Viewed</SelectItem>
 <SelectItem value="partially_paid">Partial</SelectItem>
 <SelectItem value="paid">Paid</SelectItem>
 <SelectItem value="overdue">Overdue</SelectItem>
 <SelectItem value="cancelled">Cancelled</SelectItem>
 </SelectContent>
 </Select>
 <Select value={sortBy} onValueChange={setSortBy}>
 <SelectTrigger className="w-[140px]">
 <SelectValue placeholder="Sort by" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="created_at">Date Created</SelectItem>
 <SelectItem value="due_date">Due Date</SelectItem>
 <SelectItem value="invoice_number">Invoice #</SelectItem>
 <SelectItem value="client_name">Client</SelectItem>
 <SelectItem value="total">Amount</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="icon" onClick={onRefresh}>
 <RefreshCw className="h-4 w-4" />
 </Button>
 <Button onClick={onCreateNew}>
 <Plus className="h-4 w-4 mr-2" />
 New Invoice
 </Button>
 </div>
 </div>

 {/* Invoice Table */}
 {filteredInvoices.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
 <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
 <p className="text-muted-foreground mb-4">
 {searchTerm || statusFilter !=="all" 
 ?"Try adjusting your filters"
 :"Create your first invoice to get started"}
 </p>
 {!searchTerm && statusFilter ==="all" && (
 <Button onClick={onCreateNew}>
 <Plus className="h-4 w-4 mr-2" />
 Create Invoice
 </Button>
 )}
 </CardContent>
 </Card>
 ) : (
 <Card>
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Invoice</TableHead>
 <TableHead>Client</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Viewed</TableHead>
 <TableHead>Due Date</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead className="text-right">Due</TableHead>
 <TableHead className="w-[60px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredInvoices.map((invoice) => (
 <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted" onClick={() => onView(invoice)}>
 <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{invoice.client_name}</p>
 {invoice.client_company && (
 <p className="text-sm text-muted-foreground">{invoice.client_company}</p>
 )}
 </div>
 </TableCell>
 <TableCell>{getStatusBadge(invoice)}</TableCell>
 <TableCell>
 {invoice.viewed_at ? (
 <div className="flex items-center gap-1.5">
 <Eye className="h-4 w-4 text-accent" />
 <div className="text-sm">
 <span className="text-foreground font-medium">
 {invoice.view_count || 1}×
 </span>
 <p className="text-xs text-muted-foreground">
 {formatDistanceToNow(parseISO(invoice.viewed_at), { addSuffix: true })}
 </p>
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <EyeOff className="h-4 w-4" />
 <span className="text-sm">Not viewed</span>
 </div>
 )}
 </TableCell>
 <TableCell>
 <span className={cn(
 isBefore(parseISO(invoice.due_date), new Date()) && 
 !['paid','cancelled','refunded'].includes(invoice.status) &&
"text-destructive font-medium"
 )}>
 {format(parseISO(invoice.due_date),"MMM d, yyyy")}
 </span>
 </TableCell>
 <TableCell className="text-right font-medium">
 {Formatters.currency(Number(invoice.total))}
 </TableCell>
 <TableCell className="text-right">
 {Number(invoice.amount_due) > 0 ? (
 <span className="text-warning font-medium">
 {Formatters.currency(Number(invoice.amount_due))}
 </span>
 ) : (
 <span className="text-success">Paid</span>
 )}
 </TableCell>
 <TableCell onClick={(e) => e.stopPropagation()}>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => onView(invoice)}>
 <Eye className="h-4 w-4 mr-2" />
 View
 </DropdownMenuItem>
 {['draft','sent','viewed','overdue','partially_paid'].includes(invoice.status) && (
 <DropdownMenuItem onClick={() => onEdit(invoice)}>
 <Edit className="h-4 w-4 mr-2" />
 Edit
 </DropdownMenuItem>
 )}
 {invoice.status ==='draft' && (
 <DropdownMenuItem onClick={() => onSend(invoice)}>
 <Send className="h-4 w-4 mr-2" />
 Send
 </DropdownMenuItem>
 )}
 {!['paid','cancelled','refunded','draft'].includes(invoice.status) && (
 <DropdownMenuItem onClick={() => onRecordPayment(invoice)}>
 <CreditCard className="h-4 w-4 mr-2" />
 Record Payment
 </DropdownMenuItem>
 )}
 {['sent','viewed','overdue','partially_paid'].includes(invoice.status) && onResendInvoiceEmail && (
 <DropdownMenuItem onClick={() => onResendInvoiceEmail(invoice)}>
 <RefreshCw className="h-4 w-4 mr-2" />
 Resend Invoice Email
 </DropdownMenuItem>
 )}
 {['paid','partially_paid'].includes(invoice.status) && onResendReceipt && (
 <DropdownMenuItem onClick={() => onResendReceipt(invoice)}>
 <Mail className="h-4 w-4 mr-2" />
 Resend Receipt
 </DropdownMenuItem>
 )}
 {['paid','partially_paid'].includes(invoice.status) && onPrintReceipt && (
 <DropdownMenuItem onClick={() => onPrintReceipt(invoice)}>
 <Printer className="h-4 w-4 mr-2" />
 Print Receipt
 </DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={() => onDownloadPdf(invoice)}>
 <Download className="h-4 w-4 mr-2" />
 Download PDF
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => onDuplicate(invoice)}>
 <Copy className="h-4 w-4 mr-2" />
 Duplicate
 </DropdownMenuItem>
 {invoice.status !=='draft' && (
 <DropdownMenuItem onClick={() => {
 const shareUrl = buildAppUrl(`/invoice/${invoice.id}/pay?token=${invoice.access_token}`);
 navigator.clipboard.writeText(shareUrl);
 toast.success("Share link copied to clipboard");
 }}>
 <Link className="h-4 w-4 mr-2" />
 Copy Share Link
 </DropdownMenuItem>
 )}
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={() => onDelete(invoice)}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </Card>
 )}
 </div>
 );
}

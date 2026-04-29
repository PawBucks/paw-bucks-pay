import { useMemo } from"react";
import { format, parseISO, isPast, isToday } from"date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from"@/components/ui/dropdown-menu";
import { CalendarClock, RefreshCw, Clock, AlertCircle, MoreHorizontal, Edit, Trash2, Eye } from"lucide-react";
import { type Invoice } from"@/services/api/invoicing.service";

interface ScheduledInvoicesProps {
 invoices: Invoice[];
 loading: boolean;
 onEdit?: (invoice: Invoice) => void;
 onDelete?: (invoice: Invoice) => void;
 onView?: (invoice: Invoice) => void;
}

function getIntervalLabel(interval: string | null): string {
 switch (interval) {
 case"weekly": return"Weekly";
 case"biweekly": return"Bi-weekly";
 case"monthly": return"Monthly";
 case"quarterly": return"Quarterly";
 case"yearly": return"Yearly";
 default: return interval ||"—";
 }
}

function getTimeUntil(dateStr: string): { label: string; urgent: boolean } {
 const date = parseISO(dateStr);
 if (isToday(date)) return { label:"Today", urgent: true };
 
 const now = new Date();
 const diffMs = date.getTime() - now.getTime();
 const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
 
 if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
 if (diffDays === 1) return { label:"Tomorrow", urgent: true };
 if (diffDays <= 7) return { label: `${diffDays} days`, urgent: false };
 if (diffDays <= 30) return { label: `${Math.ceil(diffDays / 7)} weeks`, urgent: false };
 return { label: `${Math.ceil(diffDays / 30)} months`, urgent: false };
}

export function ScheduledInvoices({ invoices, loading, onEdit, onDelete, onView }: ScheduledInvoicesProps) {
 const scheduledInvoices = useMemo(() => {
 return invoices
 .filter((inv) => {
 if (inv.is_recurring && inv.next_invoice_date) {
 if (inv.recurring_end_date && isPast(parseISO(inv.recurring_end_date))) return false;
 return true;
 }
 if (inv.status ==="draft") return true;
 return false;
 })
 .sort((a, b) => {
 const dateA = a.next_invoice_date || a.due_date;
 const dateB = b.next_invoice_date || b.due_date;
 return new Date(dateA).getTime() - new Date(dateB).getTime();
 });
 }, [invoices]);

 if (loading) {
 return (
 <Card>
 <CardContent className="p-8 text-center text-muted-foreground">
 Loading scheduled invoices...
 </CardContent>
 </Card>
 );
 }

 return (
 <Card>
 <CardHeader>
 <div className="flex items-center gap-2">
 <CalendarClock className="h-5 w-5 text-primary" />
 <div>
 <CardTitle>Scheduled & Upcoming Invoices</CardTitle>
 <CardDescription>
 Recurring invoices queued for auto-generation and drafts waiting to be sent
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {scheduledInvoices.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground space-y-2">
 <CalendarClock className="h-10 w-10 mx-auto opacity-40" />
 <p className="font-medium">No scheduled invoices</p>
 <p className="text-sm">
 Create a recurring invoice or save a draft to see upcoming invoices here.
 </p>
 </div>
 ) : (
 <>
 {/* Summary cards */}
 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="rounded-lg border p-3 text-center">
 <p className="text-2xl font-bold text-primary">
 {scheduledInvoices.filter((i) => i.is_recurring).length}
 </p>
 <p className="text-xs text-muted-foreground">Recurring</p>
 </div>
 <div className="rounded-lg border p-3 text-center">
 <p className="text-2xl font-bold text-primary">
 {scheduledInvoices.filter((i) => i.status ==="draft").length}
 </p>
 <p className="text-xs text-muted-foreground">Drafts</p>
 </div>
 <div className="rounded-lg border p-3 text-center">
 <p className="text-2xl font-bold text-primary">
 ${scheduledInvoices.reduce((sum, i) => sum + (i.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </p>
 <p className="text-xs text-muted-foreground">Total Queued</p>
 </div>
 </div>

 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Invoice</TableHead>
 <TableHead>Client</TableHead>
 <TableHead>Amount</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Next Send Date</TableHead>
 <TableHead>Time Until</TableHead>
 <TableHead className="w-[50px]">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {scheduledInvoices.map((inv) => {
 const nextDate = inv.next_invoice_date || inv.due_date;
 const timeInfo = getTimeUntil(nextDate);
 
 return (
 <TableRow key={inv.id}>
 <TableCell className="font-medium">
 {inv.invoice_number}
 {inv.title && (
 <p className="text-xs text-muted-foreground truncate max-w-[150px]">
 {inv.title}
 </p>
 )}
 </TableCell>
 <TableCell>
 <div>
 <p className="text-sm">{inv.client_name}</p>
 <p className="text-xs text-muted-foreground">{inv.client_email}</p>
 </div>
 </TableCell>
 <TableCell className="font-medium">
 ${(inv.total || 0).toFixed(2)}
 </TableCell>
 <TableCell>
 {inv.is_recurring ? (
 <Badge variant="secondary" className="gap-1">
 <RefreshCw className="h-3 w-3" />
 {getIntervalLabel(inv.recurring_interval || null)}
 </Badge>
 ) : (
 <Badge variant="outline" className="gap-1">
 <Clock className="h-3 w-3" />
 Draft
 </Badge>
 )}
 </TableCell>
 <TableCell>
 {format(parseISO(nextDate),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <span className={timeInfo.urgent ?"text-destructive font-medium flex items-center gap-1" :"text-muted-foreground"}>
 {timeInfo.urgent && <AlertCircle className="h-3 w-3" />}
 {timeInfo.label}
 </span>
 </TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 {onView && (
 <DropdownMenuItem onClick={() => onView(inv)}>
 <Eye className="h-4 w-4 mr-2" />
 View
 </DropdownMenuItem>
 )}
 {onEdit && (
 <DropdownMenuItem onClick={() => onEdit(inv)}>
 <Edit className="h-4 w-4 mr-2" />
 Edit
 </DropdownMenuItem>
 )}
 {onDelete && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => onDelete(inv)} className="text-destructive">
 <Trash2 className="h-4 w-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 );
}

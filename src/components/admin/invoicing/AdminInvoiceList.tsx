import { useState } from"react";
import { format } from"date-fns";
import { Plus, Search, Filter, Eye, Edit, Trash2, Send, MoreHorizontal } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from"@/components/ui/table";
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from"@/components/ui/select";

export interface AdminInvoice {
 id: string;
 invoice_number: string;
 recipient_type: string;
 recipient_id: string;
 recipient_name: string;
 recipient_email: string | null;
 title: string | null;
 description: string | null;
 status: string;
 subtotal: number;
 tax_rate: number | null;
 tax_amount: number | null;
 discount_amount: number | null;
 total: number;
 amount_paid: number;
 amount_due: number;
 currency: string;
 issue_date: string;
 due_date: string;
 paid_at: string | null;
 notes: string | null;
 terms_conditions: string | null;
 invoice_type: string | null;
 created_by: string;
 created_at: string;
 updated_at: string;
}

interface Props {
 invoices: AdminInvoice[];
 loading: boolean;
 onCreateNew: () => void;
 onView: (invoice: AdminInvoice) => void;
 onEdit: (invoice: AdminInvoice) => void;
 onDelete: (invoice: AdminInvoice) => void;
 onSend: (invoice: AdminInvoice) => void;
}

const statusColors: Record<string, string> = {
 draft:"bg-muted text-muted-foreground",
 sent:"bg-info/15 text-info",
 paid:"bg-success/15 text-success",
 partially_paid:"bg-warning/15 text-warning",
 overdue:"bg-destructive/15 text-destructive",
 cancelled:"bg-muted text-muted-foreground dark:bg-foreground",
 void:"bg-muted text-muted-foreground dark:bg-foreground",
};

export function AdminInvoiceList({ invoices, loading, onCreateNew, onView, onEdit, onDelete, onSend }: Props) {
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [typeFilter, setTypeFilter] = useState("all");

 const filtered = invoices.filter((inv) => {
 const matchesSearch = !search || 
 inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
 inv.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
 inv.recipient_email?.toLowerCase().includes(search.toLowerCase());
 const matchesStatus = statusFilter ==="all" || inv.status === statusFilter;
 const matchesType = typeFilter ==="all" || inv.invoice_type === typeFilter;
 return matchesSearch && matchesStatus && matchesType;
 });

 const fmt = (n: number) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n);

 const totals = {
 outstanding: invoices.filter(i => ["sent","partially_paid","overdue"].includes(i.status)).reduce((s, i) => s + Number(i.amount_due), 0),
 paid: invoices.filter(i => i.status ==="paid").reduce((s, i) => s + Number(i.total), 0),
 overdue: invoices.filter(i => i.status ==="overdue").reduce((s, i) => s + Number(i.amount_due), 0),
 draft: invoices.filter(i => i.status ==="draft").length,
 };

 return (
 <div className="space-y-6">
 {/* Summary Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardContent className="pt-4 pb-3">
 <p className="text-xs text-muted-foreground">Outstanding</p>
 <p className="text-lg sm:text-xl font-bold text-warning truncate">{fmt(totals.outstanding)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 pb-3">
 <p className="text-xs text-muted-foreground">Collected</p>
 <p className="text-lg sm:text-xl font-bold text-success truncate">{fmt(totals.paid)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 pb-3">
 <p className="text-xs text-muted-foreground">Overdue</p>
 <p className="text-lg sm:text-xl font-bold text-destructive truncate">{fmt(totals.overdue)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 pb-3">
 <p className="text-xs text-muted-foreground">Drafts</p>
 <p className="text-lg sm:text-xl font-bold">{totals.draft}</p>
 </CardContent>
 </Card>
 </div>

 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
 <div className="flex gap-2 flex-1 w-full sm:w-auto">
 <div className="relative flex-1 max-w-xs">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="draft">Draft</SelectItem>
 <SelectItem value="sent">Sent</SelectItem>
 <SelectItem value="paid">Paid</SelectItem>
 <SelectItem value="partially_paid">Partial</SelectItem>
 <SelectItem value="overdue">Overdue</SelectItem>
 <SelectItem value="cancelled">Cancelled</SelectItem>
 </SelectContent>
 </Select>
 <Select value={typeFilter} onValueChange={setTypeFilter}>
 <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Types</SelectItem>
 <SelectItem value="platform_fee">Success Fee</SelectItem>
 <SelectItem value="subscription">Subscription</SelectItem>
 <SelectItem value="ad_hoc">Ad-hoc</SelectItem>
 <SelectItem value="commission">Commission</SelectItem>
 <SelectItem value="onboarding">Onboarding</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <Button onClick={onCreateNew}>
 <Plus className="w-4 h-4 mr-2" /> New Invoice
 </Button>
 </div>

 {/* Table */}
 <Card>
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Invoice #</TableHead>
 <TableHead>Recipient</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Total</TableHead>
 <TableHead className="text-right">Due</TableHead>
 <TableHead>Due Date</TableHead>
 <TableHead className="w-[50px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {loading ? (
 <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
 ) : filtered.length === 0 ? (
 <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
 ) : (
 filtered.map((inv) => (
 <TableRow key={inv.id} className="cursor-pointer" onClick={() => onView(inv)}>
 <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
 <TableCell>
 <div>
 <p className="font-medium text-sm">{inv.recipient_name}</p>
 <p className="text-xs text-muted-foreground capitalize">{inv.recipient_type}</p>
 </div>
 </TableCell>
 <TableCell>
 <span className="text-xs capitalize">{inv.invoice_type?.replace("_","") ||"Ad-hoc"}</span>
 </TableCell>
 <TableCell>
 <Badge className={`${statusColors[inv.status] ||""} capitalize text-xs`}>
 {inv.status.replace("_","")}
 </Badge>
 </TableCell>
 <TableCell className="text-right font-medium">${Number(inv.total).toFixed(2)}</TableCell>
 <TableCell className="text-right">
 {Number(inv.amount_due) > 0 ? (
 <span className="text-warning font-medium">${Number(inv.amount_due).toFixed(2)}</span>
 ) : (
 <span className="text-success">$0.00</span>
 )}
 </TableCell>
 <TableCell className="text-sm">{format(new Date(inv.due_date +"T00:00:00"),"MMM d, yyyy")}</TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreHorizontal className="w-4 h-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(inv); }}>
 <Eye className="w-4 h-4 mr-2" /> View
 </DropdownMenuItem>
 {!["paid","void"].includes(inv.status) && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(inv); }}>
 <Edit className="w-4 h-4 mr-2" /> Edit
 </DropdownMenuItem>
 )}
 {!["paid","void"].includes(inv.status) && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(inv); }}>
 <Send className="w-4 h-4 mr-2" /> {inv.status ==="draft" ?"Send" :"Resend"}
 </DropdownMenuItem>
 )}
 {!["paid"].includes(inv.status) && (
 <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(inv); }}>
 <Trash2 className="w-4 h-4 mr-2" /> Delete
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>
 );
}

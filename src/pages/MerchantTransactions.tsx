import { useState, useEffect, useMemo } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { Calendar as CalendarIcon, Download, RotateCcw, Search, X } from "lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";
import { cn } from"@/lib/utils";
import { RefundPaymentDialog } from"@/components/shared/RefundPaymentDialog";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
interface Transaction {
 transaction_id: string;
 date: string;
 customer_name: string;
 customer_email: string;
 amount: number;
  amount_refunded?: number;
 cashback_given: number; // PawBucks given to customer (informational)
 platform_fee: number; // Platform's 3% fee on Stripe portion
 repayment_deducted: number; // Funding deal repayment (if applicable)
 net_payout: number; // amount - platform_fee - repayment_deducted
 payment_method: string;
 status: string;
 description: string;
}

const MerchantTransactions = () => { const { user, loading, signOut } = useAuth();
 const navigate = useNavigate();
 
 const [transactions, setTransactions] = useState<Transaction[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [currentPage, setCurrentPage] = useState(1);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [startDate, setStartDate] = useState<Date | undefined>();
 const [endDate, setEndDate] = useState<Date | undefined>();
 const [sortColumn, setSortColumn] = useState<keyof Transaction>("date");
 const [sortDirection, setSortDirection] = useState<"asc" |"desc">("desc");
 const [refundingId, setRefundingId] = useState<string | null>(null);
 const [refundDialogOpen, setRefundDialogOpen] = useState(false);
 const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
 
 const itemsPerPage = 15;

 useEffect(() => {
 if (!loading && !user) {
 navigate("/auth");
 }
 }, [user, loading, navigate]);

 const fetchTransactions = async () => {
 try {
 setIsLoading(true);
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session) {
 throw new Error("No session");
 }

 // Build request body with properly formatted dates (YYYY-MM-DD)
 const requestBody: Record<string, string> = {};
 if (startDate) requestBody.start_date = format(startDate,'yyyy-MM-dd');
 if (endDate) requestBody.end_date = format(endDate,'yyyy-MM-dd');
 if (statusFilter !=='all') requestBody.status = statusFilter;
 if (searchQuery) requestBody.search = searchQuery;

 const { data, error } = await supabase.functions.invoke('merchant-transactions', {
 body: requestBody,
 headers: {
 Authorization: `Bearer ${session.access_token}`,
 },
 });

 if (error) throw error;

 setTransactions(data.transactions || []);
 } catch (error) {
 console.error("Error fetching transactions:", error);
 toast.error("Failed to load transactions");
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 if (user) {
 fetchTransactions();
 }
 }, [user, startDate, endDate, statusFilter]);

 const handleSearch = () => {
 fetchTransactions();
 };

 const handleResetFilters = () => {
 setSearchQuery("");
 setStatusFilter("all");
 setStartDate(undefined);
 setEndDate(undefined);
 setCurrentPage(1);
 };

 const sortedTransactions = useMemo(() => {
 return [...transactions].sort((a, b) => {
 const aValue = a[sortColumn];
 const bValue = b[sortColumn];
 
 if (aValue < bValue) return sortDirection ==="asc" ? -1 : 1;
 if (aValue > bValue) return sortDirection ==="asc" ? 1 : -1;
 return 0;
 });
 }, [transactions, sortColumn, sortDirection]);

 const paginatedTransactions = useMemo(() => {
 const startIndex = (currentPage - 1) * itemsPerPage;
 return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
 }, [sortedTransactions, currentPage]);

 const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);

 const summaryTotals = useMemo(() => {
 // Only include completed transactions in summary totals
 const completedTransactions = sortedTransactions.filter(t => t.status ==='completed');
 const refundedTransactions = sortedTransactions.filter(t => t.status ==='refunded');
 
 const totals = completedTransactions.reduce(
 (acc, t) => ({
 totalSales: acc.totalSales + t.amount,
 totalCashback: acc.totalCashback + t.cashback_given,
 totalPlatformFees: acc.totalPlatformFees + (t.platform_fee || 0),
 totalRepayment: acc.totalRepayment + t.repayment_deducted,
 totalNetPayout: acc.totalNetPayout + t.net_payout,
 }),
 { totalSales: 0, totalCashback: 0, totalPlatformFees: 0, totalRepayment: 0, totalNetPayout: 0 }
 );

 const refundedTotals = refundedTransactions.reduce(
 (acc, t) => ({
 refundedCount: acc.refundedCount + 1,
 refundedAmount: acc.refundedAmount + t.amount,
 }),
 { refundedCount: 0, refundedAmount: 0 }
 );

 // Convert PawBucks to USD (1 PawBuck = $0.001)
 return {
 ...totals,
 totalCashbackUSD: totals.totalCashback * 0.001,
 totalDeductions: totals.totalPlatformFees + totals.totalRepayment,
 completedCount: completedTransactions.length,
 ...refundedTotals,
 };
 }, [sortedTransactions]);

 const handleSort = (column: keyof Transaction) => {
 if (sortColumn === column) {
 setSortDirection(sortDirection ==="asc" ?"desc" :"asc");
 } else {
 setSortColumn(column);
 setSortDirection("asc");
 }
 };

 const exportToCSV = () => {
 const headers = ["Date","Customer","Amount","Success Fee","Funding Repayment","Net Payout","Payment Method","Status"];
 const csvData = sortedTransactions.map(t => [
 format(new Date(t.date),"MM/dd/yyyy"),
 t.customer_name,
 `${Formatters.currency(t.amount)}`,
 `${Formatters.currency((t.platform_fee || 0))}`,
 `${Formatters.currency(t.repayment_deducted)}`,
 `${Formatters.currency(t.net_payout)}`,
 t.payment_method,
 t.status,
 ]);

 const csv = [headers, ...csvData].map(row => row.join(",")).join("\n");
 const blob = new Blob([csv], { type:"text/csv" });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `pawbucks-transactions-${format(new Date(),"yyyy-MM-dd")}.csv`;
 a.click();
 window.URL.revokeObjectURL(url);
 toast.success("Transactions exported successfully");
 };

 const handleSignOut = async () => { await signOut(); };

 const handleRefundClick = (transaction: Transaction) => {
 setSelectedTransaction(transaction);
 setRefundDialogOpen(true);
 };

 const handleRefund = async (params: { amount: number; reason: string; note: string; refundApplicationFee: boolean }) => {
 if (!selectedTransaction) return;

 setRefundingId(selectedTransaction.transaction_id);
 setRefundDialogOpen(false);

 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) throw new Error('Not authenticated');

  // Generate a per-attempt idempotency key so accidental duplicate clicks
  // (or network retries) cannot result in two Stripe refunds.
  const idempotencyKey = `mref_${selectedTransaction.transaction_id}_${crypto.randomUUID()}`;

 const { data, error } = await supabase.functions.invoke('merchant-issue-refund', {
 body: {
 transactionId: selectedTransaction.transaction_id,
 amount: params.amount,
 reason: params.reason,
 note: params.note,
 refundApplicationFee: params.refundApplicationFee,
  idempotencyKey,
 },
 headers: {
 Authorization: `Bearer ${session.access_token}`,
 },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

  toast.success(
    data?.refund?.partial
      ? `Partial refund of ${Formatters.currency(params.amount)} processed`
      : `Refund of ${Formatters.currency(params.amount)} processed successfully`
  );
 fetchTransactions();
 } catch (error: unknown) {
 const errorMessage = error instanceof Error ? error.message :'Failed to process refund';
 console.error('Refund error:', error);
 toast.error(errorMessage);
 } finally {
 setRefundingId(null);
 setSelectedTransaction(null);
 }
 };

 const getStatusColor = (status: string) => {
 switch (status.toLowerCase()) {
 case"completed":
 return"bg-success/10 text-success border-success/20";
 case"pending":
 return"bg-warning/10 text-warning border-warning/20";
 case"refunded":
 return"bg-destructive/10 text-destructive border-destructive/20";
  case"partially_refunded":
  return"bg-warning/10 text-warning border-warning/20";
 default:
 return"bg-muted text-muted-foreground";
 }
 };

 if (loading || isLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} variant="merchant" />
 <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
 {/* Header */}
 <div className="space-y-2">
 <h1 className="text-3xl font-bold text-foreground">Detailed Transactions</h1>
 <p className="text-muted-foreground">View and manage all PawBucks sales, rewards, and repayments.</p>
 </div>

 {/* Summary KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardHeader className="pb-3">
 <CardDescription>Total Sales</CardDescription>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-primary">{Formatters.currency(summaryTotals.totalSales)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-3">
 <CardDescription>Success Fees</CardDescription>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-muted-foreground">{Formatters.currency(summaryTotals.totalPlatformFees)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-3">
 <CardDescription>Funding Repayment</CardDescription>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-muted-foreground">{Formatters.currency(summaryTotals.totalRepayment)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-3">
 <CardDescription>Net Payout</CardDescription>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-success">{Formatters.currency(summaryTotals.totalNetPayout)}</p>
 </CardContent>
 </Card>
 </div>

 {/* Filters */}
 <Card>
 <CardHeader>
 <CardTitle>Filters</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {/* Date Range */}
 <div className="flex gap-2">
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full justify-start text-left font-normal">
 <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
 {startDate ? format(startDate,"MM/dd/yy") :"Start Date"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={startDate}
 onSelect={setStartDate}
 initialFocus
 className={cn("p-3 pointer-events-auto")}
 />
 </PopoverContent>
 </Popover>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full justify-start text-left font-normal">
 <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
 {endDate ? format(endDate,"MM/dd/yy") :"End Date"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={endDate}
 onSelect={setEndDate}
 initialFocus
 className={cn("p-3 pointer-events-auto")}
 />
 </PopoverContent>
 </Popover>
 </div>

 {/* Status Filter */}
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger>
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="completed">Completed</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="refunded">Refunded</SelectItem>
 </SelectContent>
 </Select>

 {/* Search */}
 <div className="flex gap-2">
 <Input
 placeholder="Search by customer or ID..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 onKeyDown={(e) => e.key ==="Enter" && handleSearch()}
 />
 <Button onClick={handleSearch} size="icon" variant="secondary">
 <Search className="h-4 w-4" />
 </Button>
 </div>

 {/* Reset & Export */}
 <div className="flex gap-2">
 <Button onClick={handleResetFilters} variant="outline" className="flex-1">
 <X className="h-4 w-4 mr-2" />
 Reset
 </Button>
 <Button onClick={exportToCSV} variant="default" className="flex-1">
 <Download className="h-4 w-4 mr-2" />
 CSV
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Transactions Table */}
 <Card>
 <CardContent className="p-0">
 {paginatedTransactions.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <PawBucksLogo className="text-6xl mb-4" />
 <p className="text-lg text-muted-foreground">
 No transactions yet — your PawBucks journey starts with your first sale!
 </p>
 </div>
 ) : (
 <>
 <div className="overflow-x-auto">
 <Table>
 <TableHeader className="sticky top-0 bg-card z-10">
 <TableRow>
 <TableHead className="cursor-pointer" onClick={() => handleSort("date")}>
 Date {sortColumn ==="date" && (sortDirection ==="asc" ?"↑" :"↓")}
 </TableHead>
 <TableHead className="cursor-pointer" onClick={() => handleSort("customer_name")}>
 Customer {sortColumn ==="customer_name" && (sortDirection ==="asc" ?"↑" :"↓")}
 </TableHead>
 <TableHead className="cursor-pointer text-right" onClick={() => handleSort("amount")}>
 Amount {sortColumn ==="amount" && (sortDirection ==="asc" ?"↑" :"↓")}
 </TableHead>
 <TableHead className="text-right">
 Success Fee
 </TableHead>
 <TableHead className="text-right">
 Repayment
 </TableHead>
 <TableHead className="cursor-pointer text-right" onClick={() => handleSort("net_payout")}>
 Net Payout {sortColumn ==="net_payout" && (sortDirection ==="asc" ?"↑" :"↓")}
 </TableHead>
 <TableHead>Payment</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {paginatedTransactions.map((transaction) => (
 <TableRow key={transaction.transaction_id} className="hover:bg-muted transition-colors">
 <TableCell>{format(new Date(transaction.date),"MM/dd/yyyy")}</TableCell>
 <TableCell className="font-medium">{transaction.customer_name}</TableCell>
 <TableCell className="text-right font-semibold">{Formatters.currency(transaction.amount)}</TableCell>
 <TableCell className="text-right text-muted-foreground">{Formatters.currency((transaction.platform_fee || 0))}</TableCell>
 <TableCell className="text-right text-muted-foreground">{Formatters.currency(transaction.repayment_deducted)}</TableCell>
 <TableCell className="text-right font-semibold text-success">{Formatters.currency(transaction.net_payout)}</TableCell>
 <TableCell>{transaction.payment_method}</TableCell>
 <TableCell>
 <Badge variant="outline" className={getStatusColor(transaction.status)}>
 {transaction.status}
 </Badge>
 </TableCell>
 <TableCell>
 {transaction.status ==='completed' && (
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleRefundClick(transaction)}
 disabled={refundingId === transaction.transaction_id}
 className="text-destructive border-destructive/30 hover:bg-destructive/10"
 >
 <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
 {refundingId === transaction.transaction_id ?'Refunding...' :'Refund'}
 </Button>
 )}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-6 py-4 border-t">
 <p className="text-sm text-muted-foreground">
 Showing {(currentPage - 1) * itemsPerPage + 1} to{""}
 {Math.min(currentPage * itemsPerPage, sortedTransactions.length)} of{""}
 {sortedTransactions.length} transactions
 </p>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 >
 Previous
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 >
 Next
 </Button>
 </div>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>
 </div>

 <RefundPaymentDialog
 open={refundDialogOpen}
 onOpenChange={setRefundDialogOpen}
  transactionAmount={Math.max(
    0,
    (selectedTransaction?.amount || 0) - (selectedTransaction?.amount_refunded || 0)
  )}
 customerName={selectedTransaction?.customer_name}
 onRefund={handleRefund}
 isRefunding={!!refundingId}
 />
 </div>
 );
};

export default MerchantTransactions;

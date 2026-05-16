import { useState, useMemo } from"react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Calendar } from"@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { Separator } from"@/components/ui/separator";
import { Download, Loader2 } from "lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from"date-fns";
import { cn } from"@/lib/utils";
import { toast } from"sonner";
import jsPDF from"jspdf";

import { Formatters } from "@/utils/formatters";
type TimeframeOption ="1d" |"1w" |"1m" |"3m" |"1y" |"custom";

interface SalesReportData {
 totalSales: number; // Gross sales (before fees)
 totalTransactions: number;
 uniqueCustomers: number;
 avgTransactionAmount: number;
 totalRefunds: number;
 refundCount: number;
 totalPlatformFees: number; // 3% application fee
 totalProcessingFees: number; // Estimated Stripe processing fees (2.9% + $0.30)
 totalFees: number; // Combined fees
 netSales: number; // Gross - Refunds - All Fees
 totalPawbucksEarned: number;
 transactions: Array<{
 id: string;
 amount: number;
 cashback_earned: number;
 rewards_earned: number;
 description: string;
 created_at: string;
 status: string;
 customer_name?: string;
 }>;
 dailyBreakdown: Array<{ date: string; sales: number; count: number }>;
}

interface SalesReportGeneratorProps {
 entityId: string;
 entityType:"merchant" |"vet";
 entityName: string;
}

const TIMEFRAME_LABELS: Record<TimeframeOption, string> = {
"1d":"Last 24 Hours",
"1w":"Last 7 Days",
"1m":"Last 30 Days",
"3m":"Last 3 Months",
"1y":"Last Year",
 custom:"Custom Range",
};

export function SalesReportGenerator({ entityId, entityType, entityName }: SalesReportGeneratorProps) {
 const [timeframe, setTimeframe] = useState<TimeframeOption>("1m");
 const [customStart, setCustomStart] = useState<Date | undefined>();
 const [customEnd, setCustomEnd] = useState<Date | undefined>();
 const [isLoading, setIsLoading] = useState(false);
 const [reportData, setReportData] = useState<SalesReportData | null>(null);

 const dateRange = useMemo(() => {
 const now = new Date();
 const end = endOfDay(now);
 let start: Date;

 switch (timeframe) {
 case"1d": start = subDays(now, 1); break;
 case"1w": start = subDays(now, 7); break;
 case"1m": start = subMonths(now, 1); break;
 case"3m": start = subMonths(now, 3); break;
 case"1y": start = subYears(now, 1); break;
 case"custom":
 start = customStart ? startOfDay(customStart) : subMonths(now, 1);
 return { start, end: customEnd ? endOfDay(customEnd) : end };
 default: start = subMonths(now, 1);
 }
 return { start: startOfDay(start), end };
 }, [timeframe, customStart, customEnd]);

 const generateReport = async () => {
 setIsLoading(true);
 try {
 const filterColumn = entityType ==="merchant" ?"merchant_id" :"merchant_id";

 // For vets, we query by vet_id from invoices instead
 let query = supabase
 .from("transactions")
 .select("*")
 .eq(filterColumn, entityId)
 .gte("created_at", dateRange.start.toISOString())
 .lte("created_at", dateRange.end.toISOString())
 .order("created_at", { ascending: false });

 const { data: transactions, error } = await query;

 if (error) throw error;

 const txns = transactions || [];
 const completed = txns.filter(t => t.status ==="completed");
 const refunded = txns.filter(t => t.status ==="refunded");

 // Get unique customer IDs and fetch names
 const userIds = [...new Set(completed.map(t => t.user_id).filter(Boolean))];
 let profilesMap: Record<string, string> = {};
 if (userIds.length > 0) {
  const { data: profiles } = await supabase
  .rpc("get_customer_profiles_for_merchant", { p_user_ids: userIds });
 (profiles || []).forEach(p => {
 profilesMap[p.id] = p.full_name || p.email ||"Unknown";
 });
 }

 // Build daily breakdown
 const dailyMap: Record<string, { sales: number; count: number }> = {};
 completed.forEach(t => {
 const day = format(new Date(t.created_at),"yyyy-MM-dd");
 if (!dailyMap[day]) dailyMap[day] = { sales: 0, count: 0 };
 dailyMap[day].sales += t.amount;
 dailyMap[day].count += 1;
 });

 const dailyBreakdown = Object.entries(dailyMap)
 .map(([date, data]) => ({ date, ...data }))
 .sort((a, b) => a.date.localeCompare(b.date));

 const totalSales = completed.reduce((s, t) => s + t.amount, 0);
 const totalRefunds = refunded.reduce((s, t) => s + t.amount, 0);
 const totalPlatformFees = completed.reduce((s, t) => s + (t.application_fee || 0), 0);
 // Estimated Stripe processing fees: 2.9% + $0.30 on the Stripe-funded portion
 const totalProcessingFees = completed.reduce((s, t) => {
 const stripeAmount = t.stripe_amount || 0;
 if (stripeAmount <= 0) return s;
 return s + (stripeAmount * 0.029 + 0.30);
 }, 0);
 const totalFees = totalPlatformFees + totalProcessingFees;

 setReportData({
 totalSales,
 totalTransactions: completed.length,
 uniqueCustomers: userIds.length,
 avgTransactionAmount: completed.length > 0 ? totalSales / completed.length : 0,
 totalRefunds,
 refundCount: refunded.length,
 totalPlatformFees,
 totalProcessingFees: Math.round(totalProcessingFees * 100) / 100,
 totalFees: Math.round(totalFees * 100) / 100,
 netSales: totalSales - totalRefunds - totalFees,
 totalPawbucksEarned: completed.reduce((s, t) => s + (t.cashback_earned || 0), 0),
 transactions: txns.map(t => ({
 id: t.id,
 amount: t.amount,
 cashback_earned: t.cashback_earned || 0,
 rewards_earned: t.rewards_earned || 0,
 description: t.description ||"",
 created_at: t.created_at,
 status: t.status ||"completed",
 customer_name: t.user_id ? profilesMap[t.user_id] :"Guest",
 })),
 dailyBreakdown,
 });

 toast.success("Sales report generated");
 } catch (err) {
 console.error("Error generating report:", err);
 toast.error("Failed to generate report");
 } finally {
 setIsLoading(false);
 }
 };

 const downloadPDF = () => {
 if (!reportData) return;

 const doc = new jsPDF();
 const pw = doc.internal.pageSize.getWidth();
 const startDate = format(dateRange.start,"MMM d, yyyy");
 const endDate = format(dateRange.end,"MMM d, yyyy");

 // Header
 doc.setFontSize(20);
 doc.setFont("helvetica","bold");
 doc.text("Sales Report", pw / 2, 20, { align:"center" });

 doc.setFontSize(12);
 doc.setFont("helvetica","normal");
 doc.text(entityName, pw / 2, 28, { align:"center" });
 doc.text(`${startDate} — ${endDate}`, pw / 2, 35, { align:"center" });
 doc.text(`Generated: ${format(new Date(),"MMMM d, yyyy h:mm a")}`, pw / 2, 42, { align:"center" });

 // Summary section
 let y = 58;
 doc.setFontSize(14);
 doc.setFont("helvetica","bold");
 doc.text("Summary", 20, y);
 y += 10;

 doc.setFontSize(10);
 doc.setFont("helvetica","normal");
 const summaryItems = [
 ["Gross Sales", `${Formatters.currency(reportData.totalSales)}`],
 ["Refunds", `- ${Formatters.currency(reportData.totalRefunds)} (${reportData.refundCount})`],
 ["Success Fees (3%)", `- ${Formatters.currency(reportData.totalPlatformFees)}`],
 ["Processing Fees (est.)", `- ${Formatters.currency(reportData.totalProcessingFees)}`],
 ["Net Sales", `${Formatters.currency(reportData.netSales)}`],
 ["Total Transactions", `${reportData.totalTransactions}`],
 ["Unique Customers", `${reportData.uniqueCustomers}`],
 ["Avg Transaction", `${Formatters.currency(reportData.avgTransactionAmount)}`],
 ["PawBucks Distributed", `${reportData.totalPawbucksEarned.toLocaleString()} PB`],
 ];

 summaryItems.forEach(([label, value]) => {
 doc.text(label, 25, y);
 doc.text(value, pw - 25, y, { align:"right" });
 y += 7;
 });

 // Daily breakdown
 y += 8;
 if (y > 240) { doc.addPage(); y = 20; }
 doc.setFontSize(14);
 doc.setFont("helvetica","bold");
 doc.text("Daily Breakdown", 20, y);
 y += 8;

 doc.setFontSize(9);
 doc.setFont("helvetica","bold");
 doc.text("Date", 25, y);
 doc.text("Sales", 100, y);
 doc.text("Transactions", pw - 25, y, { align:"right" });
 y += 5;
 doc.line(25, y, pw - 25, y);
 y += 4;

 doc.setFont("helvetica","normal");
 reportData.dailyBreakdown.forEach(row => {
 if (y > 280) { doc.addPage(); y = 20; }
 doc.text(format(new Date(row.date),"MM/dd/yyyy"), 25, y);
 doc.text(`${Formatters.currency(row.sales)}`, 100, y);
 doc.text(`${row.count}`, pw - 25, y, { align:"right" });
 y += 5;
 });

 // Transaction detail
 y += 8;
 if (y > 240) { doc.addPage(); y = 20; }
 doc.setFontSize(14);
 doc.setFont("helvetica","bold");
 doc.text("Transaction Detail", 20, y);
 y += 8;

 doc.setFontSize(8);
 doc.setFont("helvetica","bold");
 doc.text("Date", 20, y);
 doc.text("Customer", 50, y);
 doc.text("Description", 100, y);
 doc.text("Status", 150, y);
 doc.text("Amount", pw - 20, y, { align:"right" });
 y += 5;
 doc.line(20, y, pw - 20, y);
 y += 4;

 doc.setFont("helvetica","normal");
 reportData.transactions.forEach(t => {
 if (y > 280) { doc.addPage(); y = 20; }
 doc.text(format(new Date(t.created_at),"MM/dd/yy"), 20, y);
 doc.text((t.customer_name ||"").substring(0, 20), 50, y);
 doc.text((t.description ||"-").substring(0, 22), 100, y);
 doc.text(t.status, 150, y);
 doc.text(`${Formatters.currency(t.amount)}`, pw - 20, y, { align:"right" });
 y += 5;
 });

 const filename = `SalesReport_${entityName.replace(/\s+/g,"_")}_${format(dateRange.start,"yyyyMMdd")}-${format(dateRange.end,"yyyyMMdd")}.pdf`;
 doc.save(filename);
 toast.success("PDF report downloaded");
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5" aria-hidden="true">📊</span>
 Sales Report
 </CardTitle>
 <CardDescription>Generate detailed sales reports for any time period</CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 {/* Controls */}
 <div className="flex flex-col sm:flex-row gap-4 items-start">
 <Select value={timeframe} onValueChange={v => setTimeframe(v as TimeframeOption)}>
 <SelectTrigger className="w-full sm:w-[200px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {Object.entries(TIMEFRAME_LABELS).map(([key, label]) => (
 <SelectItem key={key} value={key}>{label}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 {timeframe ==="custom" && (
 <div className="flex gap-2 flex-wrap">
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customStart &&"text-muted-foreground")}>
 <span className="mr-2 h-4 w-4" aria-hidden="true">📅</span>
 {customStart ? format(customStart,"MMM d, yyyy") :"Start date"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar mode="single" selected={customStart} onSelect={setCustomStart} disabled={d => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
 </PopoverContent>
 </Popover>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customEnd &&"text-muted-foreground")}>
 <span className="mr-2 h-4 w-4" aria-hidden="true">📅</span>
 {customEnd ? format(customEnd,"MMM d, yyyy") :"End date"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} disabled={d => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
 </PopoverContent>
 </Popover>
 </div>
 )}

 <Button onClick={generateReport} disabled={isLoading || (timeframe ==="custom" && (!customStart || !customEnd))}>
 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 h-4 w-4" aria-hidden="true">📊</span>}
 Generate Report
 </Button>
 </div>

 {/* Report Results */}
 {reportData && (
 <div className="space-y-6">
 <Separator />

 {/* KPI Cards */}
 <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <span className="h-4 w-4" aria-hidden="true">💵</span> Net Sales
 </div>
 <p className="text-2xl font-bold">{Formatters.currency(reportData.netSales)}</p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <span className="h-4 w-4" aria-hidden="true">📄</span> Transactions
 </div>
 <p className="text-2xl font-bold">{reportData.totalTransactions}</p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <span className="h-4 w-4" aria-hidden="true">👥</span> Customers
 </div>
 <p className="text-2xl font-bold">{reportData.uniqueCustomers}</p>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
 <span className="h-4 w-4" aria-hidden="true">📈</span> Avg. Sale
 </div>
 <p className="text-2xl font-bold">{Formatters.currency(reportData.avgTransactionAmount)}</p>
 </Card>
 </div>

 {/* Detailed summary */}
 <Card className="p-4">
 <h4 className="font-semibold mb-3">Report Summary</h4>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <span className="text-muted-foreground">Period</span>
 <span className="text-right">{format(dateRange.start,"MMM d, yyyy")} — {format(dateRange.end,"MMM d, yyyy")}</span>
 <span className="text-muted-foreground">Gross Sales</span>
 <span className="text-right font-medium">{Formatters.currency(reportData.totalSales)}</span>
 <span className="text-muted-foreground">Refunds</span>
 <span className="text-right text-destructive">-{Formatters.currency(reportData.totalRefunds)} ({reportData.refundCount})</span>
 <span className="text-muted-foreground">Success Fees (3%)</span>
 <span className="text-right text-destructive">-{Formatters.currency(reportData.totalPlatformFees)}</span>
 <span className="text-muted-foreground">Processing Fees (est.)</span>
 <span className="text-right text-destructive">-{Formatters.currency(reportData.totalProcessingFees)}</span>
 <Separator className="col-span-2 my-1" />
 <span className="text-muted-foreground">Net Sales</span>
 <span className="text-right font-bold">{Formatters.currency(reportData.netSales)}</span>
 <span className="text-muted-foreground">PawBucks Distributed</span>
 <span className="text-right">{reportData.totalPawbucksEarned.toLocaleString()} PB</span>
 </div>
 </Card>

 {/* Daily breakdown table */}
 {reportData.dailyBreakdown.length > 0 && (
 <Card className="p-4">
 <h4 className="font-semibold mb-3">Daily Breakdown</h4>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b">
 <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
 <th className="text-right py-2 font-medium text-muted-foreground">Sales</th>
 <th className="text-right py-2 font-medium text-muted-foreground">Transactions</th>
 </tr>
 </thead>
 <tbody>
 {reportData.dailyBreakdown.map(row => (
 <tr key={row.date} className="border-b last:border-0">
 <td className="py-2">{format(new Date(row.date),"MMM d, yyyy")}</td>
 <td className="text-right py-2">{Formatters.currency(row.sales)}</td>
 <td className="text-right py-2">{row.count}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 )}

 {/* Download button */}
 <Button onClick={downloadPDF} className="w-full sm:w-auto">
 <Download className="mr-2 h-4 w-4" />
 Download PDF Report
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 );
}

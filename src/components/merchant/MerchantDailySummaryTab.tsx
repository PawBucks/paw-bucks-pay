import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Download, Mail, MailX, TrendingUp, DollarSign, CreditCard, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import jsPDF from "jspdf";

type DailySummary = {
  id: string;
  merchant_id: string;
  summary_date: string;
  total_sales: number;
  total_usd_processed: number;
  total_pawbucks_credits: number;
  transaction_count: number;
  email_sent: boolean;
  created_at: string;
};

type MerchantDailySummaryTabProps = {
  merchantId: string;
  merchantName: string;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const formatPawBucks = (amount: number) =>
  new Intl.NumberFormat("en-US").format(amount) + " PB";

// Parse date string as local date to avoid UTC shift
const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const MerchantDailySummaryTab = ({ merchantId, merchantName }: MerchantDailySummaryTabProps) => {
  const [timeRange, setTimeRange] = useState("30");
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const handleGenerateNow = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-daily-summary", {
        body: { merchant_id: merchantId },
      });
      if (error) throw error;
      toast.success("Daily summary generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["merchant-daily-summaries", merchantId] });
    } catch (err) {
      console.error("Failed to generate summary:", err);
      toast.error("Failed to generate summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };
  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ["merchant-daily-summaries", merchantId, timeRange],
    queryFn: async () => {
      const daysBack = parseInt(timeRange);
      const fromDate = format(subDays(new Date(), daysBack), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("merchant_daily_summaries")
        .select("*")
        .eq("merchant_id", merchantId)
        .gte("summary_date", fromDate)
        .order("summary_date", { ascending: false });

      if (error) throw error;
      return (data || []) as DailySummary[];
    },
  });

  // Aggregate stats
  const totalSales = summaries.reduce((s, r) => s + Number(r.total_sales), 0);
  const totalUsd = summaries.reduce((s, r) => s + Number(r.total_usd_processed), 0);
  const totalPB = summaries.reduce((s, r) => s + r.total_pawbucks_credits, 0);
  const totalTx = summaries.reduce((s, r) => s + r.transaction_count, 0);
  const daysWithSales = summaries.filter((r) => r.transaction_count > 0).length;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const rangeLabel = timeRange === "7" ? "Last 7 Days" : timeRange === "30" ? "Last 30 Days" : timeRange === "90" ? "Last 90 Days" : "Last Year";

    doc.setFontSize(18);
    doc.text(`${merchantName}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Daily Settlement History — ${rangeLabel}`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 35);

    // Summary section
    doc.setFontSize(11);
    doc.text(`Period Totals:`, 14, 48);
    doc.text(`Total Sales: ${formatCurrency(totalSales)}`, 20, 56);
    doc.text(`Total USD Processed (Net): ${formatCurrency(totalUsd)}`, 20, 63);
    doc.text(`Total PawBucks Credits: ${formatPawBucks(totalPB)}`, 20, 70);
    doc.text(`Total Transactions: ${totalTx}`, 20, 77);
    doc.text(`Days with Sales: ${daysWithSales}`, 20, 84);

    // Table
    let y = 98;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y);
    doc.text("Total Sales", 55, y);
    doc.text("USD Processed", 90, y);
    doc.text("PB Credits", 130, y);
    doc.text("Tx Count", 165, y);
    y += 2;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const row of summaries) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const d = parseLocalDate(row.summary_date);
      doc.text(format(d, "MMM d, yyyy"), 14, y);
      doc.text(formatCurrency(Number(row.total_sales)), 55, y);
      doc.text(formatCurrency(Number(row.total_usd_processed)), 90, y);
      doc.text(formatPawBucks(row.total_pawbucks_credits), 130, y);
      doc.text(String(row.transaction_count), 165, y);
      y += 7;
    }

    // Accounting note
    y += 8;
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Accounting Note: Use these totals to balance your POS \"Other\" category for End-of-Day reports.", 14, y);

    doc.save(`${merchantName.replace(/\s+/g, "_")}_Daily_Summary_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Daily Settlement History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review past daily reconciliation summaries for tax and accounting purposes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="default" size="sm" onClick={handleGenerateNow} disabled={isGenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "Generating..." : "Run Summary Now"}
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={summaries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Period Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total Sales</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-muted-foreground">USD Processed</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalUsd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium text-muted-foreground">PB Credits</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatPawBucks(totalPB)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-info" />
              <span className="text-xs font-medium text-muted-foreground">Transactions</span>
            </div>
            <p className="text-lg font-bold text-foreground">{totalTx}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Summaries Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Daily Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No daily summaries yet</p>
              <p className="text-sm mt-1">Summaries are generated automatically each evening at 9:00 PM.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">USD Processed</TableHead>
                    <TableHead className="text-right">PB Credits</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-center">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((row) => {
                    const d = parseLocalDate(row.summary_date);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {format(d, "EEE, MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(row.total_sales))}
                        </TableCell>
                        <TableCell className="text-right text-success font-semibold">
                          {formatCurrency(Number(row.total_usd_processed))}
                        </TableCell>
                        <TableCell className="text-right text-accent font-semibold">
                          {formatPawBucks(row.total_pawbucks_credits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.transaction_count}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.email_sent ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Mail className="h-3 w-3" /> Sent
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                              <MailX className="h-3 w-3" /> —
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounting Note */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4">
          <p className="text-sm text-warning-foreground">
            <strong>Accounting Note:</strong> Use these daily totals to balance your POS "Other" category for End-of-Day reports. Export to PDF for your tax records.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

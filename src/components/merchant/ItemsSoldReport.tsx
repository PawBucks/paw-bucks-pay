import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, Download, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  merchantId: string;
  merchantName?: string;
}

type ReportRow = {
  name: string;
  sku: string | null;
  source_type: string;
  total_quantity: number;
  total_revenue: number;
  transaction_count: number;
};

const SOURCE_LABEL: Record<string, string> = {
  catalog_item: "Catalog",
  pet_store_item: "Store",
  merchant_service: "Service",
  custom: "Custom",
};

export const ItemsSoldReport = ({ merchantId, merchantName }: Props) => {
  const [startDate, setStartDate] = useState<Date>(() => subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["items-sold-report", merchantId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await supabase.rpc("merchant_items_sold_report", {
        p_merchant_id: merchantId,
        p_start: startOfDay(startDate).toISOString(),
        p_end: endOfDay(endDate).toISOString(),
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        name: r.name,
        sku: r.sku,
        source_type: r.source_type,
        total_quantity: Number(r.total_quantity),
        total_revenue: Number(r.total_revenue),
        transaction_count: Number(r.transaction_count),
      }));
    },
    enabled: !!merchantId,
  });

  const totals = useMemo(
    () => ({
      items: rows.length,
      qty: rows.reduce((s, r) => s + r.total_quantity, 0),
      revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
    }),
    [rows],
  );

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export for this date range");
      return;
    }
    const header = ["Item", "SKU", "Type", "Quantity Sold", "Revenue", "Transactions"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const esc = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      lines.push(
        [
          esc(r.name),
          esc(r.sku || ""),
          esc(SOURCE_LABEL[r.source_type] || r.source_type),
          r.total_quantity,
          r.total_revenue.toFixed(2),
          r.transaction_count,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `items-sold-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Items sold report exported");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Items Sold
          </CardTitle>
          <CardDescription>
            {merchantName ? `Aggregate item sales for ${merchantName}.` : "Aggregate item sales over a date range."}{" "}
            Refunded transactions are excluded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <Button variant="secondary" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
            <Button onClick={exportCsv} className="ml-auto gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Distinct items</div>
              <div className="text-xl font-semibold mt-1">{totals.items}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Units sold</div>
              <div className="text-xl font-semibold mt-1">{totals.qty}</div>
            </div>
            <div className="rounded-lg border bg-success/5 border-success/20 p-3">
              <div className="text-xs text-success uppercase tracking-wider">Revenue</div>
              <div className="text-xl font-semibold text-success mt-1">
                {Formatters.currency(totals.revenue)}
              </div>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right"># Txns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No itemized sales in this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.name}-${r.sku ?? ""}-${i}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.sku || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {SOURCE_LABEL[r.source_type] || r.source_type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_quantity}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {Formatters.currency(r.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.transaction_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
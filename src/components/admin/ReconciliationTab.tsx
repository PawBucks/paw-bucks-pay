import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, RefreshCw, AlertTriangle, FileWarning, Receipt, Hash } from "lucide-react";
import { toast } from "sonner";

type Row = {
  kind: "orphan_invoice_transaction" | "invoice_number_gap" | "paid_invoice_no_transaction";
  merchant_id: string;
  business_name: string;
  detail: string;
  reference_id: string;
  amount: number | null;
  occurred_at: string | null;
};

const KIND_META: Record<Row["kind"], { label: string; icon: typeof FileWarning; tone: string }> = {
  orphan_invoice_transaction: {
    label: "Orphan Transactions",
    icon: Receipt,
    tone: "destructive",
  },
  invoice_number_gap: {
    label: "Invoice Number Gaps",
    icon: Hash,
    tone: "secondary",
  },
  paid_invoice_no_transaction: {
    label: "Paid – No Transaction",
    icon: FileWarning,
    tone: "destructive",
  },
};

const formatUsd = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" });
  } catch {
    return iso;
  }
};

export const ReconciliationTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeKind, setActiveKind] = useState<Row["kind"]>("orphan_invoice_transaction");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_reconciliation_report" as never);
      if (error) throw error;
      setRows((data as unknown as Row[]) ?? []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load reconciliation report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.kind] = (out[r.kind] || 0) + 1;
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => r.kind === activeKind)
      .filter((r) =>
        !term
          ? true
          : r.business_name.toLowerCase().includes(term) ||
            r.detail.toLowerCase().includes(term) ||
            r.reference_id.toLowerCase().includes(term),
      );
  }, [rows, activeKind, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cross-Account Reconciliation
            </CardTitle>
            <CardDescription>
              Every penny across Pet Owners, Merchants, Vets, Brands and Admins. This
              report surfaces transactions that don't tie back to an invoice,
              skipped invoice numbers, and invoices marked paid without a recorded
              transaction.
            </CardDescription>
          </div>
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as Row["kind"])}>
            <TabsList className="grid grid-cols-3 w-full">
              {(Object.keys(KIND_META) as Row["kind"][]).map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                return (
                  <TabsTrigger key={k} value={k} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{meta.label}</span>
                    <Badge variant={counts[k] ? "destructive" : "secondary"} className="ml-1">
                      {counts[k] || 0}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="my-4">
              <Input
                placeholder="Search by business, detail or reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {(Object.keys(KIND_META) as Row["kind"][]).map((k) => (
              <TabsContent key={k} value={k} className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No issues found in this category. Every record is accounted for.
                  </div>
                ) : (
                  <div className="rounded-md border divide-y">
                    {filtered.map((r) => (
                      <div
                        key={`${r.kind}-${r.reference_id}-${r.merchant_id}`}
                        className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.business_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {r.detail}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
                            ref: {r.reference_id}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold">{formatUsd(r.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(r.occurred_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconciliationTab;
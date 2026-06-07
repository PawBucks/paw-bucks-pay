import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Formatters } from "@/utils/formatters";
import type { MerchantPerformanceRow } from "@/services/api/brandCampaigns.service";

type SortKey =
  | "business_name"
  | "campaigns_count"
  | "checkins"
  | "unique_users"
  | "pawbucks_distributed"
  | "pawbucks_redeemed"
  | "redemption_rate_pct"
  | "last_activity_at";

interface AllMerchantsPerformanceProps {
  rows: MerchantPerformanceRow[];
  isLoading?: boolean;
}

export function AllMerchantsPerformance({ rows, isLoading }: AllMerchantsPerformanceProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("checkins");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = q
      ? rows.filter(
          (r) =>
            r.business_name.toLowerCase().includes(q) ||
            (r.address || "").toLowerCase().includes(q) ||
            (r.business_type || "").toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.checkins += r.checkins;
        acc.unique_users += r.unique_users;
        acc.pawbucks_distributed += r.pawbucks_distributed;
        acc.pawbucks_redeemed += r.pawbucks_redeemed;
        return acc;
      },
      { checkins: 0, unique_users: 0, pawbucks_distributed: 0, pawbucks_redeemed: 0 },
    );
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "business_name" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "Business Name",
      "Type",
      "Address",
      "Campaigns",
      "Check-ins",
      "Unique Pet Owners",
      "PawBucks Distributed",
      "PawBucks Redeemed",
      "Redemption Rate %",
      "Last Activity",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          escapeCsv(r.business_name),
          escapeCsv(r.business_type || ""),
          escapeCsv(r.address || ""),
          r.campaigns_count,
          r.checkins,
          r.unique_users,
          r.pawbucks_distributed,
          r.pawbucks_redeemed,
          r.redemption_rate_pct.toFixed(2),
          r.last_activity_at || "",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merchant-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" aria-hidden />
              All Participating Merchants
              <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>
              Full performance breakdown for every merchant enrolled in your campaigns
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden /> Export CSV
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search merchants by name, type, or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading merchants…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Store className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden />
            No merchants enrolled in your campaigns yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th label="Merchant" sortKey="business_name" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left" />
                  <Th label="Campaigns" sortKey="campaigns_count" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Check-ins" sortKey="checkins" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Pet Owners" sortKey="unique_users" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="PB Distributed" sortKey="pawbucks_distributed" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="PB Redeemed" sortKey="pawbucks_redeemed" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Redemption %" sortKey="redemption_rate_pct" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Last Activity" sortKey="last_activity_at" current={sortKey} dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.merchant_id}
                    className={cn(
                      "border-t border-border hover:bg-muted/40 transition-colors",
                      idx % 2 === 1 && "bg-muted/10",
                    )}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="flex items-center gap-2.5 min-w-[200px]">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {r.logo_url && <AvatarImage src={r.logo_url} alt={r.business_name} />}
                          <AvatarFallback className="text-[10px]">
                            {r.business_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.business_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.business_type || "Merchant"}
                            {r.address ? ` · ${r.address}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center tabular-nums">{r.campaigns_count}</td>
                    <td className="py-2.5 px-2 text-center tabular-nums font-semibold">{r.checkins.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center tabular-nums">{r.unique_users.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center tabular-nums">{r.pawbucks_distributed.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center tabular-nums">{r.pawbucks_redeemed.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center tabular-nums">
                      <span
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-xs",
                          r.redemption_rate_pct >= 50
                            ? "bg-success/15 text-success"
                            : r.redemption_rate_pct >= 20
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {Formatters.decimal(r.redemption_rate_pct, 1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 pl-2 text-center text-xs text-muted-foreground whitespace-nowrap">
                      {r.last_activity_at
                        ? new Date(r.last_activity_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "America/New_York",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No merchants match "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-muted/40 text-xs font-medium">
                  <tr className="border-t border-border">
                    <td className="py-2 pl-4 pr-2">Totals ({filtered.length})</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                    <td className="py-2 px-2 text-center tabular-nums">{totals.checkins.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{totals.unique_users.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{totals.pawbucks_distributed.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{totals.pawbucks_redeemed.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center tabular-nums">
                      {Formatters.decimal(
                        totals.pawbucks_distributed > 0
                          ? (totals.pawbucks_redeemed / totals.pawbucks_distributed) * 100
                          : 0,
                        1,
                      )}
                      %
                    </td>
                    <td className="py-2 pr-4 pl-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn("py-2.5 px-2 font-medium", className ?? "text-center")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </th>
  );
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
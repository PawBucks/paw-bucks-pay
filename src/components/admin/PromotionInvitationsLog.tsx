import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, CheckCircle2, XCircle, Inbox, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listAllPromotionInvitations,
  listPromotions,
  resolveRecipientNames,
  type PlatformPromotion,
} from "@/services/api/platformPromotions.service";

type StatusFilter = "all" | "pending" | "accepted" | "declined";
type TypeFilter = "all" | "merchant" | "vet";

function formatEST(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return <Badge className="bg-[hsl(var(--success))] text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Accepted</Badge>;
  if (status === "declined")
    return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Declined</Badge>;
  return <Badge variant="secondary"><span className="h-3 w-3 mr-1" aria-hidden="true">⏰</span> Pending</Badge>;
}

export function PromotionInvitationsLog() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [promotionFilter, setPromotionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Promotions list (for the dropdown)
  const { data: promotions = [] } = useQuery({
    queryKey: ["platform-promotions"],
    queryFn: async () => {
      const { data, error } = await listPromotions();
      if (error) throw error;
      return (data || []) as unknown as PlatformPromotion[];
    },
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["promotion-invitations-log", statusFilter, typeFilter, promotionFilter],
    queryFn: async () => {
      const { data, error } = await listAllPromotionInvitations({
        status: statusFilter === "all" ? undefined : statusFilter,
        recipient_type: typeFilter === "all" ? undefined : typeFilter,
        promotion_id: promotionFilter === "all" ? undefined : promotionFilter,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 60000,
  });

  // Resolve recipient names
  const { data: nameMap } = useQuery({
    queryKey: [
      "promotion-invitations-names",
      invitations.map((i) => `${i.recipient_type}:${i.recipient_id}`).join(","),
    ],
    queryFn: async () => {
      const merchantIds = invitations.filter((i) => i.recipient_type === "merchant").map((i) => i.recipient_id);
      const vetIds = invitations.filter((i) => i.recipient_type === "vet").map((i) => i.recipient_id);
      return await resolveRecipientNames(
        Array.from(new Set(merchantIds)),
        Array.from(new Set(vetIds)),
      );
    },
    enabled: invitations.length > 0,
  });

  const rows = useMemo(() => {
    const enriched = invitations.map((i) => {
      const lookup = i.recipient_type === "merchant" ? nameMap?.merchants : nameMap?.vets;
      const info = lookup?.[i.recipient_id];
      return {
        ...i,
        recipient_name: info?.name || "—",
        recipient_email: info?.email || null,
      };
    });
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (i) =>
        i.recipient_name?.toLowerCase().includes(q) ||
        i.recipient_email?.toLowerCase().includes(q) ||
        i.promotion?.title?.toLowerCase().includes(q),
    );
  }, [invitations, nameMap, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, declined: 0, total: rows.length };
    rows.forEach((r) => {
      if (r.status === "pending") c.pending++;
      else if (r.status === "accepted") c.accepted++;
      else if (r.status === "declined") c.declined++;
    });
    return c;
  }, [rows]);

  const exportCsv = () => {
    const header = ["Promotion", "Recipient Type", "Recipient", "Email", "Status", "Invited At (EST)", "Responded At (EST)"];
    const lines = rows.map((r) => [
      r.promotion?.title ?? "",
      r.recipient_type,
      r.recipient_name,
      r.recipient_email ?? "",
      r.status,
      formatEST(r.invited_at),
      formatEST(r.responded_at),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promotion-invitations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" /> Sent Invitations
            </CardTitle>
            <CardDescription>
              Every promotion invitation sent to Merchants and Vets, with live status (times in EST).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-3">
          <Badge variant="outline">Total: {counts.total}</Badge>
          <Badge variant="secondary"><span className="h-3 w-3 mr-1" aria-hidden="true">⏰</span> Pending: {counts.pending}</Badge>
          <Badge className="bg-[hsl(var(--success))] text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Accepted: {counts.accepted}</Badge>
          <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Declined: {counts.declined}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search recipient or promotion…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v: TypeFilter) => setTypeFilter(v)}>
            <SelectTrigger><SelectValue placeholder="Recipient type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All recipients</SelectItem>
              <SelectItem value="merchant">Merchants only</SelectItem>
              <SelectItem value="vet">Vets only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={promotionFilter} onValueChange={setPromotionFilter}>
            <SelectTrigger><SelectValue placeholder="Promotion" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All promotions</SelectItem>
              {promotions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No invitations match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3 font-medium">Promotion</th>
                  <th className="p-3 font-medium">Recipient</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium hidden md:table-cell">Invited (EST)</th>
                  <th className="p-3 font-medium hidden md:table-cell">Responded (EST)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30 transition">
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[200px]">{r.promotion?.title ?? "—"}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.recipient_type === "merchant" ? (
                          <span className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true">🏪</span>
                        ) : (
                          <span className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true">🩺</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[200px]">{r.recipient_name}</p>
                          {r.recipient_email && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.recipient_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{formatEST(r.invited_at)}</td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{formatEST(r.responded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
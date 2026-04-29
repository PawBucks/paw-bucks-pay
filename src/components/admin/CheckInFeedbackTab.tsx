import { useState, useCallback, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { Button } from"@/components/ui/button";
import { Search, ThumbsDown, Store, ChevronLeft, ChevronRight, BarChart3 } from"lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";

const PAGE_SIZE = 25;

const REASON_LABELS: Record<string, string> = {
 browsing:"Just Browsing",
 price_too_high:"Price Too High",
 not_found:"Didn't Find What I Wanted",
 picking_up_info:"Just Picking Up Info",
};

type FeedbackRow = {
 id: string;
 user_id: string;
 entity_name: string;
 merchant_id: string | null;
 vet_id: string | null;
 visit_purpose: string | null;
 answered_at: string | null;
 created_at: string;
 profile_name: string | null;
 profile_email: string | null;
};

export function CheckInFeedbackTab() {
 const [rows, setRows] = useState<FeedbackRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [reasonFilter, setReasonFilter] = useState("all");
 const [page, setPage] = useState(0);
 const [totalCount, setTotalCount] = useState(0);
 const [stats, setStats] = useState<Record<string, number>>({});

 const load = useCallback(async () => {
 setLoading(true);
 try {
 let query = supabase
 .from("checkin_followups")
 .select("id, user_id, entity_name, merchant_id, vet_id, visit_purpose, answered_at, created_at", { count:"exact" })
 .eq("response","no")
 .not("visit_purpose","is", null)
 .order("answered_at", { ascending: false })
 .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

 if (reasonFilter !=="all") {
 query = query.eq("visit_purpose", reasonFilter);
 }

 const { data, count, error } = await query;
 if (error) throw error;

 setTotalCount(count ?? 0);

 if (!data || data.length === 0) {
 setRows([]);
 return;
 }

 // Enrich with profile data
 const userIds = [...new Set(data.map(d => d.user_id))];
 const { data: profiles } = await supabase
 .from("profiles")
 .select("id, full_name, email")
 .in("id", userIds);

 const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);

 setRows(data.map(d => ({
 ...d,
 profile_name: profileMap.get(d.user_id)?.full_name ?? null,
 profile_email: profileMap.get(d.user_id)?.email ?? null,
 })));
 } catch (err) {
 console.error(err);
 toast.error("Failed to load feedback");
 } finally {
 setLoading(false);
 }
 }, [page, reasonFilter]);

 const loadStats = useCallback(async () => {
 const { data } = await supabase
 .from("checkin_followups")
 .select("visit_purpose")
 .eq("response","no")
 .not("visit_purpose","is", null);

 if (data) {
 const counts: Record<string, number> = {};
 data.forEach(d => {
 const r = d.visit_purpose ??"unknown";
 counts[r] = (counts[r] || 0) + 1;
 });
 setStats(counts);
 }
 }, []);

 useEffect(() => { load(); }, [load]);
 useEffect(() => { loadStats(); }, [loadStats]);
 useEffect(() => { setPage(0); }, [reasonFilter]);

 const filtered = search
 ? rows.filter(r => {
 const q = search.toLowerCase();
 return (
 r.profile_name?.toLowerCase().includes(q) ||
 r.profile_email?.toLowerCase().includes(q) ||
 r.entity_name.toLowerCase().includes(q)
 );
 })
 : rows;

 const totalPages = Math.ceil(totalCount / PAGE_SIZE);
 const totalFeedback = Object.values(stats).reduce((a, b) => a + b, 0);

 return (
 <div className="space-y-6">
 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 <Card>
 <CardContent className="pt-4 pb-3 px-4">
 <p className="text-2xl font-bold">{totalFeedback}</p>
 <p className="text-xs text-muted-foreground">Total"No" Responses</p>
 </CardContent>
 </Card>
 {Object.entries(REASON_LABELS).map(([key, label]) => (
 <Card key={key}>
 <CardContent className="pt-4 pb-3 px-4">
 <p className="text-2xl font-bold">{stats[key] ?? 0}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </CardContent>
 </Card>
 ))}
 </div>

 <Card>
 <CardHeader className="pb-3">
 <div className="flex items-center gap-2">
 <ThumbsDown className="w-5 h-5 text-destructive" />
 <CardTitle className="text-lg">No-Purchase Feedback</CardTitle>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by name, email, or location..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={reasonFilter} onValueChange={setReasonFilter}>
 <SelectTrigger className="w-[200px]">
 <SelectValue placeholder="Filter by reason" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Reasons</SelectItem>
 {Object.entries(REASON_LABELS).map(([key, label]) => (
 <SelectItem key={key} value={key}>{label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {loading ? (
 <div className="text-center py-12 text-muted-foreground">Loading...</div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
 <p>No feedback found</p>
 </div>
 ) : (
 <>
 <div className="rounded-md border overflow-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Pet Owner</TableHead>
 <TableHead>Location</TableHead>
 <TableHead>Reason</TableHead>
 <TableHead>Date</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.map(row => (
 <TableRow key={row.id}>
 <TableCell>
 <div>
 <p className="font-medium text-sm">{row.profile_name ||"Unknown"}</p>
 <p className="text-xs text-muted-foreground">{row.profile_email ||"—"}</p>
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1.5">
 <Store className="w-3.5 h-3.5 text-muted-foreground" />
 <span className="text-sm">{row.entity_name}</span>
 </div>
 <Badge variant={row.merchant_id ?"default" :"secondary"} className="text-[10px] mt-1">
 {row.merchant_id ?"Merchant" :"Vet"}
 </Badge>
 </TableCell>
 <TableCell>
 <Badge variant="outline" className="text-xs">
 {REASON_LABELS[row.visit_purpose ??""] ?? row.visit_purpose ??"Unknown"}
 </Badge>
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {row.answered_at ? format(new Date(row.answered_at),"MMM d, yyyy h:mm a") :"—"}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 <div className="flex items-center justify-between">
 <p className="text-xs text-muted-foreground">
 Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
 </p>
 <div className="flex gap-2">
 <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
 <ChevronLeft className="w-4 h-4" />
 </Button>
 <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
 <ChevronRight className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

import { useState, useEffect, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Button } from"@/components/ui/button";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Search, Users, Calendar, MapPin, Clock, ChevronLeft, ChevronRight, User, Store } from"lucide-react";
import { format, parse, subMonths, startOfDay, endOfDay, startOfMonth, endOfMonth } from"date-fns";
import { toast } from"sonner";

type AdminCheckIn = {
 id: string;
 user_id: string;
 merchant_id: string | null;
 vet_id: string | null;
 checked_in_at: string;
 checkin_token: string;
 created_at: string;
 profile_name: string | null;
 profile_email: string | null;
 profile_phone: string | null;
 entity_name: string | null;
 entity_type:"merchant" |"vet";
};

const PAGE_SIZE = 50;

const parseSelectedMonth = (selectedMonth: string) =>
 parse(`${selectedMonth}-01`,"yyyy-MM-dd", new Date());

export function AdminCheckInsTab() {
 const [checkins, setCheckins] = useState<AdminCheckIn[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState("");
 const [selectedMonth, setSelectedMonth] = useState(format(new Date(),"yyyy-MM"));
 const [entityFilter, setEntityFilter] = useState<"all" |"merchant" |"vet">("all");
 const [page, setPage] = useState(0);
 const [totalCount, setTotalCount] = useState(0);
 const [todayCount, setTodayCount] = useState(0);
 const [monthCount, setMonthCount] = useState(0);

 const loadCheckins = useCallback(async () => {
 setLoading(true);
 try {
 const monthDate = parseSelectedMonth(selectedMonth);
 const rangeStart = startOfMonth(monthDate).toISOString();
 const rangeEnd = endOfMonth(monthDate).toISOString();

 // Build query
 let query = supabase
 .from("checkins")
 .select("id, user_id, merchant_id, vet_id, checked_in_at, checkin_token, created_at", { count:"exact" })
 .gte("checked_in_at", rangeStart)
 .lte("checked_in_at", rangeEnd)
 .order("checked_in_at", { ascending: false });

 if (entityFilter ==="merchant") {
 query = query.not("merchant_id","is", null);
 } else if (entityFilter ==="vet") {
 query = query.not("vet_id","is", null);
 }

 const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

 if (error) throw error;

 setTotalCount(count || 0);

 if (!data || data.length === 0) {
 setCheckins([]);
 setLoading(false);
 return;
 }

 // Gather unique IDs
 const userIds = [...new Set(data.map(c => c.user_id))];
 const merchantIds = [...new Set(data.filter(c => c.merchant_id).map(c => c.merchant_id!))];
 const vetIds = [...new Set(data.filter(c => c.vet_id).map(c => c.vet_id!))];

 // Fetch profiles, merchants, vets in parallel
 const [profilesRes, merchantsRes, vetsRes] = await Promise.all([
 supabase.from("profiles").select("id, full_name, phone").in("id", userIds),
 merchantIds.length > 0
 ? supabase.from("merchants").select("id, business_name").in("id", merchantIds)
 : Promise.resolve({ data: [] }),
 vetIds.length > 0
 ? supabase.from("partner_vets").select("id, clinic_name").in("id", vetIds)
 : Promise.resolve({ data: [] }),
 ]);

 const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
 const merchantMap = new Map((merchantsRes.data || []).map(m => [m.id, m.business_name]));
 const vetMap = new Map((vetsRes.data || []).map(v => [v.id, v.clinic_name]));

 // For admin, emails aren't directly available from profiles
 // We'll show what we have from profiles (name, phone)
 const emailMap = new Map<string, string>();

 const enriched: AdminCheckIn[] = data.map(c => ({
 ...c,
 profile_name: profileMap.get(c.user_id)?.full_name ?? null,
 profile_email: emailMap.get(c.user_id) ?? null,
 profile_phone: profileMap.get(c.user_id)?.phone ?? null,
 entity_name: c.merchant_id
 ? merchantMap.get(c.merchant_id) ??"Unknown Merchant"
 : c.vet_id
 ? vetMap.get(c.vet_id) ??"Unknown Vet"
 :"Unknown",
 entity_type: c.merchant_id ?"merchant" as const :"vet" as const,
 }));

 setCheckins(enriched);
 } catch (err) {
 console.error("Error loading admin check-ins:", err);
 toast.error("Failed to load check-ins");
 } finally {
 setLoading(false);
 }
 }, [selectedMonth, entityFilter, page]);

 // Load today + month stats
 const loadStats = useCallback(async () => {
 try {
 const today = new Date();
 const monthDate = parseSelectedMonth(selectedMonth);
 const [todayRes, monthRes] = await Promise.all([
 supabase
 .from("checkins")
 .select("id", { count:"exact", head: true })
 .gte("checked_in_at", startOfDay(today).toISOString())
 .lte("checked_in_at", endOfDay(today).toISOString()),
 supabase
 .from("checkins")
 .select("id", { count:"exact", head: true })
 .gte("checked_in_at", startOfMonth(monthDate).toISOString())
 .lte("checked_in_at", endOfMonth(monthDate).toISOString()),
 ]);
 setTodayCount(todayRes.count || 0);
 setMonthCount(monthRes.count || 0);
 } catch {
 // silent
 }
 }, [selectedMonth]);

 useEffect(() => {
 loadCheckins();
 loadStats();
 }, [loadCheckins, loadStats]);

 // Reset page on filter change
 useEffect(() => {
 setPage(0);
 }, [selectedMonth, entityFilter]);

 const months = Array.from({ length: 24 }, (_, i) => {
 const d = subMonths(new Date(), i);
 return { value: format(d,"yyyy-MM"), label: format(d,"MMMM yyyy") };
 });

 const filtered = searchQuery
 ? checkins.filter(c => {
 const q = searchQuery.toLowerCase();
 return (
 c.profile_name?.toLowerCase().includes(q) ||
 c.profile_email?.toLowerCase().includes(q) ||
 c.profile_phone?.toLowerCase().includes(q) ||
 c.entity_name?.toLowerCase().includes(q)
 );
 })
 : checkins;

 const totalPages = Math.ceil(totalCount / PAGE_SIZE);

 return (
 <div className="space-y-6">
 {/* Stats Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <Card>
 <CardContent className="p-4 flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Users className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-2xl font-bold">{todayCount}</p>
 <p className="text-sm text-muted-foreground">Today's Check-Ins</p>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4 flex items-center gap-3">
 <div className="p-2 bg-accent/10 rounded-lg">
 <Calendar className="w-5 h-5 text-accent-foreground" />
 </div>
 <div>
 <p className="text-2xl font-bold">{monthCount}</p>
 <p className="text-sm text-muted-foreground">
 {months.find(m => m.value === selectedMonth)?.label || selectedMonth}
 </p>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="p-4 flex items-center gap-3">
 <div className="p-2 bg-secondary/50 rounded-lg">
 <MapPin className="w-5 h-5 text-secondary-foreground" />
 </div>
 <div>
 <p className="text-2xl font-bold">{totalCount}</p>
 <p className="text-sm text-muted-foreground">Filtered Results</p>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Filters */}
 <Card>
 <CardHeader className="pb-3">
 <CardTitle className="text-lg">Platform Check-Ins</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by name, email, phone, or location..."
 className="pl-9"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <Select value={selectedMonth} onValueChange={setSelectedMonth}>
 <SelectTrigger className="w-full sm:w-48">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {months.map(m => (
 <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as any)}>
 <SelectTrigger className="w-full sm:w-40">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Locations</SelectItem>
 <SelectItem value="merchant">Merchants</SelectItem>
 <SelectItem value="vet">Vets</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Table */}
 {loading ? (
 <div className="space-y-3">
 {[1, 2, 3, 4, 5].map(i => (
 <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
 ))}
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
 <p>No check-ins found</p>
 </div>
 ) : (
 <>
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Pet Owner</TableHead>
 <TableHead>Location</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Check-In Time</TableHead>
 <TableHead>Contact</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.map(checkin => (
 <TableRow key={checkin.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <User className="w-4 h-4 text-primary" />
 </div>
 <span className="font-medium text-sm">
 {checkin.profile_name ||"Unknown User"}
 </span>
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <Store className="w-4 h-4 text-muted-foreground flex-shrink-0" />
 <span className="text-sm">{checkin.entity_name}</span>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant={checkin.entity_type ==="merchant" ?"default" :"secondary"} className="text-xs">
 {checkin.entity_type ==="merchant" ?"Merchant" :"Vet"}
 </Badge>
 </TableCell>
 <TableCell>
 <div className="text-sm">
 <div className="flex items-center gap-1">
 <Clock className="w-3 h-3 text-muted-foreground" />
 {format(new Date(checkin.checked_in_at),"h:mm a")}
 </div>
 <p className="text-xs text-muted-foreground">
 {format(new Date(checkin.checked_in_at),"MMM d, yyyy")}
 </p>
 </div>
 </TableCell>
 <TableCell>
 <div className="text-xs text-muted-foreground space-y-0.5">
 {checkin.profile_email && <p>{checkin.profile_email}</p>}
 {checkin.profile_phone && <p>{checkin.profile_phone}</p>}
 {!checkin.profile_email && !checkin.profile_phone && <p>—</p>}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between pt-2">
 <p className="text-sm text-muted-foreground">
 Page {page + 1} of {totalPages} ({totalCount} total)
 </p>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 disabled={page === 0}
 onClick={() => setPage(p => p - 1)}
 >
 <ChevronLeft className="w-4 h-4" />
 </Button>
 <Button
 variant="outline"
 size="sm"
 disabled={page >= totalPages - 1}
 onClick={() => setPage(p => p + 1)}
 >
 <ChevronRight className="w-4 h-4" />
 </Button>
 </div>
 </div>
 )}
 </>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

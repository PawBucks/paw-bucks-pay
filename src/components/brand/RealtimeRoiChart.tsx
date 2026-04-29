import { useEffect, useState } from"react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, ComposedChart, Line } from"recharts";
import { Activity, Loader2 } from"lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { useQuery } from"@tanstack/react-query";

interface RealtimeRoiChartProps {
 brandId: string;
}

interface HourlyRow {
 hour_bucket: string;
 checkins: number;
 pawbucks_distributed: number;
 spend_usd: number;
}

export function RealtimeRoiChart({ brandId }: RealtimeRoiChartProps) {
 const [tick, setTick] = useState(0);

 // Realtime subscription: re-trigger query when activity changes
 useEffect(() => {
 const channel = supabase
 .channel(`brand-realtime-${brandId}`)
 .on("postgres_changes", { event:"INSERT", schema:"public", table:"branded_pawbucks_activity" }, () => {
 setTick((t) => t + 1);
 })
 .on("postgres_changes", { event:"*", schema:"public", table:"brand_campaign_hourly_stats" }, () => {
 setTick((t) => t + 1);
 })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [brandId]);

 const { data: rows = [], isLoading } = useQuery({
 queryKey: ["brand-hourly-stats", brandId, tick],
 queryFn: async (): Promise<HourlyRow[]> => {
 const { data: campaigns } = await supabase
 .from("brand_campaigns")
 .select("id")
 .eq("brand_id", brandId);
 const ids = (campaigns || []).map((c: any) => c.id);
 if (!ids.length) return [];
 const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
 const { data } = await supabase
 .from("brand_campaign_hourly_stats")
 .select("hour_bucket, checkins, pawbucks_distributed, spend_usd")
 .in("campaign_id", ids)
 .gte("hour_bucket", since)
 .order("hour_bucket", { ascending: true });

 // Aggregate per hour across campaigns
 const map = new Map<string, HourlyRow>();
 for (const r of (data || []) as any[]) {
 const k = r.hour_bucket;
 const existing = map.get(k);
 if (existing) {
 existing.checkins += r.checkins;
 existing.pawbucks_distributed += r.pawbucks_distributed;
 existing.spend_usd += Number(r.spend_usd || 0);
 } else {
 map.set(k, { ...r, spend_usd: Number(r.spend_usd || 0) });
 }
 }
 return Array.from(map.values());
 },
 refetchInterval: 30000,
 });

 return (
 <Card className="overflow-hidden">
 <CardHeader className="pb-2">
 <div className="flex items-start justify-between">
 <div>
 <CardTitle className="text-base flex items-center gap-2">
 <Activity className="h-4 w-4 text-primary" />
 Real-Time ROI (Last 24h)
 <span className="relative flex h-2 w-2 ml-1">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
 </span>
 </CardTitle>
 <CardDescription>Hourly check-ins vs spend across all live campaigns</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {isLoading ? (
 <div className="h-[240px] flex items-center justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 ) : rows.length === 0 ? (
 <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
 No hourly data yet. Stats appear within an hour of your first check-in.
 </div>
 ) : (
 <ResponsiveContainer width="100%" height={240}>
 <ComposedChart data={rows} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
 <defs>
 <linearGradient id="checkinsGradient" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
 <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
 <XAxis
 dataKey="hour_bucket"
 tickFormatter={(v) => new Date(v).toLocaleTimeString(undefined, { hour:"numeric" })}
 tick={{ fontSize: 11, fill:"hsl(var(--muted-foreground))" }}
 tickLine={false}
 axisLine={false}
 />
 <YAxis
 yAxisId="left"
 tick={{ fontSize: 11, fill:"hsl(var(--muted-foreground))" }}
 tickLine={false}
 axisLine={false}
 />
 <YAxis
 yAxisId="right"
 orientation="right"
 tick={{ fontSize: 11, fill:"hsl(var(--muted-foreground))" }}
 tickLine={false}
 axisLine={false}
 tickFormatter={(v) => `$${v}`}
 />
 <Tooltip
 contentStyle={{
 background:"hsl(var(--card))",
 border:"1px solid hsl(var(--border))",
 borderRadius: 8,
 fontSize: 12,
 }}
 labelFormatter={(v) => new Date(v).toLocaleString(undefined, { weekday:"short", hour:"numeric" })}
 />
 <Area
 yAxisId="left"
 type="monotone"
 dataKey="checkins"
 stroke="hsl(var(--primary))"
 strokeWidth={2}
 fill="url(#checkinsGradient)"
 name="Check-ins"
 />
 <Line
 yAxisId="right"
 type="monotone"
 dataKey="spend_usd"
 stroke="hsl(var(--destructive))"
 strokeWidth={2}
 dot={false}
 name="Spend ($)"
 />
 </ComposedChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 );
}

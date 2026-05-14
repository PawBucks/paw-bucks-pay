import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { AlertTriangle, Clock, Crown, Flame, Gem, Lock, Megaphone, TrendingUp, Users } from "lucide-react";
import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";

type ScarcitySignalWidgetProps = {
 merchantId: string;
 businessType: string;
};

type ServiceSlotData = {
 serviceName: string;
 serviceId: string;
 maxSlots: number;
 usedSlots: number;
 waitlistCount: number;
 lastTakenAt: string | null;
 icon: React.ElementType;
 tier:"featured" |"premium" |"sponsored";
};

const SERVICE_NAMES: Record<string, { icon: React.ElementType; tier:"featured" |"premium" |"sponsored" }> = {
"Featured Partner Status": { icon: Crown, tier:"featured" },
"Premium Ad Placement": { icon: Gem, tier:"premium" },
"Sponsored Placement": { icon: Megaphone, tier:"sponsored" },
};

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
 const [timeLeft, setTimeLeft] = useState("");

 useEffect(() => {
 const update = () => {
 const now = new Date().getTime();
 const end = new Date(expiresAt).getTime();
 const diff = end - now;
 if (diff <= 0) {
 setTimeLeft("Expired");
 return;
 }
 const days = Math.floor(diff / (1000 * 60 * 60 * 24));
 const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
 const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 if (days > 0) setTimeLeft(`${days}d ${hours}h`);
 else setTimeLeft(`${hours}h ${mins}m`);
 };
 update();
 const interval = setInterval(update, 60000);
 return () => clearInterval(interval);
 }, [expiresAt]);

 return (
 <span className="text-xs font-mono text-warning flex items-center gap-1">
 <Clock className="h-3 w-3" aria-hidden="true" />
 {timeLeft}
 </span>
 );
}

export function ScarcitySignalWidget({ merchantId, businessType }: ScarcitySignalWidgetProps) {
 const navigate = useNavigate();

 const { data: scarcityData, isLoading } = useQuery({
 queryKey: ["scarcity-signals", merchantId, businessType],
 queryFn: async () => {
 // Get merchant's geo cell
 const { data: geoCell } = await supabase.rpc("get_merchant_geo_cell", {
 p_merchant_id: merchantId,
 });

 if (!geoCell) return null;

 const geoCellId = geoCell as string;

 // Get geo cell info
 const { data: cellInfo } = await supabase
 .from("geo_cells")
 .select("name")
 .eq("id", geoCellId)
 .single();

 // Get visibility services by name
 const serviceNames = Object.keys(SERVICE_NAMES);
 const { data: services } = await supabase
 .from("merchant_market_services")
 .select("id, name")
 .in("name", serviceNames)
 .eq("is_active", true);

 if (!services?.length) return null;

 const slots: ServiceSlotData[] = [];

 for (const service of services) {
 const config = SERVICE_NAMES[service.name];
 if (!config) continue;

 // Get limits for this category
 const { data: limits } = await supabase
 .from("geo_cell_service_limits")
 .select("max_slots")
 .eq("geo_cell_id", geoCellId)
 .eq("service_id", service.id)
 .or(`business_category.is.null,business_category.eq.${businessType}`)
 .eq("is_active", true)
 .limit(1);

 const maxSlots = limits?.[0]?.max_slots ?? 0;
 if (maxSlots === 0) continue;

 // Get active reservations
 const { data: reservations } = await supabase
 .from("geo_cell_slot_reservations")
 .select("created_at, expires_at")
 .eq("geo_cell_id", geoCellId)
 .eq("service_id", service.id)
 .eq("is_active", true)
 .gte("expires_at", new Date().toISOString())
 .or(`business_category.is.null,business_category.eq.${businessType}`);

 // Get waitlist count
 const { count: waitlistCount } = await supabase
 .from("geo_cell_waitlist")
 .select("id", { count:"exact", head: true })
 .eq("geo_cell_id", geoCellId)
 .eq("service_id", service.id)
 .eq("business_category", businessType)
 .eq("status","waiting");

 const usedSlots = reservations?.length ?? 0;

 // Find most recent reservation
 const lastTaken = reservations?.length
 ? reservations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
 : null;

 slots.push({
 serviceName: service.name,
 serviceId: service.id,
 maxSlots,
 usedSlots,
 waitlistCount: waitlistCount ?? 0,
 lastTakenAt: lastTaken?.created_at ?? null,
 icon: config.icon,
 tier: config.tier,
 });
 }

 // Count competing merchants
 const { count: competitorCount } = await supabase
 .from("merchants")
 .select("id", { count:"exact", head: true })
 .eq("business_type", businessType)
 .eq("approval_status","approved");

 return {
 cellName: cellInfo?.name ??"Your Area",
 slots,
 competitorCount: competitorCount ?? 0,
 };
 },
 staleTime: 5 * 60 * 1000,
 });

 if (isLoading || !scarcityData || !scarcityData.slots.length) return null;

 const formatCategory = (type: string) =>
 type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g," ") +"s";

 const getTimeSince = (dateStr: string) => {
 const diff = Date.now() - new Date(dateStr).getTime();
 const days = Math.floor(diff / (1000 * 60 * 60 * 24));
 if (days === 0) return"today";
 if (days === 1) return"yesterday";
 return `${days} days ago`;
 };

 const categoryLabel = formatCategory(businessType);

 return (
 <GradientCard gradient>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Flame className="h-5 w-5 text-destructive" aria-hidden="true" />
 <h3 className="font-bold text-lg">
 Visibility Slots — {scarcityData.cellName}
 </h3>
 </div>
 <Badge variant="outline" className="text-xs">
 {categoryLabel}
 </Badge>
 </div>

 {scarcityData.competitorCount > 1 && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
 <Users className="h-4 w-4" aria-hidden="true" />
 <span>
 <strong className="text-foreground">{scarcityData.competitorCount}</strong>{""}
 merchants competing in {categoryLabel}
 </span>
 </div>
 )}

 <div className="space-y-3">
 {scarcityData.slots.map((slot) => {
 const Icon = slot.icon;
 const isSoldOut = slot.usedSlots >= slot.maxSlots;
 const remaining = Math.max(0, slot.maxSlots - slot.usedSlots);
 const fillPercent = (slot.usedSlots / slot.maxSlots) * 100;

 return (
 <div
 key={slot.serviceId}
 className="rounded-lg border bg-card p-4 space-y-3"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Icon className={`h-4 w-4 ${
 slot.tier ==="featured"
 ?"text-warning"
 : slot.tier ==="premium"
 ?"text-primary"
 :"text-muted-foreground"
 }`} />
 <span className="font-semibold text-sm">{slot.serviceName}</span>
 </div>
 {isSoldOut ? (
 <Badge variant="destructive" className="text-xs flex items-center gap-1">
 <Lock className="h-3 w-3" aria-hidden="true" />
 Sold Out
 </Badge>
 ) : remaining === 1 ? (
 <Badge className="bg-warning text-warning-foreground text-xs flex items-center gap-1 animate-pulse">
 <AlertTriangle className="h-3 w-3" />
 1 Left
 </Badge>
 ) : (
 <span className="text-xs text-muted-foreground">
 {remaining} of {slot.maxSlots} available
 </span>
 )}
 </div>

 <Progress
 value={fillPercent}
 className="h-2"
 />

 <div className="flex items-center justify-between text-xs">
 <div className="flex items-center gap-3">
 {slot.lastTakenAt && (
 <span className="text-muted-foreground">
 Last slot taken {getTimeSince(slot.lastTakenAt)}
 </span>
 )}
 {slot.waitlistCount > 0 && (
 <span className="text-destructive font-medium">
 {slot.waitlistCount} on waitlist
 </span>
 )}
 </div>

 {isSoldOut ? (
 <Button
 size="sm"
 variant="outline"
 className="h-7 text-xs"
 onClick={() => navigate("/merchant/market")}
 >
 Join Waitlist
 </Button>
 ) : (
 <Button
 size="sm"
 className="h-7 text-xs"
 onClick={() => navigate("/merchant/market")}
 >
 <TrendingUp className="h-3 w-3 mr-1" aria-hidden="true" />
 Get Slot
 </Button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </GradientCard>
 );
}

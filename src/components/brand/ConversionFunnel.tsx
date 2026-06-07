import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Filter, Eye, Zap, Gift, Repeat } from "lucide-react";
import { cn } from"@/lib/utils";
import type { CommandCenterSummary } from"@/services/api/brandCampaigns.service";

import { Formatters } from "@/utils/formatters";
interface ConversionFunnelProps {
 summary: CommandCenterSummary;
}

export function ConversionFunnel({ summary }: ConversionFunnelProps) {
 // Funnel stages: Reach -> Check-ins -> Redemptions -> (estimated) Repeat
 const reach = Math.max(summary.unique_users_reached, summary.total_checkins);
 const checkins = summary.total_checkins;
 const redemptions = summary.total_redemptions;
 // Repeat = users with more than 1 check-in (rough estimate)
 const repeat = summary.total_checkins > summary.unique_users_reached
 ? summary.total_checkins - summary.unique_users_reached
 : 0;

 const max = Math.max(reach, 1);
 const stages = [
 { label:"Pet Owners Reached", value: reach, icon: Eye, color:"bg-info" },
 { label:"Check-ins", value: checkins, icon: Zap, color:"bg-primary" },
 { label:"Redemptions", value: redemptions, icon: Gift, color:"bg-accent" },
 { label:"Repeat Visitors", value: repeat, icon: Repeat, color:"bg-success" },
 ];

 return (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Filter className="h-4 w-4 text-primary" />
 Conversion Funnel
 </CardTitle>
 <CardDescription>From reach to repeat — how your campaigns convert</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {stages.map((stage, idx) => {
 const widthPct = (stage.value / max) * 100;
 const conversionPct =
 idx === 0 || stages[idx - 1].value === 0
 ? null
 : (stage.value / stages[idx - 1].value) * 100;
 const Icon = stage.icon;
 return (
 <div key={stage.label}>
 <div className="flex items-center justify-between text-sm mb-1">
 <div className="flex items-center gap-2">
 <Icon className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="font-medium">{stage.label}</span>
 </div>
 <div className="flex items-center gap-2">
 {conversionPct !== null && (
 <span className="text-[10px] text-muted-foreground tabular-nums">
 {Formatters.number(Math.round(conversionPct))}% ↓
 </span>
 )}
 <span className="font-bold tabular-nums">{stage.value.toLocaleString()}</span>
 </div>
 </div>
 <div className="h-7 bg-muted/40 rounded overflow-hidden">
 <div
 className={cn("h-full rounded transition-all", stage.color)}
 style={{ width: `${Math.max(widthPct, 2)}%` }}
 />
 </div>
 </div>
 );
 })}
 </CardContent>
 </Card>
 );
}

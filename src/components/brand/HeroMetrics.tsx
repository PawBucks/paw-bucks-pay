import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { DollarSign, Users, Zap, Target, TrendingDown, Flame, Sparkles, AlertTriangle } from"lucide-react";
import type { CommandCenterSummary } from"@/services/api/brandCampaigns.service";

import { Formatters } from "@/utils/formatters";
interface HeroMetricsProps {
 summary: CommandCenterSummary;
}

export function HeroMetrics({ summary }: HeroMetricsProps) {
 const spendPct =
 summary.total_budget_usd > 0
 ? Math.min((summary.total_spent_usd / summary.total_budget_usd) * 100, 100)
 : 0;
 const remainingUsd = Math.max(summary.total_budget_usd - summary.total_spent_usd, 0);

 const burnAlert =
 summary.days_until_depletion !== null && summary.days_until_depletion <= 14;

 return (
 <div className="space-y-4">
 {/* Burn-rate hero card */}
 <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
 <CardContent className="p-6">
 <div className="flex items-start justify-between gap-4 flex-wrap">
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <Flame className="h-4 w-4 text-primary" />
 <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Live Burn Rate
 </span>
 </div>
 <p className="text-4xl font-bold tabular-nums">
 {Formatters.currency(summary.burn_rate_per_day_usd)}
 <span className="text-base font-normal text-muted-foreground">/day</span>
 </p>
 {summary.days_until_depletion !== null ? (
 <p
 className={`text-sm flex items-center gap-1.5 ${
 burnAlert ?"text-destructive font-medium" :"text-muted-foreground"
 }`}
 >
 {burnAlert && <AlertTriangle className="h-3.5 w-3.5" />}
 At current pace, pool depletes in{""}
 <span className="font-semibold">{summary.days_until_depletion} days</span>
 </p>
 ) : (
 <p className="text-sm text-muted-foreground flex items-center gap-1.5">
 <Sparkles className="h-3.5 w-3.5" />
 Awaiting first activity to forecast burn
 </p>
 )}
 </div>
 <div className="text-right space-y-1">
 <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Total Budget
 </p>
 <p className="text-3xl font-bold tabular-nums">
 ${summary.total_budget_usd.toLocaleString()}
 </p>
 <p className="text-sm text-muted-foreground">
 ${remainingUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} remaining
 </p>
 </div>
 </div>
 <div className="mt-4 space-y-1.5">
 <div className="flex justify-between text-xs">
 <span className="text-muted-foreground">Spent</span>
 <span className="font-medium tabular-nums">{Formatters.decimal(spendPct, 1)}%</span>
 </div>
 <Progress value={spendPct} className="h-2" />
 </div>
 </CardContent>
 </Card>

 {/* Stat grid */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <StatCard
 icon={Users}
 label="Pet Owners Reached"
 value={summary.unique_users_reached.toLocaleString()}
 accent="text-info"
 />
 <StatCard
 icon={Zap}
 label="Total Check-ins"
 value={summary.total_checkins.toLocaleString()}
 accent="text-warning"
 />
 <StatCard
 icon={DollarSign}
 label="Cost per Check-in"
 value={`${Formatters.currency(summary.cost_per_checkin)}`}
 accent="text-success"
 />
 <StatCard
 icon={TrendingDown}
 label="Redemption Rate"
 value={`${Formatters.decimal(summary.redemption_rate_pct, 1)}%`}
 accent="text-accent"
 badge={
 <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
 <Target className="h-2.5 w-2.5 mr-0.5" />
 ROI
 </Badge>
 }
 />
 </div>

 {/* Active campaign indicator */}
 {summary.active_campaigns > 0 && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
 </span>
 {summary.active_campaigns} campaign{summary.active_campaigns === 1 ?"" :"s"} live
 </div>
 )}
 </div>
 );
}

function StatCard({
 icon: Icon,
 label,
 value,
 accent,
 badge,
}: {
 icon: typeof Users;
 label: string;
 value: string;
 accent: string;
 badge?: React.ReactNode;
}) {
 return (
 <Card className="hover:shadow-md transition-shadow">
 <CardContent className="pt-4 pb-3 space-y-1">
 <div className="flex items-center justify-between">
 <Icon className={`h-4 w-4 ${accent}`} />
 {badge}
 </div>
 <p className="text-xs text-muted-foreground">{label}</p>
 <p className="text-xl font-bold tabular-nums">{value}</p>
 </CardContent>
 </Card>
 );
}

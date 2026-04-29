import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Progress } from'@/components/ui/progress';
import { Separator } from'@/components/ui/separator';
import {
 Activity, Zap, Users, Star, TrendingUp, Clock, Repeat, BarChart3,
 ThumbsUp, AlertTriangle, CheckCircle2, ShieldCheck
} from'lucide-react';
import { cn } from'@/lib/utils';

type UnderwritingSignals = {
 tx_frequency_30d: number;
 tx_frequency_90d: number;
 avg_days_between_tx: number;
 redemption_velocity_avg_hours: number;
 redemption_rate_pct: number;
 customer_repeat_rate_pct: number;
 repeat_customers: number;
 one_time_customers: number;
 total_unique_customers: number;
 avg_review_score: number;
 review_count: number;
 five_star_pct: number;
};

function SignalGauge({ label, value, max, unit, icon: Icon, thresholds }: {
 label: string;
 value: number;
 max: number;
 unit: string;
 icon: any;
 thresholds: { good: number; warning: number; direction:'higher' |'lower' };
}) {
 const pct = Math.min((value / max) * 100, 100);
 const isGood = thresholds.direction ==='higher'
 ? value >= thresholds.good
 : value <= thresholds.good;
 const isWarning = thresholds.direction ==='higher'
 ? value >= thresholds.warning && value < thresholds.good
 : value > thresholds.good && value <= thresholds.warning;

 const color = isGood ?'text-success' : isWarning ?'text-warning' :'text-destructive';
 const barColor = isGood ?'[&>div]:bg-success' : isWarning ?'[&>div]:bg-warning' :'[&>div]:bg-destructive';
 const bgColor = isGood ?'bg-success/10' : isWarning ?'bg-warning/10' :'bg-destructive/10';

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className={cn('p-1.5 rounded-lg', bgColor)}>
 <Icon className={cn('w-3.5 h-3.5', color)} />
 </div>
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
 </div>
 <span className={cn('text-lg font-bold', color)}>
 {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}{unit}
 </span>
 </div>
 <Progress value={pct} className={cn('h-1.5', barColor)} />
 </div>
 );
}

function SignalScore({ signals }: { signals: UnderwritingSignals }) {
 let score = 0;
 // Tx frequency (max 25)
 if (signals.tx_frequency_30d >= 10) score += 25;
 else if (signals.tx_frequency_30d >= 5) score += 15;
 else if (signals.tx_frequency_30d >= 2) score += 8;

 // Customer repeat rate (max 25)
 if (signals.customer_repeat_rate_pct >= 40) score += 25;
 else if (signals.customer_repeat_rate_pct >= 20) score += 15;
 else if (signals.customer_repeat_rate_pct >= 10) score += 8;

 // Redemption velocity (max 25) - faster is better
 if (signals.redemption_velocity_avg_hours > 0 && signals.redemption_velocity_avg_hours <= 72) score += 25;
 else if (signals.redemption_velocity_avg_hours <= 168) score += 15;
 else if (signals.redemption_velocity_avg_hours <= 336) score += 8;

 // Review score (max 25)
 if (signals.avg_review_score >= 4.5 && signals.review_count >= 5) score += 25;
 else if (signals.avg_review_score >= 4.0 && signals.review_count >= 3) score += 15;
 else if (signals.avg_review_score >= 3.5) score += 8;

 const label = score >= 75 ?'Strong' : score >= 50 ?'Moderate' : score >= 25 ?'Developing' :'Insufficient';
 const color = score >= 75 ?'text-success' : score >= 50 ?'text-warning' : score >= 25 ?'text-warning' :'text-destructive';
 const bg = score >= 75 ?'bg-success/10 border-success/30/20' : score >= 50 ?'bg-warning/10 border-warning/30/20' : score >= 25 ?'bg-warning/10 border-warning/30/20' :'bg-destructive/10 border-destructive/20';

 return (
 <div className={cn('rounded-xl border p-4 text-center', bg)}>
 <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Underwriting Score</p>
 <p className={cn('text-4xl font-extrabold', color)}>{score}</p>
 <p className={cn('text-sm font-semibold mt-0.5', color)}>{label}</p>
 <p className="text-xs text-muted-foreground mt-1">out of 100</p>
 </div>
 );
}

export function UnderwritingSignalsCard({ merchantId }: { merchantId: string }) {
 const [signals, setSignals] = useState<UnderwritingSignals | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!merchantId) return;
 setLoading(true);
 supabase
 .rpc('get_underwriting_signals', { p_merchant_id: merchantId })
 .then(({ data, error }) => {
 if (!error && data?.[0]) {
 setSignals(data[0] as unknown as UnderwritingSignals);
 }
 setLoading(false);
 });
 }, [merchantId]);

 if (loading) {
 return (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 Loading underwriting signals…
 </CardContent>
 </Card>
 );
 }

 if (!signals) {
 return (
 <Card>
 <CardContent className="py-8 text-center text-muted-foreground">
 No signal data available
 </CardContent>
 </Card>
 );
 }

 return (
 <Card className="border-2 border-primary/20">
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="text-base flex items-center gap-2">
 <ShieldCheck className="w-4 h-4 text-primary" />
 Proprietary Underwriting Signals
 </CardTitle>
 <CardDescription className="mt-0.5">
 Real-time behavioral data powering credit decisions
 </CardDescription>
 </div>
 <Badge variant="outline" className="gap-1 text-primary border-primary/30">
 <Zap className="w-3 h-3" /> Live
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-5">
 {/* Composite Score */}
 <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
 <SignalScore signals={signals} />
 <div className="sm:col-span-4 grid grid-cols-2 gap-3">
 <SignalGauge
 label="30-Day Tx Volume"
 value={signals.tx_frequency_30d}
 max={30}
 unit=" txns"
 icon={Activity}
 thresholds={{ good: 10, warning: 5, direction:'higher' }}
 />
 <SignalGauge
 label="90-Day Tx Volume"
 value={signals.tx_frequency_90d}
 max={100}
 unit=" txns"
 icon={BarChart3}
 thresholds={{ good: 25, warning: 10, direction:'higher' }}
 />
 <SignalGauge
 label="Avg Days Between Tx"
 value={signals.avg_days_between_tx}
 max={30}
 unit=" days"
 icon={Clock}
 thresholds={{ good: 5, warning: 14, direction:'lower' }}
 />
 <SignalGauge
 label="Redemption Velocity"
 value={signals.redemption_velocity_avg_hours}
 max={336}
 unit=" hrs"
 icon={Zap}
 thresholds={{ good: 72, warning: 168, direction:'lower' }}
 />
 </div>
 </div>

 <Separator />

 {/* Customer Retention & Reviews */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 {/* Customer Repeat Rate */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <Repeat className="w-4 h-4 text-primary" />
 <span className="text-sm font-semibold">Customer Retention</span>
 </div>
 <div className="flex items-end gap-3">
 <span className={cn(
"text-3xl font-extrabold",
 signals.customer_repeat_rate_pct >= 40 ?"text-success" :
 signals.customer_repeat_rate_pct >= 20 ?"text-warning" :"text-destructive"
 )}>
 {signals.customer_repeat_rate_pct}%
 </span>
 <span className="text-sm text-muted-foreground mb-1">repeat rate</span>
 </div>
 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="bg-muted/40 rounded-lg p-2">
 <p className="text-lg font-bold">{signals.repeat_customers}</p>
 <p className="text-xs text-muted-foreground">Repeat</p>
 </div>
 <div className="bg-muted/40 rounded-lg p-2">
 <p className="text-lg font-bold">{signals.one_time_customers}</p>
 <p className="text-xs text-muted-foreground">One-time</p>
 </div>
 <div className="bg-muted/40 rounded-lg p-2">
 <p className="text-lg font-bold">{signals.total_unique_customers}</p>
 <p className="text-xs text-muted-foreground">Total</p>
 </div>
 </div>
 <SignalGauge
 label="Redemption Rate"
 value={signals.redemption_rate_pct}
 max={100}
 unit="%"
 icon={TrendingUp}
 thresholds={{ good: 60, warning: 30, direction:'higher' }}
 />
 </div>

 {/* Review Scores */}
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <Star className="w-4 h-4 text-primary" />
 <span className="text-sm font-semibold">Review Quality</span>
 </div>
 <div className="flex items-end gap-3">
 <span className={cn(
"text-3xl font-extrabold",
 signals.avg_review_score >= 4.5 ?"text-success" :
 signals.avg_review_score >= 3.5 ?"text-warning" :"text-destructive"
 )}>
 {signals.avg_review_score > 0 ? signals.avg_review_score.toFixed(1) :'N/A'}
 </span>
 {signals.avg_review_score > 0 && (
 <div className="flex items-center gap-0.5 mb-1.5">
 {[1, 2, 3, 4, 5].map(s => (
 <Star
 key={s}
 className={cn(
"w-3.5 h-3.5",
 s <= Math.round(signals.avg_review_score) ?"text-warning fill-warning" :"text-muted-foreground/30"
 )}
 />
 ))}
 </div>
 )}
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div className="bg-muted/40 rounded-lg p-2 text-center">
 <p className="text-lg font-bold">{signals.review_count}</p>
 <p className="text-xs text-muted-foreground">Total Reviews</p>
 </div>
 <div className="bg-muted/40 rounded-lg p-2 text-center">
 <p className="text-lg font-bold">{signals.five_star_pct}%</p>
 <p className="text-xs text-muted-foreground">5-Star Rate</p>
 </div>
 </div>
 {signals.review_count < 3 && (
 <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 rounded-lg p-2">
 <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
 <span>Low review volume — signal confidence is limited</span>
 </div>
 )}
 {signals.review_count >= 5 && signals.avg_review_score >= 4.5 && (
 <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg p-2">
 <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
 <span>Strong social proof — high customer satisfaction</span>
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 );
}

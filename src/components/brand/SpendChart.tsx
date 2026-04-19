import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import type { BrandCampaignDailyStat } from "@/services/api/brandCampaigns.service";

interface SpendChartProps {
  stats: BrandCampaignDailyStat[];
}

export function SpendChart({ stats }: SpendChartProps) {
  // Aggregate per-day across all campaigns
  const byDate = new Map<string, { date: string; spend: number; checkins: number }>();
  for (const s of stats) {
    const existing = byDate.get(s.date);
    if (existing) {
      existing.spend += Number(s.spend_usd || 0);
      existing.checkins += Number(s.checkins || 0);
    } else {
      byDate.set(s.date, { date: s.date, spend: Number(s.spend_usd || 0), checkins: Number(s.checkins || 0) });
    }
  }
  const data = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalSpend = data.reduce((s, d) => s + d.spend, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Spend Over Time
            </CardTitle>
            <CardDescription>Daily PawBucks spend across all campaigns</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            <p className="text-lg font-bold tabular-nums">${totalSpend.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No spend data yet — launch a campaign to start tracking
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                formatter={(value: number, name: string) =>
                  name === "spend" ? [`$${value.toFixed(2)}`, "Spend"] : [value, "Check-ins"]
                }
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#spendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

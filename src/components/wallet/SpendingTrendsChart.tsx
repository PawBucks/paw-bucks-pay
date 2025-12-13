import { memo, useMemo } from "react";
import { GradientCard } from "@/components/ui/gradient-card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays, subWeeks, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Transaction = {
  id: string;
  amount: number;
  created_at: string;
};

type SpendingTrendsChartProps = {
  transactions: Transaction[];
};

export const SpendingTrendsChart = memo(({ transactions }: SpendingTrendsChartProps) => {
  // Calculate daily spending (last 7 days)
  const dailyData = useMemo(() => {
    const data: { day: string; amount: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const dayTotal = transactions
        .filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate >= dayStart && txDate <= dayEnd;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      data.push({
        day: format(date, 'EEE'),
        amount: dayTotal,
      });
    }

    return data;
  }, [transactions]);

  // Calculate weekly spending (last 4 weeks)
  const weeklyData = useMemo(() => {
    const data: { week: string; amount: number }[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekDate = subWeeks(now, i);
      const weekStart = startOfWeek(weekDate);
      const weekEnd = endOfWeek(weekDate);

      const weekTotal = transactions
        .filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate >= weekStart && txDate <= weekEnd;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      data.push({
        week: `Week ${4 - i}`,
        amount: weekTotal,
      });
    }

    return data;
  }, [transactions]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    padding: '8px 12px',
  };

  const hasData = transactions.length > 0;

  return (
    <GradientCard>
      <h3 className="text-xl font-semibold mb-4">Spending Trends</h3>
      
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="daily">Daily (7 Days)</TabsTrigger>
          <TabsTrigger value="weekly">Weekly (4 Weeks)</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          {hasData ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                    width={50}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spent']}
                    contentStyle={tooltipStyle}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fill="url(#colorDaily)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No spending data yet
            </div>
          )}
        </TabsContent>

        <TabsContent value="weekly">
          {hasData ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis 
                    dataKey="week" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                    width={50}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spent']}
                    contentStyle={tooltipStyle}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No spending data yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </GradientCard>
  );
});

SpendingTrendsChart.displayName = "SpendingTrendsChart";

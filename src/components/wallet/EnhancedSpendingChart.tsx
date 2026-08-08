import { memo, useMemo, useState } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { 
 AreaChart, 
 Area, 
 XAxis, 
 YAxis, 
 Tooltip, 
 ResponsiveContainer, 
 BarChart, 
 Bar,
 CartesianGrid,
 ReferenceLine,
 ComposedChart,
 Line
} from"recharts";
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth } from"date-fns";

import { Formatters } from "@/utils/formatters";
import { parseDateOnly } from "@/lib/timezone";
type Transaction = {
 id: string;
 amount: number;
 created_at: string;
};

type MedicalRecord = {
 id: string;
 price: number | null;
 record_date: string;
};

type EnhancedSpendingChartProps = {
 transactions: Transaction[];
 medicalRecords?: MedicalRecord[];
};

export const EnhancedSpendingChart = memo(({ transactions, medicalRecords = [] }: EnhancedSpendingChartProps) => {
 const [chartType, setChartType] = useState<'area' |'bar'>('area');

 // Calculate daily spending (last 14 days)
 const dailyData = useMemo(() => {
 const data: { day: string; fullDate: string; amount: number; avg: number }[] = [];
 const now = new Date();
 let total = 0;

 for (let i = 13; i >= 0; i--) {
 const date = subDays(now, i);
 const dayStart = startOfDay(date);
 const dayEnd = endOfDay(date);

 const dayTransactions = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= dayStart && txDate <= dayEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const dayMedical = medicalRecords
 .filter(record => {
 const recordDate = (parseDateOnly(record.record_date) as Date);
 return recordDate >= dayStart && recordDate <= dayEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 const amount = dayTransactions + dayMedical;
 total += amount;

 data.push({
 day: format(date,'EEE'),
 fullDate: format(date,'MMM d'),
 amount,
 avg: total / (14 - i),
 });
 }

 return data;
 }, [transactions, medicalRecords]);

 // Calculate weekly spending (last 8 weeks)
 const weeklyData = useMemo(() => {
 const data: { week: string; fullWeek: string; amount: number; change: number }[] = [];
 const now = new Date();
 let previousAmount = 0;

 for (let i = 7; i >= 0; i--) {
 const weekDate = subWeeks(now, i);
 const weekStart = startOfWeek(weekDate);
 const weekEnd = endOfWeek(weekDate);

 const weekTransactions = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= weekStart && txDate <= weekEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const weekMedical = medicalRecords
 .filter(record => {
 const recordDate = (parseDateOnly(record.record_date) as Date);
 return recordDate >= weekStart && recordDate <= weekEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 const amount = weekTransactions + weekMedical;
 const change = previousAmount > 0 ? ((amount - previousAmount) / previousAmount) * 100 : 0;
 previousAmount = amount;

 data.push({
 week: `W${8 - i}`,
 fullWeek: `${format(weekStart,'MMM d')} - ${format(weekEnd,'MMM d')}`,
 amount,
 change,
 });
 }

 return data;
 }, [transactions, medicalRecords]);

 // Calculate monthly spending (last 6 months) with comparison
 const monthlyData = useMemo(() => {
 const data: { month: string; fullMonth: string; amount: number; prevYear: number }[] = [];
 const now = new Date();

 for (let i = 5; i >= 0; i--) {
 const monthDate = subMonths(now, i);
 const monthStart = startOfMonth(monthDate);
 const monthEnd = endOfMonth(monthDate);

 // Current year
 const monthTransactions = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= monthStart && txDate <= monthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const monthMedical = medicalRecords
 .filter(record => {
 const recordDate = (parseDateOnly(record.record_date) as Date);
 return recordDate >= monthStart && recordDate <= monthEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 // Previous year (same month)
 const prevYearStart = startOfMonth(subMonths(monthDate, 12));
 const prevYearEnd = endOfMonth(subMonths(monthDate, 12));

 const prevYearTx = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= prevYearStart && txDate <= prevYearEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const prevYearMed = medicalRecords
 .filter(record => {
 const recordDate = (parseDateOnly(record.record_date) as Date);
 return recordDate >= prevYearStart && recordDate <= prevYearEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 data.push({
 month: format(monthDate,'MMM'),
 fullMonth: format(monthDate,'MMMM yyyy'),
 amount: monthTransactions + monthMedical,
 prevYear: prevYearTx + prevYearMed,
 });
 }

 return data;
 }, [transactions, medicalRecords]);

 // Calculate averages for reference lines
 const dailyAvg = useMemo(() => 
 dailyData.reduce((sum, d) => sum + d.amount, 0) / dailyData.length,
 [dailyData]
 );

 const weeklyAvg = useMemo(() => 
 weeklyData.reduce((sum, d) => sum + d.amount, 0) / weeklyData.length,
 [weeklyData]
 );

 const monthlyAvg = useMemo(() => 
 monthlyData.reduce((sum, d) => sum + d.amount, 0) / monthlyData.length,
 [monthlyData]
 );

 // Calculate trends
 const weeklyTrend = useMemo(() => {
 if (weeklyData.length < 2) return 0;
 const recent = weeklyData.slice(-2);
 return recent[0].amount > 0 
 ? ((recent[1].amount - recent[0].amount) / recent[0].amount) * 100 
 : 0;
 }, [weeklyData]);

 const hasData = transactions.length > 0 || medicalRecords.length > 0;

 const tooltipStyle = {
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 padding:'12px',
 boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
 };

 const CustomTooltip = ({ active, payload, label }: any) => {
 if (active && payload && payload.length) {
 return (
 <div style={tooltipStyle}>
 <p className="font-medium text-sm mb-1">{payload[0]?.payload?.fullDate || payload[0]?.payload?.fullWeek || payload[0]?.payload?.fullMonth || label}</p>
 {payload.map((p: any, idx: number) => (
 <p key={idx} className="text-sm" style={{ color: p.color }}>
 {p.name}: {Formatters.currency(p.value)}
 </p>
 ))}
 </div>
 );
 }
 return null;
 };

 return (
 <GradientCard>
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-xl font-semibold">Spending Trends</h3>
 <p className="text-xs text-muted-foreground">Visualize your spending patterns</p>
 </div>
 <div className="flex items-center gap-2">
 {weeklyTrend !== 0 && (
 <Badge 
 variant={weeklyTrend < 0 ?"default" :"destructive"}
 className="gap-1"
 >
 {weeklyTrend < 0 ? (
 <span className="w-3 h-3" aria-hidden="true">📉</span>
 ) : (
 <span className="w-3 h-3" aria-hidden="true">📈</span>
 )}
 {Formatters.number(Math.round(Math.abs(weeklyTrend)))}%
 </Badge>
 )}
 <div className="flex border rounded-md overflow-hidden">
 <button
 onClick={() => setChartType('area')}
 className={`p-1.5 ${chartType ==='area' ?'bg-primary/20' :'bg-muted'}`}
 >
 <span className="w-4 h-4" aria-hidden="true">📈</span>
 </button>
 <button
 onClick={() => setChartType('bar')}
 className={`p-1.5 ${chartType ==='bar' ?'bg-primary/20' :'bg-muted'}`}
 >
 <span className="w-4 h-4" aria-hidden="true">📊</span>
 </button>
 </div>
 </div>
 </div>
 
 <Tabs defaultValue="daily" className="w-full">
 <TabsList className="grid w-full grid-cols-3 mb-4">
 <TabsTrigger value="daily">14 Days</TabsTrigger>
 <TabsTrigger value="weekly">8 Weeks</TabsTrigger>
 <TabsTrigger value="monthly">6 Months</TabsTrigger>
 </TabsList>

 <TabsContent value="daily">
 {hasData ? (
 <div className="h-56">
 <ResponsiveContainer width="100%" height="100%">
 {chartType ==='area' ? (
 <AreaChart data={dailyData}>
 <defs>
 <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
 <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
 <XAxis 
 dataKey="day" 
 axisLine={false}
 tickLine={false}
 tick={{ fill:'hsl(var(--muted-foreground))', fontSize: 11 }}
 />
 <YAxis 
 axisLine={false}
 tickLine={false}
 tick={{ fill:'hsl(var(--muted-foreground))', fontSize: 11 }}
 tickFormatter={(value) => `$${value}`}
 width={45}
 />
 <ReferenceLine y={dailyAvg} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
 <Tooltip content={<CustomTooltip />} />
 <Area 
 type="monotone" 
 dataKey="amount" 
 name="Spent"
 stroke="hsl(var(--primary))" 
 strokeWidth={2}
 fill="url(#colorDaily)" 
 />
 </AreaChart>
 ) : (
 <BarChart data={dailyData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={45} />
 <ReferenceLine y={dailyAvg} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
 <Tooltip content={<CustomTooltip />} />
 <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 </BarChart>
 )}
 </ResponsiveContainer>
 <p className="text-xs text-muted-foreground text-center mt-2">
 Daily average: {Formatters.currency(dailyAvg)}
 </p>
 </div>
 ) : (
 <div className="h-56 flex items-center justify-center text-muted-foreground">
 No spending data yet
 </div>
 )}
 </TabsContent>

 <TabsContent value="weekly">
 {hasData ? (
 <div className="h-56">
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={weeklyData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
 <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={45} />
 <ReferenceLine y={weeklyAvg} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
 <Tooltip content={<CustomTooltip />} />
 <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
 </ComposedChart>
 </ResponsiveContainer>
 <p className="text-xs text-muted-foreground text-center mt-2">
 Weekly average: {Formatters.currency(weeklyAvg)}
 </p>
 </div>
 ) : (
 <div className="h-56 flex items-center justify-center text-muted-foreground">
 No spending data yet
 </div>
 )}
 </TabsContent>

 <TabsContent value="monthly">
 {hasData ? (
 <div className="h-56">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={45} />
 <ReferenceLine y={monthlyAvg} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
 <Tooltip content={<CustomTooltip />} />
 <Bar dataKey="amount" name="This Year" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 <Bar dataKey="prevYear" name="Last Year" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} opacity={0.5} />
 </BarChart>
 </ResponsiveContainer>
 <p className="text-xs text-muted-foreground text-center mt-2">
 Monthly average: {Formatters.currency(monthlyAvg)} • Dashed line = average
 </p>
 </div>
 ) : (
 <div className="h-56 flex items-center justify-center text-muted-foreground">
 No spending data yet
 </div>
 )}
 </TabsContent>
 </Tabs>
 </GradientCard>
 );
});

EnhancedSpendingChart.displayName ="EnhancedSpendingChart";

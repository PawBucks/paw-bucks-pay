import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
 PieChart,
 Pie,
 Cell,
 Legend,
} from"recharts";

type MonthlySalesData = {
 month: string;
 amount: number;
};

type CashbackDistributionData = {
 name: string;
 value: number;
 color: string;
};

type MerchantChartsProps = {
 monthlySalesData: MonthlySalesData[];
 cashbackDistribution: CashbackDistributionData[];
};

const MerchantChartsComponent = ({
 monthlySalesData,
 cashbackDistribution,
}: MerchantChartsProps) => {
 const tooltipStyle = useMemo(() => ({
 backgroundColor:"hsl(var(--card))",
 border:"1px solid hsl(var(--border))",
 borderRadius:"8px",
 }), []);

 const barFormatter = useMemo(() => (value: number) => [`$${value.toFixed(2)}`,"Sales"], []);
 const pieFormatter = useMemo(() => (value: number) => `$${value.toFixed(2)}`, []);
 const yAxisFormatter = useMemo(() => (value: number) => `$${value}`, []);
 return (
 <div className="grid gap-6 md:grid-cols-2 mb-8">
 {/* Monthly Sales Chart */}
 <GradientCard>
 <h3 className="text-xl font-semibold mb-4">Monthly Sales Overview</h3>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={monthlySalesData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis
 dataKey="month"
 className="text-sm"
 tick={{ fill:"hsl(var(--muted-foreground))" }}
 />
 <YAxis
 className="text-sm"
 tick={{ fill:"hsl(var(--muted-foreground))" }}
 tickFormatter={yAxisFormatter}
 />
 <Tooltip
 contentStyle={tooltipStyle}
 formatter={barFormatter}
 />
 <Bar dataKey="amount" fill="hsl(var(--chart-6))" radius={[8, 8, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </GradientCard>

 {/* Rewards Distribution Chart */}
 <GradientCard>
 <h3 className="text-xl font-semibold mb-4">Rewards vs Balance Distribution</h3>
 {cashbackDistribution.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={cashbackDistribution}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={5}
 dataKey="value"
 >
 {cashbackDistribution.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip
 formatter={pieFormatter}
 contentStyle={tooltipStyle}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-[300px] flex items-center justify-center text-muted-foreground">
 No data available
 </div>
 )}
 </GradientCard>
 </div>
 );
};

export const MerchantCharts = memo(MerchantChartsComponent);

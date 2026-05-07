import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Target, Calendar, ArrowRight } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { startOfMonth, endOfMonth, subMonths, differenceInDays, format } from"date-fns";
import { CATEGORY_CONFIG, getNormalizedCategory } from"@/lib/categoryMapping";

import { Formatters } from "@/utils/formatters";
type Transaction = {
 id: string;
 amount: number;
 created_at: string;
 merchants?: {
 business_type: string;
 business_name: string;
 } | null;
};

type MedicalRecord = {
 id: string;
 price: number | null;
 record_date: string;
};

type BudgetSetting = {
 category: string;
 monthly_limit: number;
 alert_threshold: number;
};

type SpendingInsightsProps = {
 transactions: Transaction[];
 medicalRecords?: MedicalRecord[];
 budgets?: BudgetSetting[];
};

type Insight = {
 id: string;
 type:'tip' |'warning' |'achievement' |'anomaly' |'trend';
 icon: typeof Lightbulb;
 title: string;
 description: string;
 category?: string;
 priority: number;
};

export const SpendingInsights = memo(({ 
 transactions, 
 medicalRecords = [],
 budgets = []
}: SpendingInsightsProps) => {
 const insights = useMemo(() => {
 const now = new Date();
 const thisMonthStart = startOfMonth(now);
 const thisMonthEnd = endOfMonth(now);
 const lastMonthStart = startOfMonth(subMonths(now, 1));
 const lastMonthEnd = endOfMonth(subMonths(now, 1));
 const twoMonthsAgoStart = startOfMonth(subMonths(now, 2));
 const twoMonthsAgoEnd = endOfMonth(subMonths(now, 2));

 const allInsights: Insight[] = [];

 // Helper: Get spending for date range
 const getSpending = (start: Date, end: Date) => {
 const txTotal = transactions
 .filter(tx => {
 const d = new Date(tx.created_at);
 return d >= start && d <= end;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);
 
 const medTotal = medicalRecords
 .filter(r => {
 const d = new Date(r.record_date);
 return d >= start && d <= end;
 })
 .reduce((sum, r) => sum + (r.price || 0), 0);
 
 return txTotal + medTotal;
 };

 // Helper: Get category spending
 const getCategorySpending = (start: Date, end: Date) => {
 const spending: Record<string, number> = {};
 
 transactions
 .filter(tx => {
 const d = new Date(tx.created_at);
 return d >= start && d <= end;
 })
 .forEach(tx => {
 const cat = getNormalizedCategory(tx.merchants?.business_type);
 spending[cat] = (spending[cat] || 0) + tx.amount;
 });

 const medTotal = medicalRecords
 .filter(r => {
 const d = new Date(r.record_date);
 return d >= start && d <= end;
 })
 .reduce((sum, r) => sum + (r.price || 0), 0);
 
 if (medTotal > 0) {
 spending['veterinary'] = (spending['veterinary'] || 0) + medTotal;
 }

 return spending;
 };

 const thisMonthSpending = getSpending(thisMonthStart, thisMonthEnd);
 const lastMonthSpending = getSpending(lastMonthStart, lastMonthEnd);
 const twoMonthsAgoSpending = getSpending(twoMonthsAgoStart, twoMonthsAgoEnd);

 const thisMonthByCategory = getCategorySpending(thisMonthStart, thisMonthEnd);
 const lastMonthByCategory = getCategorySpending(lastMonthStart, lastMonthEnd);

 // Days elapsed in current month
 const daysElapsed = differenceInDays(now, thisMonthStart) + 1;
 const totalDaysInMonth = differenceInDays(thisMonthEnd, thisMonthStart) + 1;
 const projectedSpending = (thisMonthSpending / daysElapsed) * totalDaysInMonth;

 // 1. Projected overspend warning
 if (projectedSpending > lastMonthSpending * 1.2 && daysElapsed >= 7 && lastMonthSpending > 0) {
 const percentageIncrease = ((projectedSpending / lastMonthSpending - 1) * 100);
 allInsights.push({
 id:'projected-overspend',
 type:'warning',
 icon: AlertTriangle,
 title:'Spending Pace Alert',
 description: `At this rate, you'll spend $${Formatters.number(Math.round(projectedSpending))} this month — ${Formatters.number(Math.round(percentageIncrease))}% more than last month.`,
 priority: 10
 });
 }

 // 2. Spending reduction achievement
 if (lastMonthSpending > 0 && thisMonthSpending < lastMonthSpending * 0.8 && daysElapsed > 14) {
 allInsights.push({
 id:'spending-down',
 type:'achievement',
 icon: Sparkles,
 title:'Great Progress!',
 description: `You've spent ${Formatters.number(Math.round((100 - (thisMonthSpending / lastMonthSpending * 100))))}% less than last month so far. Keep it up!`,
 priority: 8
 });
 }

 // 3. Consistent spending trend (3 months)
 if (twoMonthsAgoSpending > 0 && lastMonthSpending > 0) {
 const trend = (thisMonthSpending + lastMonthSpending + twoMonthsAgoSpending) / 3;
 const variance = Math.abs(thisMonthSpending - trend) / trend;
 
 if (variance < 0.15) {
 allInsights.push({
 id:'consistent-spending',
 type:'tip',
 icon: Target,
 title:'Consistent Spender',
 description: `Your monthly spending stays around $${Formatters.number(Math.round(trend))}. Consider setting this as your monthly budget target.`,
 priority: 5
 });
 }
 }

 // 4. Category-specific anomalies
 Object.entries(thisMonthByCategory).forEach(([category, amount]) => {
 const lastMonth = lastMonthByCategory[category] || 0;
 
 if (lastMonth > 0 && amount > lastMonth * 2 && amount > 50) {
 const catLabel = CATEGORY_CONFIG[category]?.label || category;
 allInsights.push({
 id: `anomaly-${category}`,
 type:'anomaly',
 icon: TrendingUp,
 title: `${catLabel} Spike Detected`,
 description: `${catLabel} spending is ${Formatters.number(Math.round(((amount / lastMonth - 1) * 100)))}% higher than last month.`,
 category,
 priority: 9
 });
 }
 });

 // 5. Budget projection warnings
 budgets.forEach(budget => {
 const spent = thisMonthByCategory[budget.category] || 0;
 const percentage = (spent / budget.monthly_limit) * 100;
 const projectedPct = (percentage / daysElapsed) * totalDaysInMonth;
 
 if (projectedPct > 100 && percentage < 100 && daysElapsed >= 7) {
 const catLabel = CATEGORY_CONFIG[budget.category]?.label || budget.category;
 allInsights.push({
 id: `budget-projection-${budget.category}`,
 type:'warning',
 icon: Calendar,
 title: `${catLabel} Budget at Risk`,
 description: `You're on track to exceed your $${budget.monthly_limit} budget by ~$${Formatters.number(Math.round(((projectedPct / 100 - 1) * budget.monthly_limit)))}.`,
 category: budget.category,
 priority: 9
 });
 }
 });

 // 6. Savings tips based on spending patterns
 const topCategory = Object.entries(thisMonthByCategory)
 .sort((a, b) => b[1] - a[1])[0];
 
 if (topCategory && topCategory[1] > thisMonthSpending * 0.4) {
 const catLabel = CATEGORY_CONFIG[topCategory[0]]?.label || topCategory[0];
 allInsights.push({
 id:'top-category-tip',
 type:'tip',
 icon: Lightbulb,
 title: `${catLabel} is Your Top Expense`,
 description: `${Formatters.number(Math.round(((topCategory[1] / thisMonthSpending) * 100)))}% of your spending goes to ${catLabel}. Look for deals or consider bundling services.`,
 category: topCategory[0],
 priority: 6
 });
 }

 // 7. Trending down achievement
 if (thisMonthSpending < lastMonthSpending && lastMonthSpending < twoMonthsAgoSpending && twoMonthsAgoSpending > 0) {
 allInsights.push({
 id:'trending-down',
 type:'achievement',
 icon: TrendingDown,
 title:'Spending Trend: Down',
 description:'Your spending has decreased for 3 consecutive months. Excellent financial discipline!',
 priority: 7
 });
 }

 // Sort by priority
 return allInsights.sort((a, b) => b.priority - a.priority).slice(0, 4);
 }, [transactions, medicalRecords, budgets]);

 if (insights.length === 0) {
 return null;
 }

 const getInsightStyles = (type: Insight['type']) => {
 switch (type) {
 case'warning':
 return'border-l-destructive bg-destructive/5';
 case'achievement':
 return'border-l-accent bg-accent/5';
 case'anomaly':
 return'border-l-chart-4 bg-chart-4/5';
 case'trend':
 return'border-l-primary bg-primary/5';
 default:
 return'border-l-chart-2 bg-chart-2/5';
 }
 };

 const getIconColor = (type: Insight['type']) => {
 switch (type) {
 case'warning':
 return'text-destructive';
 case'achievement':
 return'text-accent';
 case'anomaly':
 return'text-chart-4';
 case'trend':
 return'text-primary';
 default:
 return'text-chart-2';
 }
 };

 const getBadgeVariant = (type: Insight['type']) => {
 switch (type) {
 case'warning':
 return'destructive' as const;
 case'achievement':
 return'default' as const;
 default:
 return'secondary' as const;
 }
 };

 return (
 <GradientCard>
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
 <Lightbulb className="w-4 h-4 text-primary" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Smart Insights</h3>
 <p className="text-xs text-muted-foreground">AI-powered spending analysis</p>
 </div>
 </div>

 <div className="space-y-3">
 {insights.map((insight) => {
 const Icon = insight.icon;
 return (
 <div
 key={insight.id}
 className={`p-4 rounded-lg border-l-4 ${getInsightStyles(insight.type)} transition-all hover:scale-[1.01]`}
 >
 <div className="flex items-start gap-3">
 <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getIconColor(insight.type)}`} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <h4 className="font-medium text-sm">{insight.title}</h4>
 <Badge variant={getBadgeVariant(insight.type)} className="text-[10px] px-1.5 py-0">
 {insight.type ==='achievement' ?'Achievement' : 
 insight.type ==='warning' ?'Alert' : 
 insight.type ==='anomaly' ?'Unusual' :'Tip'}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">{insight.description}</p>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </GradientCard>
 );
});

SpendingInsights.displayName ="SpendingInsights";

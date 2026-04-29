import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { RefreshCw, Calendar, DollarSign, TrendingUp } from"lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from"date-fns";
import { CATEGORY_CONFIG, getNormalizedCategory } from"@/lib/categoryMapping";

type Transaction = {
 id: string;
 amount: number;
 created_at: string;
 merchants?: {
 business_type: string;
 business_name: string;
 } | null;
};

type RecurringExpensesProps = {
 transactions: Transaction[];
};

type RecurringPattern = {
 merchantName: string;
 category: string;
 frequency:'weekly' |'monthly' |'quarterly';
 averageAmount: number;
 lastTransaction: string;
 occurrences: number;
 totalSpent: number;
};

export const RecurringExpenses = memo(({ transactions }: RecurringExpensesProps) => {
 const patterns = useMemo(() => {
 // Group transactions by merchant
 const merchantGroups: Record<string, {
 transactions: typeof transactions;
 category: string;
 }> = {};

 transactions.forEach(tx => {
 const name = tx.merchants?.business_name ||'Unknown';
 if (!merchantGroups[name]) {
 merchantGroups[name] = {
 transactions: [],
 category: getNormalizedCategory(tx.merchants?.business_type)
 };
 }
 merchantGroups[name].transactions.push(tx);
 });

 const recurringPatterns: RecurringPattern[] = [];

 Object.entries(merchantGroups).forEach(([merchantName, data]) => {
 const txs = data.transactions.sort((a, b) => 
 new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
 );

 if (txs.length < 2) return;

 // Calculate intervals between transactions
 const intervals: number[] = [];
 for (let i = 1; i < txs.length; i++) {
 const days = differenceInDays(
 new Date(txs[i].created_at),
 new Date(txs[i - 1].created_at)
 );
 intervals.push(days);
 }

 if (intervals.length === 0) return;

 const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
 const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
 const stdDev = Math.sqrt(variance);

 // Only consider patterns with consistent intervals (low standard deviation)
 const isConsistent = stdDev < avgInterval * 0.5;
 
 if (!isConsistent && txs.length < 4) return;

 let frequency: RecurringPattern['frequency'] | null = null;
 
 if (avgInterval <= 10) {
 frequency ='weekly';
 } else if (avgInterval <= 45) {
 frequency ='monthly';
 } else if (avgInterval <= 120) {
 frequency ='quarterly';
 }

 if (frequency) {
 const amounts = txs.map(t => t.amount);
 const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

 recurringPatterns.push({
 merchantName,
 category: data.category,
 frequency,
 averageAmount: avgAmount,
 lastTransaction: txs[txs.length - 1].created_at,
 occurrences: txs.length,
 totalSpent: amounts.reduce((a, b) => a + b, 0)
 });
 }
 });

 // Sort by total spent
 return recurringPatterns.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
 }, [transactions]);

 // Calculate monthly recurring total
 const monthlyRecurring = useMemo(() => {
 return patterns.reduce((total, p) => {
 switch (p.frequency) {
 case'weekly':
 return total + (p.averageAmount * 4.33);
 case'monthly':
 return total + p.averageAmount;
 case'quarterly':
 return total + (p.averageAmount / 3);
 default:
 return total;
 }
 }, 0);
 }, [patterns]);

 if (patterns.length === 0) {
 return null;
 }

 const getFrequencyLabel = (freq: RecurringPattern['frequency']) => {
 switch (freq) {
 case'weekly':
 return'Weekly';
 case'monthly':
 return'Monthly';
 case'quarterly':
 return'Quarterly';
 }
 };

 const getFrequencyColor = (freq: RecurringPattern['frequency']) => {
 switch (freq) {
 case'weekly':
 return'bg-chart-1/10 text-chart-1';
 case'monthly':
 return'bg-chart-2/10 text-chart-2';
 case'quarterly':
 return'bg-chart-3/10 text-chart-3';
 }
 };

 return (
 <GradientCard>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-chart-2/10 flex items-center justify-center">
 <RefreshCw className="w-4 h-4 text-chart-2" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Recurring Expenses</h3>
 <p className="text-xs text-muted-foreground">Detected spending patterns</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm text-muted-foreground">Est. Monthly</p>
 <p className="text-lg font-bold text-primary">${monthlyRecurring.toFixed(0)}</p>
 </div>
 </div>

 <div className="space-y-3">
 {patterns.map((pattern, idx) => {
 const catConfig = CATEGORY_CONFIG[pattern.category];
 const Icon = catConfig?.icon;
 
 return (
 <div
 key={`${pattern.merchantName}-${idx}`}
 className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-3">
 {Icon && (
 <div 
 className="w-9 h-9 rounded-full flex items-center justify-center"
 style={{ backgroundColor: `${catConfig.color}15` }}
 >
 <Icon className="w-4 h-4" style={{ color: catConfig.color }} />
 </div>
 )}
 <div>
 <p className="font-medium text-sm truncate max-w-[140px] sm:max-w-none">
 {pattern.merchantName}
 </p>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span>{pattern.occurrences} visits</span>
 <span>•</span>
 <span>Last: {format(new Date(pattern.lastTransaction),'MMM d')}</span>
 </div>
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-1">
 <Badge variant="outline" className={`text-[10px] ${getFrequencyColor(pattern.frequency)}`}>
 {getFrequencyLabel(pattern.frequency)}
 </Badge>
 <p className="font-semibold text-sm">${pattern.averageAmount.toFixed(0)}/visit</p>
 </div>
 </div>
 );
 })}
 </div>

 {/* Yearly projection */}
 <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-chart-2/10 border border-primary/20">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-primary" />
 <span className="text-sm font-medium">Yearly Projection</span>
 </div>
 <span className="text-lg font-bold">${(monthlyRecurring * 12).toFixed(0)}</span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Based on your recurring spending patterns
 </p>
 </div>
 </GradientCard>
 );
});

RecurringExpenses.displayName ="RecurringExpenses";

import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Minus } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths } from"date-fns";

import { Formatters } from "@/utils/formatters";
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

type MonthlyComparisonProps = {
 transactions: Transaction[];
 medicalRecords?: MedicalRecord[];
};

export const MonthlyComparison = memo(({ transactions, medicalRecords = [] }: MonthlyComparisonProps) => {
 const comparison = useMemo(() => {
 const now = new Date();
 const thisMonthStart = startOfMonth(now);
 const thisMonthEnd = endOfMonth(now);
 const lastMonthStart = startOfMonth(subMonths(now, 1));
 const lastMonthEnd = endOfMonth(subMonths(now, 1));

 // Calculate transaction totals
 const thisMonthTransactions = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= thisMonthStart && txDate <= thisMonthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const lastMonthTransactions = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= lastMonthStart && txDate <= lastMonthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 // Calculate medical record totals
 const thisMonthMedical = medicalRecords
 .filter(record => {
 const recordDate = new Date(record.record_date);
 return recordDate >= thisMonthStart && recordDate <= thisMonthEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 const lastMonthMedical = medicalRecords
 .filter(record => {
 const recordDate = new Date(record.record_date);
 return recordDate >= lastMonthStart && recordDate <= lastMonthEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 // Combine totals
 const thisMonthTotal = thisMonthTransactions + thisMonthMedical;
 const lastMonthTotal = lastMonthTransactions + lastMonthMedical;

 const difference = thisMonthTotal - lastMonthTotal;
 const percentageChange = lastMonthTotal > 0 
 ? ((difference / lastMonthTotal) * 100) 
 : (thisMonthTotal > 0 ? 100 : 0);

 return {
 thisMonth: thisMonthTotal,
 lastMonth: lastMonthTotal,
 difference,
 percentageChange,
 };
 }, [transactions, medicalRecords]);

 const getTrendIcon = () => {
 if (comparison.percentageChange > 5) {
 return <span className="w-5 h-5 text-destructive" aria-hidden="true">📈</span>;
 } else if (comparison.percentageChange < -5) {
 return <span className="w-5 h-5 text-accent" aria-hidden="true">📉</span>;
 }
 return <Minus className="w-5 h-5 text-muted-foreground" />;
 };

 const getTrendColor = () => {
 if (comparison.percentageChange > 5) return"text-destructive";
 if (comparison.percentageChange < -5) return"text-accent";
 return"text-muted-foreground";
 };

 const getTrendBg = () => {
 if (comparison.percentageChange > 5) return"bg-destructive/10";
 if (comparison.percentageChange < -5) return"bg-accent/10";
 return"bg-muted";
 };

 return (
 <GradientCard>
 <h3 className="text-lg font-semibold mb-4">Month-over-Month</h3>
 
 <div className="grid grid-cols-2 gap-4 mb-4">
 <div className="p-4 rounded-md bg-muted/30 border border-border/50">
 <p className="text-xs text-muted-foreground mb-1">This Month</p>
 <p className="text-xl font-bold">{Formatters.currency(comparison.thisMonth)}</p>
 </div>
 <div className="p-4 rounded-md bg-muted/30 border border-border/50">
 <p className="text-xs text-muted-foreground mb-1">Last Month</p>
 <p className="text-xl font-bold">{Formatters.currency(comparison.lastMonth)}</p>
 </div>
 </div>

 <div className={`flex items-center justify-between p-4 rounded-md ${getTrendBg()}`}>
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTrendBg()}`}>
 {getTrendIcon()}
 </div>
 <div>
 <p className="text-sm font-medium">
 {comparison.percentageChange > 0 ?'Spending Up' : comparison.percentageChange < 0 ?'Spending Down' :'No Change'}
 </p>
 <p className="text-xs text-muted-foreground">
 Compared to last month
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`text-xl font-bold ${getTrendColor()}`}>
 {comparison.percentageChange > 0 ?'+' :''}{Formatters.decimal(comparison.percentageChange, 1)}%
 </p>
 <p className="text-xs text-muted-foreground">
 {comparison.difference >= 0 ?'+' :''}{Formatters.currency(comparison.difference)}
 </p>
 </div>
 </div>
 </GradientCard>
 );
});

MonthlyComparison.displayName ="MonthlyComparison";
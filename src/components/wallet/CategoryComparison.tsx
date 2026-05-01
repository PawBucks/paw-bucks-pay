import { memo, useMemo } from"react";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { ArrowUp, ArrowDown, Minus, BarChart2 } from"lucide-react";
import { startOfMonth, endOfMonth, subMonths } from"date-fns";
import { CATEGORY_CONFIG, getNormalizedCategory } from"@/lib/categoryMapping";

import { Formatters } from "@/utils/formatters";
type Transaction = {
 id: string;
 amount: number;
 created_at: string;
 merchants?: {
 business_type: string;
 } | null;
};

type MedicalRecord = {
 id: string;
 price: number | null;
 record_date: string;
};

type CategoryComparisonProps = {
 transactions: Transaction[];
 medicalRecords?: MedicalRecord[];
};

type CategoryData = {
 category: string;
 label: string;
 thisMonth: number;
 lastMonth: number;
 change: number;
 color: string;
 icon: any;
};

export const CategoryComparison = memo(({ transactions, medicalRecords = [] }: CategoryComparisonProps) => {
 const comparisonData = useMemo(() => {
 const now = new Date();
 const thisMonthStart = startOfMonth(now);
 const thisMonthEnd = endOfMonth(now);
 const lastMonthStart = startOfMonth(subMonths(now, 1));
 const lastMonthEnd = endOfMonth(subMonths(now, 1));

 const thisMonthByCategory: Record<string, number> = {};
 const lastMonthByCategory: Record<string, number> = {};

 // Process transactions
 transactions.forEach(tx => {
 const cat = getNormalizedCategory(tx.merchants?.business_type);
 const txDate = new Date(tx.created_at);

 if (txDate >= thisMonthStart && txDate <= thisMonthEnd) {
 thisMonthByCategory[cat] = (thisMonthByCategory[cat] || 0) + tx.amount;
 } else if (txDate >= lastMonthStart && txDate <= lastMonthEnd) {
 lastMonthByCategory[cat] = (lastMonthByCategory[cat] || 0) + tx.amount;
 }
 });

 // Process medical records as veterinary
 medicalRecords.forEach(record => {
 const recordDate = new Date(record.record_date);
 const amount = record.price || 0;

 if (recordDate >= thisMonthStart && recordDate <= thisMonthEnd) {
 thisMonthByCategory['veterinary'] = (thisMonthByCategory['veterinary'] || 0) + amount;
 } else if (recordDate >= lastMonthStart && recordDate <= lastMonthEnd) {
 lastMonthByCategory['veterinary'] = (lastMonthByCategory['veterinary'] || 0) + amount;
 }
 });

 // Merge categories
 const allCategories = new Set([
 ...Object.keys(thisMonthByCategory),
 ...Object.keys(lastMonthByCategory)
 ]);

 const data: CategoryData[] = [];

 allCategories.forEach(cat => {
 const thisMonth = thisMonthByCategory[cat] || 0;
 const lastMonth = lastMonthByCategory[cat] || 0;
 const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : (thisMonth > 0 ? 100 : 0);
 
 const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
 
 data.push({
 category: cat,
 label: config.label,
 thisMonth,
 lastMonth,
 change,
 color: config.color,
 icon: config.icon,
 });
 });

 // Sort by this month spending
 return data.sort((a, b) => b.thisMonth - a.thisMonth).slice(0, 6);
 }, [transactions, medicalRecords]);

 // Find max for progress bar scaling
 const maxSpending = useMemo(() => {
 const allValues = comparisonData.flatMap(d => [d.thisMonth, d.lastMonth]);
 return Math.max(...allValues, 1);
 }, [comparisonData]);

 if (comparisonData.length === 0) {
 return null;
 }

 const getChangeIcon = (change: number) => {
 if (change > 5) return <ArrowUp className="w-3 h-3" />;
 if (change < -5) return <ArrowDown className="w-3 h-3" />;
 return <Minus className="w-3 h-3" />;
 };

 const getChangeColor = (change: number) => {
 if (change > 10) return'text-destructive';
 if (change < -10) return'text-accent';
 return'text-muted-foreground';
 };

 return (
 <GradientCard>
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-chart-3/10 flex items-center justify-center">
 <BarChart2 className="w-4 h-4 text-chart-3" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Category Comparison</h3>
 <p className="text-xs text-muted-foreground">This month vs. last month</p>
 </div>
 </div>

 <div className="space-y-4">
 {comparisonData.map((cat) => {
 const Icon = cat.icon;
 const thisMonthWidth = (cat.thisMonth / maxSpending) * 100;
 const lastMonthWidth = (cat.lastMonth / maxSpending) * 100;

 return (
 <div key={cat.category} className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div 
 className="w-7 h-7 rounded-full flex items-center justify-center"
 style={{ backgroundColor: `${cat.color}15` }}
 >
 <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
 </div>
 <span className="text-sm font-medium">{cat.label}</span>
 </div>
 <div className="flex items-center gap-2">
 <Badge 
 variant="outline" 
 className={`text-[10px] gap-0.5 ${getChangeColor(cat.change)}`}
 >
 {getChangeIcon(cat.change)}
 {cat.change > 0 ?'+' :''}{Formatters.number(Math.round(cat.change))}%
 </Badge>
 </div>
 </div>
 
 <div className="space-y-1">
 {/* This month */}
 <div className="flex items-center gap-2">
 <div className="w-14 text-xs text-muted-foreground">This mo.</div>
 <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
 <div 
 className="h-full rounded-full transition-all duration-500"
 style={{ 
 width: `${thisMonthWidth}%`,
 backgroundColor: cat.color 
 }}
 />
 </div>
 <div className="w-16 text-xs font-medium text-right">${Formatters.number(Math.round(cat.thisMonth))}</div>
 </div>
 
 {/* Last month */}
 <div className="flex items-center gap-2">
 <div className="w-14 text-xs text-muted-foreground">Last mo.</div>
 <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
 <div 
 className="h-full rounded-full transition-all duration-500 opacity-50"
 style={{ 
 width: `${lastMonthWidth}%`,
 backgroundColor: cat.color 
 }}
 />
 </div>
 <div className="w-16 text-xs text-muted-foreground text-right">${Formatters.number(Math.round(cat.lastMonth))}</div>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Legend */}
 <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-4 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-primary" />
 <span>This month</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-primary" />
 <span>Last month</span>
 </div>
 </div>
 </GradientCard>
 );
});

CategoryComparison.displayName ="CategoryComparison";

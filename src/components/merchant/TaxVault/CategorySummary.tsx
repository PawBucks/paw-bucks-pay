import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Progress } from'@/components/ui/progress';
import { TaxExpense, TaxExpenseCategory, CATEGORY_LABELS, SCHEDULE_C_MAPPING } from'./types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from'recharts';
import { TrendingDown, Sparkles, Car } from'lucide-react';

interface VehicleDeductionData {
 vehicleDeduction: number;
 vehicleMethod:'standard' |'actual';
 businessMiles: number;
 standardMileageDeduction: number;
 actualExpensesDeduction: number;
}

interface CategorySummaryProps {
 expenses: TaxExpense[];
 vehicleDeduction?: VehicleDeductionData;
}

const COLORS = [
'hsl(var(--primary))',
'hsl(210, 100%, 50%)',
'hsl(150, 60%, 45%)',
'hsl(280, 60%, 55%)',
'hsl(30, 80%, 55%)',
'hsl(340, 70%, 55%)',
'hsl(200, 70%, 50%)',
'hsl(45, 80%, 50%)',
'hsl(170, 60%, 45%)',
'hsl(0, 0%, 50%)',
'hsl(260, 60%, 55%)',
'hsl(120, 50%, 45%)',
'hsl(10, 70%, 55%)',
];

const VEHICLE_COLOR ='hsl(25, 95%, 53%)'; // Orange for vehicle

export function CategorySummary({ expenses, vehicleDeduction }: CategorySummaryProps) {
 const categoryTotals = expenses.reduce((acc, expense) => {
 acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
 return acc;
 }, {} as Record<TaxExpenseCategory, number>);

 const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
 const vehicleAmount = vehicleDeduction?.vehicleDeduction || 0;
 const grandTotal = totalExpenses + vehicleAmount;

 // Calculate total savings from PawBucks discount
 const totalSavings = expenses.reduce((sum, expense) => {
 return sum + (expense.savings_amount || 0);
 }, 0);

 // Count auto-logged entries
 const autoLoggedCount = expenses.filter(e => e.is_auto_logged).length;

 // Build chart data including vehicle deduction
 const chartData = [
 ...Object.entries(categoryTotals)
 .map(([category, amount]) => ({
 name: CATEGORY_LABELS[category as TaxExpenseCategory] || category,
 value: amount,
 category: category as TaxExpenseCategory,
 isVehicle: false,
 }))
 .sort((a, b) => b.value - a.value),
 // Add vehicle deduction if it exists
 ...(vehicleAmount > 0 ? [{
 name: `Vehicle (${vehicleDeduction?.vehicleMethod ==='standard' ?'Mileage' :'Actual'})`,
 value: vehicleAmount,
 category:'vehicle' as TaxExpenseCategory,
 isVehicle: true,
 }] : []),
 ];

 const sortedCategories = Object.entries(categoryTotals)
 .sort(([, a], [, b]) => b - a);

 return (
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Expense Distribution</CardTitle>
 </CardHeader>
 <CardContent>
 {chartData.length > 0 ? (
 <div className="h-[300px]">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={chartData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={2}
 dataKey="value"
 >
 {chartData.map((entry, index) => (
 <Cell 
 key={`cell-${index}`} 
 fill={entry.isVehicle ? VEHICLE_COLOR : COLORS[index % COLORS.length]} 
 />
 ))}
 </Pie>
 <Tooltip
 formatter={(value: number) => `$${value.toFixed(2)}`}
 />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <div className="h-[300px] flex items-center justify-center text-muted-foreground">
 No expense data to display
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Schedule C Breakdown</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Vehicle Deduction at the top if exists */}
 {vehicleAmount > 0 && vehicleDeduction && (
 <div className="space-y-2 pb-3 border-b">
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-2">
 <Car className="h-4 w-4 text-warning" />
 <div>
 <p className="font-medium text-sm">
 Vehicle Deduction ({vehicleDeduction.vehicleMethod ==='standard' ?'Standard Mileage' :'Actual Expenses'})
 </p>
 <p className="text-xs text-muted-foreground">
 Line 9: Car and truck expenses
 </p>
 </div>
 </div>
 <span className="font-semibold">${vehicleAmount.toFixed(2)}</span>
 </div>
 <Progress 
 value={grandTotal > 0 ? (vehicleAmount / grandTotal) * 100 : 0} 
 className="h-2"
 style={{ 
'--progress-background': VEHICLE_COLOR 
 } as React.CSSProperties}
 />
 <p className="text-xs text-muted-foreground">
 {vehicleDeduction.vehicleMethod ==='standard' 
 ? `${vehicleDeduction.businessMiles.toFixed(0)} business miles @ IRS rate`
 :'Based on actual vehicle expenses × business use %'}
 </p>
 </div>
 )}

 {sortedCategories.length > 0 ? (
 sortedCategories.map(([category, amount], index) => {
 const percentage = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
 const scheduleC = SCHEDULE_C_MAPPING[category as TaxExpenseCategory];
 
 return (
 <div key={category} className="space-y-2">
 <div className="flex justify-between items-start">
 <div>
 <p className="font-medium text-sm">
 {CATEGORY_LABELS[category as TaxExpenseCategory]}
 </p>
 <p className="text-xs text-muted-foreground">
 {scheduleC.line}: {scheduleC.description}
 </p>
 </div>
 <span className="font-semibold">${amount.toFixed(2)}</span>
 </div>
 <Progress 
 value={percentage} 
 className="h-2"
 style={{ 
'--progress-background': COLORS[index % COLORS.length] 
 } as React.CSSProperties}
 />
 </div>
 );
 })
 ) : !vehicleAmount ? (
 <div className="text-center py-8 text-muted-foreground">
 Add expenses to see Schedule C breakdown
 </div>
 ) : null}
 
 {grandTotal > 0 && (
 <div className="pt-4 border-t space-y-3">
 <div className="flex justify-between items-center font-bold">
 <span>Total Deductions</span>
 <span className="text-xl">${grandTotal.toFixed(2)}</span>
 </div>
 
 {totalSavings > 0 && (
 <div className="flex justify-between items-center text-success dark:text-success bg-success/10 p-3 rounded-lg">
 <div className="flex items-center gap-2">
 <TrendingDown className="h-4 w-4" />
 <span className="font-medium">PawBucks Savings</span>
 </div>
 <span className="font-bold">${totalSavings.toFixed(2)}</span>
 </div>
 )}
 
 {autoLoggedCount > 0 && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <Sparkles className="h-3.5 w-3.5 text-primary" />
 <span>{autoLoggedCount} expense{autoLoggedCount > 1 ?'s' :''} auto-logged from Merchant Market</span>
 </div>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TaxExpense, TaxExpenseCategory, CATEGORY_LABELS, SCHEDULE_C_MAPPING } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategorySummaryProps {
  expenses: TaxExpense[];
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
];

export function CategorySummary({ expenses }: CategorySummaryProps) {
  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<TaxExpenseCategory, number>);

  const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  const chartData = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      name: CATEGORY_LABELS[category as TaxExpenseCategory],
      value: amount,
      category: category as TaxExpenseCategory,
    }))
    .sort((a, b) => b.value - a.value);

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
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          {sortedCategories.length > 0 ? (
            sortedCategories.map(([category, amount], index) => {
              const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Add expenses to see Schedule C breakdown
            </div>
          )}
          
          {totalExpenses > 0 && (
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center font-bold">
                <span>Total Deductions</span>
                <span className="text-xl">${totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

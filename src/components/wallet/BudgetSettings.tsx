import { memo, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, AlertTriangle, Check, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth } from "date-fns";
import { CATEGORY_CONFIG, getNormalizedCategory, getCategoryIcon } from "@/lib/categoryMapping";

type Transaction = {
  id: string;
  amount: number;
  created_at: string;
  merchants?: {
    business_type: string;
  } | null;
};

type BudgetSetting = {
  id: string;
  category: string;
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
};

type BudgetSettingsProps = {
  transactions: Transaction[];
};

// Categories available for budget tracking
const BUDGET_CATEGORIES = Object.entries(CATEGORY_CONFIG)
  .filter(([id]) => id !== 'other')
  .map(([id, config]) => ({
    id,
    label: config.label,
    icon: config.icon,
    color: config.color,
  }));

export const BudgetSettings = memo(({ transactions }: BudgetSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [thresholdValue, setThresholdValue] = useState("80");

  // Fetch budget settings
  const { data: budgets = [], isLoading } = useOptimizedQuery<BudgetSetting[]>(
    ['budget-settings', user?.id || ''],
    async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('budget_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    { staleTime: 1000 * 60 * 5 }
  );

  // Calculate current month spending by category
  const categorySpending = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const spending: Record<string, number> = {};

    transactions
      .filter(tx => {
        const txDate = new Date(tx.created_at);
        return txDate >= monthStart && txDate <= monthEnd;
      })
      .forEach(tx => {
        const normalizedCategory = getNormalizedCategory(tx.merchants?.business_type);
        spending[normalizedCategory] = (spending[normalizedCategory] || 0) + tx.amount;
      });

    return spending;
  }, [transactions]);

  // Get budget alerts
  const budgetAlerts = useMemo(() => {
    return budgets.filter(budget => {
      const spent = categorySpending[budget.category] || 0;
      const percentage = (spent / budget.monthly_limit) * 100;
      return percentage >= budget.alert_threshold;
    });
  }, [budgets, categorySpending]);

  const handleSaveBudget = useCallback(async () => {
    if (!user || !editingCategory || !budgetValue) return;

    const limit = parseFloat(budgetValue);
    const threshold = parseFloat(thresholdValue);

    if (isNaN(limit) || limit <= 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_settings')
        .upsert({
          user_id: user.id,
          category: editingCategory,
          monthly_limit: limit,
          alert_threshold: threshold,
          is_active: true,
        }, { 
          onConflict: 'user_id,category' 
        });

      if (error) throw error;

      toast.success("Budget saved successfully");
      queryClient.invalidateQueries({ queryKey: ['budget-settings'] });
      setDialogOpen(false);
      setEditingCategory(null);
      setBudgetValue("");
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error("Failed to save budget");
    }
  }, [user, editingCategory, budgetValue, thresholdValue, queryClient]);

  const handleDeleteBudget = useCallback(async (category: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('budget_settings')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category);

      if (error) throw error;

      toast.success("Budget removed");
      queryClient.invalidateQueries({ queryKey: ['budget-settings'] });
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast.error("Failed to remove budget");
    }
  }, [user, queryClient]);

  const openEditDialog = useCallback((category: string, existingBudget?: BudgetSetting) => {
    setEditingCategory(category);
    setBudgetValue(existingBudget?.monthly_limit?.toString() || "");
    setThresholdValue(existingBudget?.alert_threshold?.toString() || "80");
    setDialogOpen(true);
  }, []);

  return (
    <GradientCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Budget Settings
        </h3>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {budgetAlerts.map(alert => {
            const spent = categorySpending[alert.category] || 0;
            const percentage = Math.min((spent / alert.monthly_limit) * 100, 100);
            const category = BUDGET_CATEGORIES.find(c => c.id === alert.category);
            const Icon = category?.icon || ShoppingBag;

            return (
              <div key={alert.id} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {category?.label} budget {percentage >= 100 ? 'exceeded' : 'warning'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>${spent.toFixed(2)} of ${alert.monthly_limit.toFixed(2)}</span>
                  <span>{percentage.toFixed(0)}%</span>
                </div>
                <Progress value={percentage} className="h-1.5 mt-1" />
              </div>
            );
          })}
        </div>
      )}

      {/* Category Budgets List */}
      <div className="space-y-3">
        {BUDGET_CATEGORIES.map(category => {
          const budget = budgets.find(b => b.category === category.id);
          const spent = categorySpending[category.id] || 0;
          const percentage = budget ? Math.min((spent / budget.monthly_limit) * 100, 100) : 0;
          const Icon = category.icon;

          return (
            <div 
              key={category.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: category.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium">{category.label}</p>
                  {budget ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        ${spent.toFixed(2)} / ${budget.monthly_limit.toFixed(2)}
                      </p>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 100 ? 'hsl(var(--destructive))' : 
                              percentage >= budget.alert_threshold ? 'hsl(var(--chart-4))' : 
                              'hsl(var(--accent))'
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No budget set</p>
                  )}
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => openEditDialog(category.id, budget)}
              >
                {budget ? 'Edit' : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Edit Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? `Set ${BUDGET_CATEGORIES.find(c => c.id === editingCategory)?.label || 'Category'} Budget` : 'Set Budget'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Monthly Limit ($)</Label>
              <Input
                id="budget-amount"
                type="number"
                placeholder="Enter monthly budget"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Alert at (%)</Label>
              <Input
                id="alert-threshold"
                type="number"
                placeholder="Alert threshold percentage"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                min="50"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Get notified when spending reaches this percentage
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveBudget} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Save Budget
              </Button>
              {budgets.find(b => b.category === editingCategory) && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (editingCategory) {
                      handleDeleteBudget(editingCategory);
                      setDialogOpen(false);
                    }
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </GradientCard>
  );
});

BudgetSettings.displayName = "BudgetSettings";

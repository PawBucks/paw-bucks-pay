import { memo, useState, useCallback, useMemo } from"react";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Progress } from"@/components/ui/progress";
import { Badge } from"@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { 
 Target, 
 Plus, 
 TrendingDown, 
 Calendar, 
 CheckCircle2,
 Sparkles,
 Clock
} from"lucide-react";
import { toast } from"sonner";
import { useQueryClient } from"@tanstack/react-query";
import { startOfMonth, endOfMonth, differenceInDays, addMonths, format } from"date-fns";

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

type SpendingGoalsProps = {
 transactions: Transaction[];
 medicalRecords?: MedicalRecord[];
};

type SpendingGoal = {
 id: string;
 target_amount: number;
 current_month_target: number;
 created_at: string;
 end_date: string;
 is_active: boolean;
};

export const SpendingGoals = memo(({ transactions, medicalRecords = [] }: SpendingGoalsProps) => {
 const { user } = useAuth();
 const queryClient = useQueryClient();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [goalAmount, setGoalAmount] = useState("");
 const [monthsToAchieve, setMonthsToAchieve] = useState("3");

 // Calculate current month spending
 const currentMonthSpending = useMemo(() => {
 const now = new Date();
 const monthStart = startOfMonth(now);
 const monthEnd = endOfMonth(now);

 const txTotal = transactions
 .filter(tx => {
 const d = new Date(tx.created_at);
 return d >= monthStart && d <= monthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const medTotal = medicalRecords
 .filter(r => {
 const d = new Date(r.record_date);
 return d >= monthStart && d <= monthEnd;
 })
 .reduce((sum, r) => sum + (r.price || 0), 0);

 return txTotal + medTotal;
 }, [transactions, medicalRecords]);

 // Calculate average monthly spending (last 3 months)
 const averageMonthlySpending = useMemo(() => {
 const now = new Date();
 let total = 0;
 
 for (let i = 1; i <= 3; i++) {
 const monthStart = startOfMonth(addMonths(now, -i));
 const monthEnd = endOfMonth(addMonths(now, -i));

 const txTotal = transactions
 .filter(tx => {
 const d = new Date(tx.created_at);
 return d >= monthStart && d <= monthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 const medTotal = medicalRecords
 .filter(r => {
 const d = new Date(r.record_date);
 return d >= monthStart && d <= monthEnd;
 })
 .reduce((sum, r) => sum + (r.price || 0), 0);

 total += txTotal + medTotal;
 }

 return total / 3;
 }, [transactions, medicalRecords]);

 // For now, we'll use local state for goals (could be persisted to DB later)
 const [localGoal, setLocalGoal] = useState<{
 targetAmount: number;
 monthlyTarget: number;
 endDate: Date;
 } | null>(null);

 const handleCreateGoal = useCallback(() => {
 const target = parseFloat(goalAmount);
 const months = parseInt(monthsToAchieve);

 if (isNaN(target) || target <= 0) {
 toast.error("Please enter a valid target amount");
 return;
 }

 if (target >= averageMonthlySpending) {
 toast.error("Target should be less than your average spending");
 return;
 }

 setLocalGoal({
 targetAmount: target,
 monthlyTarget: target,
 endDate: addMonths(new Date(), months)
 });

 toast.success("Spending goal created!");
 setDialogOpen(false);
 setGoalAmount("");
 }, [goalAmount, monthsToAchieve, averageMonthlySpending]);

 const progressPercentage = localGoal 
 ? Math.min((currentMonthSpending / localGoal.monthlyTarget) * 100, 100)
 : 0;

 const isOnTrack = localGoal && currentMonthSpending <= localGoal.monthlyTarget;

 // Days remaining in month
 const now = new Date();
 const daysRemaining = differenceInDays(endOfMonth(now), now);

 // Projected vs target
 const projectedSpending = localGoal 
 ? (currentMonthSpending / (differenceInDays(now, startOfMonth(now)) + 1)) * 
 (differenceInDays(endOfMonth(now), startOfMonth(now)) + 1)
 : 0;

 return (
 <GradientCard>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
 <Target className="w-4 h-4 text-accent" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Spending Goal</h3>
 <p className="text-xs text-muted-foreground">Track your monthly target</p>
 </div>
 </div>
 {!localGoal && (
 <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-1" />
 Set Goal
 </Button>
 )}
 </div>

 {localGoal ? (
 <div className="space-y-4">
 {/* Goal Progress */}
 <div className="p-4 rounded-md bg-muted/30 border border-border/50">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 {isOnTrack ? (
 <CheckCircle2 className="w-5 h-5 text-accent" />
 ) : (
 <TrendingDown className="w-5 h-5 text-destructive" />
 )}
 <span className="font-medium">
 {isOnTrack ?'On Track!' :'Over Budget'}
 </span>
 <Badge variant={isOnTrack ?"default" :"destructive"} className="text-xs">
 {daysRemaining} days left
 </Badge>
 </div>
 </div>

 <div className="mb-2">
 <div className="flex justify-between text-sm mb-1">
 <span className="text-muted-foreground">Progress</span>
 <span className="font-medium">
 ${Formatters.number(Math.round(currentMonthSpending))} / ${Formatters.number(Math.round(localGoal.monthlyTarget))}
 </span>
 </div>
 <Progress 
 value={progressPercentage} 
 className={`h-3 ${progressPercentage > 100 ?'[&>div]:bg-destructive' :''}`} 
 />
 </div>

 <div className="grid grid-cols-2 gap-3 mt-4">
 <div className="p-3 rounded-lg bg-background/50">
 <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
 <Clock className="w-3 h-3" />
 Remaining
 </div>
 <p className="font-bold text-lg">
 ${Math.max(localGoal.monthlyTarget - currentMonthSpending, 0).toFixed(0)}
 </p>
 </div>
 <div className="p-3 rounded-lg bg-background/50">
 <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
 <TrendingDown className="w-3 h-3" />
 Projected
 </div>
 <p className={`font-bold text-lg ${projectedSpending > localGoal.monthlyTarget ?'text-destructive' :'text-accent'}`}>
 ${Formatters.number(Math.round(projectedSpending))}
 </p>
 </div>
 </div>
 </div>

 {/* Comparison with average */}
 <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
 <div className="flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-primary" />
 <span className="text-sm">vs. Your Average</span>
 </div>
 <div className="text-right">
 <span className="font-bold text-accent">
 {((1 - localGoal.monthlyTarget / averageMonthlySpending) * 100).toFixed(0)}% less
 </span>
 </div>
 </div>

 {/* Edit/Remove Goal */}
 <div className="flex gap-2">
 <Button 
 variant="outline" 
 size="sm" 
 className="flex-1"
 onClick={() => setDialogOpen(true)}
 >
 Edit Goal
 </Button>
 <Button 
 variant="ghost" 
 size="sm"
 onClick={() => {
 setLocalGoal(null);
 toast.success("Goal removed");
 }}
 >
 Remove
 </Button>
 </div>
 </div>
 ) : (
 <div className="text-center py-6">
 <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
 <Target className="w-6 h-6 text-muted-foreground" />
 </div>
 <p className="text-sm text-muted-foreground mb-2">No spending goal set</p>
 <p className="text-xs text-muted-foreground mb-4">
 Your average: <span className="font-medium">${Formatters.number(Math.round(averageMonthlySpending))}/month</span>
 </p>
 <Button size="sm" onClick={() => setDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-1" />
 Create Goal
 </Button>
 </div>
 )}

 {/* Create/Edit Goal Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Set Monthly Spending Goal</DialogTitle>
 </DialogHeader>
 
 <div className="space-y-4 pt-4">
 <div className="p-3 rounded-lg bg-muted text-sm">
 <p className="text-muted-foreground">Your 3-month average:</p>
 <p className="font-bold text-lg">${Formatters.number(Math.round(averageMonthlySpending))}/month</p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="goal-amount">Monthly Target ($)</Label>
 <Input
 id="goal-amount"
 type="number"
 placeholder={`Less than $${Formatters.number(Math.round(averageMonthlySpending))}`}
 value={goalAmount}
 onChange={(e) => setGoalAmount(e.target.value)}
 min="0"
 step="10"
 />
 <p className="text-xs text-muted-foreground">
 Set a target below your average to save money
 </p>
 </div>

 <Button onClick={handleCreateGoal} className="w-full">
 <Target className="w-4 h-4 mr-2" />
 Set Goal
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </GradientCard>
 );
});

SpendingGoals.displayName ="SpendingGoals";

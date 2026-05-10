import { useState } from'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Button } from'@/components/ui/button';
import { Badge } from'@/components/ui/badge';
import { Trash2, ExternalLink } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { TaxExpense, CATEGORY_LABELS } from'./types';
import { formatLocalDate } from'@/utils/formatters';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from'@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from'@/components/ui/tooltip';

import { Formatters } from "@/utils/formatters";
interface ExpensesListProps {
 expenses: TaxExpense[];
 onExpenseDeleted: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
 inventory_supplies:'bg-success/10 text-success',
 specialized_equipment:'bg-accent/10 text-accent',
 professional_services:'bg-info/10 text-info',
 merchant_market:'bg-primary/10 text-primary',
 platform_fees:'bg-warning/15 text-warning',
 processing_fees:'bg-destructive/10 text-destructive',
 gas_mileage:'bg-info/15 text-info',
 pet_supplies_treats:'bg-success/15 text-success',
 equipment:'bg-accent/10 text-accent',
 insurance:'bg-warning/10 text-warning',
 marketing_advertising:'bg-accent/10 text-accent',
 office_supplies:'bg-warning/15 text-warning',
 software_subscriptions:'bg-info/10 text-info',
 training_education:'bg-success/10 text-success',
 other:'bg-muted text-foreground',
};

// Helper to get auto-logged tooltip text based on category
const getAutoLoggedTooltip = (category: string): string => {
 switch (category) {
 case'platform_fees':
 return'Auto-logged PawBucks success fee (3% per transaction)';
 case'processing_fees':
 return'Auto-logged Stripe card processing fee (pulled from Stripe)';
 case'merchant_market':
 return'Auto-logged from Merchant Market purchase';
 default:
 return'Auto-logged expense';
 }
};

export function ExpensesList({ expenses, onExpenseDeleted }: ExpensesListProps) {
 const [deleteId, setDeleteId] = useState<string | null>(null);
 const [isDeleting, setIsDeleting] = useState(false);

 const handleDelete = async () => {
 if (!deleteId) return;
 
 setIsDeleting(true);
 try {
 const { error } = await supabase
 .from('merchant_tax_expenses')
 .delete()
 .eq('id', deleteId);

 if (error) throw error;

 toast.success('Expense deleted');
 onExpenseDeleted();
 } catch (error) {
 console.error('Error deleting expense:', error);
 toast.error('Failed to delete expense');
 } finally {
 setIsDeleting(false);
 setDeleteId(null);
 }
 };

 if (expenses.length === 0) {
 return (
 <div className="text-center py-12 text-muted-foreground">
 <span className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true">🧾</span>
 <p>No expenses recorded yet</p>
 <p className="text-sm">Start adding your business expenses to track them for tax purposes</p>
 </div>
 );
 }

 return (
 <>
 <TooltipProvider>
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Category</TableHead>
 <TableHead>Vendor</TableHead>
 <TableHead>Description</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead className="text-right">Savings</TableHead>
 <TableHead className="w-[100px]">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {expenses.map((expense) => (
 <TableRow key={expense.id} className={expense.is_auto_logged ?'bg-primary/5' :''}>
 <TableCell className="font-medium">
 <div className="flex items-center gap-1.5">
 {formatLocalDate(expense.expense_date,'MMM d, yyyy')}
 {expense.is_auto_logged && (
 <Tooltip>
 <TooltipTrigger>
 <Sparkles className="h-3.5 w-3.5 text-primary" />
 </TooltipTrigger>
 <TooltipContent>
 <p>{getAutoLoggedTooltip(expense.category)}</p>
 </TooltipContent>
 </Tooltip>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge className={CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other} variant="secondary">
 {CATEGORY_LABELS[expense.category] || expense.category}
 </Badge>
 </TableCell>
 <TableCell>{expense.vendor_name ||'-'}</TableCell>
 <TableCell className="max-w-[200px] truncate">
 {expense.description ||'-'}
 </TableCell>
 <TableCell className="text-right font-medium">
 {Formatters.currency(expense.amount)}
 {expense.original_price && expense.original_price > expense.amount && (
 <span className="block text-xs text-muted-foreground line-through">
 {Formatters.currency(expense.original_price)}
 </span>
 )}
 </TableCell>
 <TableCell className="text-right">
 {expense.savings_amount && expense.savings_amount > 0 ? (
 <div className="flex items-center justify-end gap-1 text-success">
 <span className="h-3.5 w-3.5" aria-hidden="true">📉</span>
 <span className="font-medium">{Formatters.currency(expense.savings_amount)}</span>
 </div>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1">
 {expense.receipt_url && (
 <Button
 variant="ghost"
 size="icon"
 asChild
 className="h-8 w-8"
 >
 <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
 <ExternalLink className="h-4 w-4" />
 </a>
 </Button>
 )}
 {!expense.is_auto_logged && (
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-destructive hover:text-destructive"
 onClick={() => setDeleteId(expense.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </TooltipProvider>

 <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Expense</AlertDialogTitle>
 <AlertDialogDescription>
 Are you sure you want to delete this expense? This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
 {isDeleting ?'Deleting...' :'Delete'}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </>
 );
}

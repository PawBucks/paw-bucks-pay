import { useState, useEffect, useMemo, useCallback } from'react';
import { useNavigate } from'react-router-dom';
import { useQuery } from'@tanstack/react-query';
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { Button } from'@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from'@/components/ui/tooltip';
import { ArrowLeft, Calculator, Car, DollarSign, Download, Home, Info, Plus, Receipt, RefreshCw, Users, Vault } from "lucide-react";
import { supabase } from'@/integrations/supabase/client';
import { useAuth } from'@/hooks/useAuth';
import { ExpenseEntryDialog, ExpensesList, CategorySummary, ReportGenerator, MileageLog, HomeOfficeCalculator, TaxLiabilityEstimator, YearEndExports, AccountantCollaboration, TaxExpense, TaxExpenseCategory } from'@/components/merchant/TaxVault';
import { LoadingSpinner } from'@/components/LoadingSpinner';
import { toast } from'sonner';

import { Formatters } from "@/utils/formatters";
function BackfillFeesButton({ onComplete }: { onComplete: () => void }) {
 const [isSyncing, setIsSyncing] = useState(false);

 const handleSync = async () => {
 setIsSyncing(true);
 try {
 const { data, error } = await supabase.functions.invoke('backfill-fee-expenses');
 if (error) throw error;
 if (data?.error) throw new Error(data.error);
 
 const { backfilledPlatform = 0, backfilledProcessing = 0 } = data || {};
 const total = backfilledPlatform + backfilledProcessing;
 
 if (total > 0) {
 toast.success(`Synced ${total} fee expense(s) from Stripe`, {
 description: `${backfilledPlatform} success fee(s), ${backfilledProcessing} processing fee(s)`,
 });
 onComplete();
 } else {
 toast.info('All fees are already synced');
 }
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message :'Failed to sync fees';
 console.error('Backfill error:', err);
 toast.error(message);
 } finally {
 setIsSyncing(false);
 }
 };

 return (
 <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
 <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ?'animate-spin' :''}`} />
 {isSyncing ?'Syncing...' :'Sync Fees from Stripe'}
 </Button>
 );
}

const FALLBACK_IRS_RATES: Record<number, number> = {
 2024: 0.67,
 2025: 0.70,
 2026: 0.725,
};

export default function MerchantTaxVault() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const [merchantId, setMerchantId] = useState<string | null>(null);
 const [businessName, setBusinessName] = useState('');
 const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

 const currentYear = new Date().getFullYear();
 const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

 // Fetch merchant
 useEffect(() => {
 async function fetchMerchant() {
 if (!user) return;
 
 const { data } = await supabase
 .from('merchants')
 .select('id, business_name')
 .eq('user_id', user.id)
 .single();
 
 if (data) {
 setMerchantId(data.id);
 setBusinessName(data.business_name);
 }
 }
 
 fetchMerchant();
 }, [user]);

 // Fetch expenses
 const { data: expenses = [], isLoading, refetch } = useQuery({
 queryKey: ['tax-expenses', merchantId, selectedYear],
 queryFn: async () => {
 if (!merchantId) return [];
 
 const { data, error } = await supabase
 .from('merchant_tax_expenses')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', selectedYear)
 .order('expense_date', { ascending: false });
 
 if (error) throw error;
 
 return (data || []).map(expense => ({
 ...expense,
 category: expense.category as TaxExpenseCategory,
 })) as TaxExpense[];
 },
 enabled: !!merchantId,
 });

 // Fetch mileage entries for vehicle deduction calculation
 const { data: mileageEntries = [] } = useQuery({
 queryKey: ['mileage-log', merchantId, selectedYear],
 queryFn: async () => {
 if (!merchantId) return [];
 const { data, error } = await supabase
 .from('merchant_mileage_log')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', selectedYear);
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 // Fetch vehicle expenses for actual expense method
 const { data: vehicleExpenses = [] } = useQuery({
 queryKey: ['vehicle-expenses', merchantId, selectedYear],
 queryFn: async () => {
 if (!merchantId) return [];
 const { data, error } = await supabase
 .from('merchant_vehicle_expenses')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', selectedYear);
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 // Fetch IRS mileage rate for selected year
 const { data: irsRateData } = useQuery({
 queryKey: ['irs-mileage-rate', selectedYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('irs_mileage_rates')
 .select('rate_per_mile')
 .eq('tax_year', selectedYear)
 .single();
 if (error) return null;
 return data;
 },
 });

 const IRS_MILEAGE_RATE = irsRateData?.rate_per_mile || FALLBACK_IRS_RATES[selectedYear] || 0.70;

 // Calculate comprehensive total deductions including best vehicle option
 const deductionBreakdown = useMemo(() => {
 // Total general expenses
 const totalGeneralExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

 // Calculate vehicle deduction (best option)
 const businessMiles = mileageEntries
 .filter((m: any) => m.trip_type ==='pet_commute')
 .reduce((sum: number, m: any) => sum + Number(m.miles || 0), 0);
 const totalMiles = mileageEntries.reduce((sum: number, m: any) => sum + Number(m.miles || 0), 0);
 
 // Standard Mileage Rate method
 const standardMileageDeduction = businessMiles * IRS_MILEAGE_RATE;
 
 // Actual Expenses method
 const totalVehicleExpenses = vehicleExpenses.reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0);
 const businessMileagePercentage = totalMiles > 0 ? (businessMiles / totalMiles) : 0;
 const actualExpensesDeduction = totalVehicleExpenses * businessMileagePercentage;
 
 // Use whichever vehicle deduction is higher (best option)
 const vehicleDeduction = Math.max(standardMileageDeduction, actualExpensesDeduction);
 const vehicleMethod = standardMileageDeduction >= actualExpensesDeduction ?'standard' :'actual';

 // Total comprehensive deductions
 const totalDeductions = totalGeneralExpenses + vehicleDeduction;

 return {
 totalGeneralExpenses,
 businessMiles,
 standardMileageDeduction,
 actualExpensesDeduction,
 vehicleDeduction,
 vehicleMethod,
 totalDeductions,
 };
 }, [expenses, mileageEntries, vehicleExpenses, IRS_MILEAGE_RATE]);

 const categoryCount = new Set(expenses.map(exp => exp.category)).size;

 if (!user) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <LoadingSpinner />
 </div>
 );
 }

 return (
 <MerchantWorkspaceLayout>
 <WorkspacePageHeader
   section="Dashboard"
   title="Tax Vault"
   subtitle="Track and categorize business expenses for tax filing"
 />
 <main className="container mx-auto px-4 py-6 max-w-6xl">
 <div className="flex justify-end mb-4">
 
 <div className="flex items-center gap-3">
 <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
 <SelectTrigger className="w-[120px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {years.map((year) => (
 <SelectItem key={year} value={year.toString()}>
 {year}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 
 <Button onClick={() => setIsAddDialogOpen(true)}>
 <Plus className="mr-2 h-4 w-4" />
 Add Expense
 </Button>
 </div>
 </div>

 {/* Stats Cards */}
 <TooltipProvider>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-1">
 <p className="text-sm text-muted-foreground">Total Deductions</p>
 <Tooltip>
 <TooltipTrigger asChild>
 <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <div className="space-y-1 text-xs">
 <p className="font-semibold">Deduction Breakdown:</p>
 <div className="flex justify-between">
 <span>General Expenses:</span>
 <span>{Formatters.currency(deductionBreakdown.totalGeneralExpenses)}</span>
 </div>
 {deductionBreakdown.vehicleDeduction > 0 && (
 <div className="flex justify-between">
 <span>Vehicle ({deductionBreakdown.vehicleMethod ==='standard' ?'Mileage' :'Actual'}):</span>
 <span>{Formatters.currency(deductionBreakdown.vehicleDeduction)}</span>
 </div>
 )}
 <p className="text-muted-foreground pt-1 border-t">
 Home office deductions are calculated separately in the Home Office tab.
 </p>
 </div>
 </TooltipContent>
 </Tooltip>
 </div>
 <p className="text-2xl font-bold">{Formatters.currency(deductionBreakdown.totalDeductions)}</p>
 </div>
 <DollarSign className="h-8 w-8 text-success opacity-80" aria-hidden="true" />
 </div>
 </CardContent>
 </Card>
 
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Logged Expenses</p>
 <p className="text-2xl font-bold">{expenses.length}</p>
 </div>
 <Receipt className="h-8 w-8 text-info opacity-80" aria-hidden="true" />
 </div>
 </CardContent>
 </Card>
 
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <div className="flex items-center gap-1">
 <p className="text-sm text-muted-foreground">Vehicle Deduction</p>
 {deductionBreakdown.vehicleDeduction > 0 && (
 <Tooltip>
 <TooltipTrigger asChild>
 <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <div className="space-y-1 text-xs">
 <p className="font-semibold">Best Option Selected:</p>
 <div className="flex justify-between">
 <span>Standard Mileage ({Formatters.number(Math.round(deductionBreakdown.businessMiles))} mi):</span>
 <span>{Formatters.currency(deductionBreakdown.standardMileageDeduction)}</span>
 </div>
 <div className="flex justify-between">
 <span>Actual Expenses:</span>
 <span>{Formatters.currency(deductionBreakdown.actualExpensesDeduction)}</span>
 </div>
 <p className="text-success pt-1 border-t">
 Using {deductionBreakdown.vehicleMethod ==='standard' ?'Standard Mileage' :'Actual Expenses'} method (higher value)
 </p>
 </div>
 </TooltipContent>
 </Tooltip>
 )}
 </div>
 <p className="text-2xl font-bold">{Formatters.currency(deductionBreakdown.vehicleDeduction)}</p>
 </div>
 <Car className="h-8 w-8 text-warning opacity-80" aria-hidden="true" />
 </div>
 </CardContent>
 </Card>
 </div>
 </TooltipProvider>

 {/* Main Content Tabs */}
 <Tabs defaultValue="tax-estimate" className="space-y-6">
 <TabsList className="flex-wrap h-auto gap-1">
 <TabsTrigger value="tax-estimate" className="flex items-center gap-1">
 <Calculator className="h-4 w-4" />
 Tax Estimate
 </TabsTrigger>
 <TabsTrigger value="expenses">Expenses</TabsTrigger>
 <TabsTrigger value="mileage" className="flex items-center gap-1">
 <Car className="h-4 w-4" aria-hidden="true" />
 Mileage Log
 </TabsTrigger>
 <TabsTrigger value="home-office" className="flex items-center gap-1">
 <Home className="h-4 w-4" aria-hidden="true" />
 Home Office
 </TabsTrigger>
 <TabsTrigger value="summary">Category Summary</TabsTrigger>
 <TabsTrigger value="year-end" className="flex items-center gap-1">
 <Download className="h-4 w-4" />
 Year-End Exports
 </TabsTrigger>
 <TabsTrigger value="accountant" className="flex items-center gap-1">
 <Users className="h-4 w-4" aria-hidden="true" />
 Accountant
 </TabsTrigger>
 </TabsList>
 
 <TabsContent value="tax-estimate">
 {merchantId && (
 <TaxLiabilityEstimator merchantId={merchantId} taxYear={selectedYear} />
 )}
 </TabsContent>
 
 <TabsContent value="expenses">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Expense Log</CardTitle>
 <CardDescription>All recorded business expenses for {selectedYear}</CardDescription>
 </div>
 <BackfillFeesButton onComplete={refetch} />
 </div>
 </CardHeader>
 <CardContent>
 {isLoading ? (
 <div className="flex justify-center py-8">
 <LoadingSpinner />
 </div>
 ) : (
 <ExpensesList expenses={expenses} onExpenseDeleted={refetch} />
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="mileage">
 {merchantId && (
 <MileageLog merchantId={merchantId} taxYear={selectedYear} />
 )}
 </TabsContent>

 <TabsContent value="home-office">
 <HomeOfficeCalculator />
 </TabsContent>
 
 <TabsContent value="summary">
 <CategorySummary 
 expenses={expenses} 
 vehicleDeduction={{
 vehicleDeduction: deductionBreakdown.vehicleDeduction,
 vehicleMethod: deductionBreakdown.vehicleMethod as'standard' |'actual',
 businessMiles: deductionBreakdown.businessMiles,
 standardMileageDeduction: deductionBreakdown.standardMileageDeduction,
 actualExpensesDeduction: deductionBreakdown.actualExpensesDeduction,
 }}
 />
 </TabsContent>
 
 <TabsContent value="year-end">
 {merchantId && (
 <YearEndExports 
 merchantId={merchantId} 
 businessName={businessName} 
 taxYear={selectedYear}
 expenses={expenses}
 />
 )}
 </TabsContent>
 
 <TabsContent value="accountant">
 {merchantId && (
 <AccountantCollaboration merchantId={merchantId} businessName={businessName} />
 )}
 </TabsContent>
 </Tabs>
 </main>

 {merchantId && (
 <ExpenseEntryDialog
 open={isAddDialogOpen}
 onOpenChange={setIsAddDialogOpen}
 merchantId={merchantId}
 onExpenseAdded={refetch}
 />
 )}
 </MerchantWorkspaceLayout>
 );
}

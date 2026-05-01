import { useState, useMemo } from'react';
import { useQuery } from'@tanstack/react-query';
import { format } from'date-fns';
import { useAuth } from'@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Badge } from'@/components/ui/badge';
import { Progress } from'@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from'@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from'@/components/ui/alert';
import { Switch } from'@/components/ui/switch';
import { Label } from'@/components/ui/label';
import { 
 Calculator, 
 TrendingUp, 
 TrendingDown, 
 Calendar, 
 DollarSign, 
 AlertTriangle, 
 Info, 
 Bell,
 CheckCircle2,
 PiggyBank,
 Receipt,
 Car,
 Home as HomeIcon,
 RefreshCw
} from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { LoadingSpinner } from'@/components/LoadingSpinner';

import { Formatters } from "@/utils/formatters";
interface TaxLiabilityEstimatorProps {
 merchantId: string;
 taxYear: number;
}

// 2024/2025 Tax brackets for self-employment (simplified)
const FEDERAL_TAX_BRACKETS = [
 { min: 0, max: 11600, rate: 0.10 },
 { min: 11600, max: 47150, rate: 0.12 },
 { min: 47150, max: 100525, rate: 0.22 },
 { min: 100525, max: 191950, rate: 0.24 },
 { min: 191950, max: 243725, rate: 0.32 },
 { min: 243725, max: 609350, rate: 0.35 },
 { min: 609350, max: Infinity, rate: 0.37 },
];

const SELF_EMPLOYMENT_TAX_RATE = 0.153; // 15.3% (12.4% Social Security + 2.9% Medicare)
const SE_TAX_DEDUCTION_RATE = 0.5; // Can deduct 50% of SE tax

// IRS Quarterly payment deadlines
const QUARTERLY_DEADLINES = [
 { quarter:'Q1', deadline:'April 15', months: [1, 2, 3] },
 { quarter:'Q2', deadline:'June 15', months: [4, 5] },
 { quarter:'Q3', deadline:'September 15', months: [6, 7, 8] },
 { quarter:'Q4', deadline:'January 15', months: [9, 10, 11, 12] },
];

// Fallback IRS rates if database fetch fails (updated annually)
const FALLBACK_IRS_RATES: Record<number, number> = {
 2024: 0.67,
 2025: 0.70,
 2026: 0.725,
};

export function TaxLiabilityEstimator({ merchantId, taxYear }: TaxLiabilityEstimatorProps) {
 const { user } = useAuth();
 const [filingStatus, setFilingStatus] = useState<'single' |'married_joint' |'married_separate'>('single');
 const [notificationsEnabled, setNotificationsEnabled] = useState(true);
 const [isRefreshing, setIsRefreshing] = useState(false);

 // Fetch merchant earnings from platform
 const { data: earningsData, isLoading: loadingEarnings, refetch: refetchEarnings } = useQuery({
 queryKey: ['merchant-dashboard', merchantId],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-dashboard');
 if (error) throw error;
 return data;
 },
 enabled: !!merchantId,
 staleTime: 1000 * 60 * 5,
 });

 // Fetch tax expenses
 const { data: expenses = [], refetch: refetchExpenses } = useQuery({
 queryKey: ['tax-expenses', merchantId, taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('merchant_tax_expenses')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', taxYear);
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 // Fetch mileage deductions
 const { data: mileageEntries = [], refetch: refetchMileage } = useQuery({
 queryKey: ['mileage-log', merchantId, taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('merchant_mileage_log')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', taxYear);
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 // Fetch vehicle expenses
 const { data: vehicleExpenses = [], refetch: refetchVehicle } = useQuery({
 queryKey: ['vehicle-expenses', merchantId, taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('merchant_vehicle_expenses')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', taxYear);
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 // Fetch IRS mileage rate for the selected tax year
 const { data: irsRateData } = useQuery({
 queryKey: ['irs-mileage-rate', taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('irs_mileage_rates')
 .select('rate_per_mile, notes, source_url')
 .eq('tax_year', taxYear)
 .single();
 if (error) return null;
 return data;
 },
 staleTime: 1000 * 60 * 60,
 });

 const IRS_MILEAGE_RATE = irsRateData?.rate_per_mile 
 ? Number(irsRateData.rate_per_mile) 
 : (FALLBACK_IRS_RATES[taxYear] || FALLBACK_IRS_RATES[2026]);

 // Fetch notification preferences (uses user_id, not merchantId)
 const { data: notificationPrefs, refetch: refetchNotifications } = useQuery({
 queryKey: ['merchant-tax-notifications', user?.id],
 queryFn: async () => {
 if (!user?.id) return null;
 const { data, error } = await supabase
 .from('notification_preferences')
 .select('*')
 .eq('user_id', user.id)
 .single();
 if (error && error.code !=='PGRST116') throw error;
 return data;
 },
 enabled: !!user?.id,
 });

 const handleRefresh = async () => {
 setIsRefreshing(true);
 try {
 await Promise.all([
 refetchEarnings(),
 refetchExpenses(),
 refetchMileage(),
 refetchVehicle(),
 ]);
 toast.success('Tax data refreshed');
 } catch {
 toast.error('Failed to refresh data');
 } finally {
 setIsRefreshing(false);
 }
 };

 // Calculate all tax-related values
 const taxCalculations = useMemo(() => {
 // Gross income from platform
 const grossIncome = earningsData?.total_sales || 0;
 
 // Total expenses from Tax Vault
 const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
 
 // Mileage deduction (business miles only)
 const businessMiles = mileageEntries
 .filter((m: any) => m.trip_type ==='pet_commute')
 .reduce((sum, m: any) => sum + Number(m.miles || 0), 0);
 const mileageDeduction = businessMiles * IRS_MILEAGE_RATE;
 
 // Vehicle expenses (for comparison)
 const totalVehicleExpenses = vehicleExpenses.reduce((sum, v: any) => sum + Number(v.amount || 0), 0);
 const totalMiles = mileageEntries.reduce((sum, m: any) => sum + Number(m.miles || 0), 0);
 const businessMileagePercentage = totalMiles > 0 ? (businessMiles / totalMiles) * 100 : 0;
 const vehicleExpenseDeduction = totalVehicleExpenses * (businessMileagePercentage / 100);
 
 // Use whichever vehicle deduction is higher
 const vehicleDeduction = Math.max(mileageDeduction, vehicleExpenseDeduction);
 
 // Total deductions
 const totalDeductions = totalExpenses + vehicleDeduction;
 
 // Net profit (Schedule C Line 31)
 const netProfit = Math.max(0, grossIncome - totalDeductions);
 
 // Self-employment tax calculation
 const seTaxableIncome = netProfit * 0.9235; // 92.35% of net profit
 const selfEmploymentTax = seTaxableIncome * SELF_EMPLOYMENT_TAX_RATE;
 const seTaxDeduction = selfEmploymentTax * SE_TAX_DEDUCTION_RATE;
 
 // Adjusted gross income for income tax
 const adjustedGrossIncome = netProfit - seTaxDeduction;
 
 // Standard deduction based on filing status
 const standardDeduction = filingStatus ==='married_joint' ? 29200 : 14600;
 const taxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction);
 
 // Calculate federal income tax
 let federalIncomeTax = 0;
 let remainingIncome = taxableIncome;
 
 for (const bracket of FEDERAL_TAX_BRACKETS) {
 if (remainingIncome <= 0) break;
 const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
 federalIncomeTax += taxableInBracket * bracket.rate;
 remainingIncome -= taxableInBracket;
 }
 
 // Total estimated tax liability
 const totalTaxLiability = selfEmploymentTax + federalIncomeTax;
 
 // Quarterly payment amount
 const quarterlyPayment = totalTaxLiability / 4;
 
 // Effective tax rate
 const effectiveTaxRate = netProfit > 0 ? (totalTaxLiability / netProfit) * 100 : 0;
 
 // Tax savings from deductions
 const taxSavingsFromDeductions = totalDeductions * (effectiveTaxRate / 100);
 
 return {
 grossIncome,
 totalExpenses,
 mileageDeduction,
 vehicleExpenseDeduction,
 vehicleDeduction,
 totalDeductions,
 netProfit,
 selfEmploymentTax,
 seTaxDeduction,
 adjustedGrossIncome,
 standardDeduction,
 taxableIncome,
 federalIncomeTax,
 totalTaxLiability,
 quarterlyPayment,
 effectiveTaxRate,
 taxSavingsFromDeductions,
 businessMiles,
 };
 }, [earningsData, expenses, mileageEntries, vehicleExpenses, filingStatus]);

 // Determine current quarter and next deadline
 const currentQuarter = useMemo(() => {
 const now = new Date();
 const month = now.getMonth() + 1;
 
 if (month <= 3) return { current:'Q1', next: QUARTERLY_DEADLINES[0] };
 if (month <= 5) return { current:'Q2', next: QUARTERLY_DEADLINES[1] };
 if (month <= 8) return { current:'Q3', next: QUARTERLY_DEADLINES[2] };
 return { current:'Q4', next: QUARTERLY_DEADLINES[3] };
 }, []);

 const handleToggleNotifications = async () => {
 try {
 const newValue = !notificationsEnabled;
 setNotificationsEnabled(newValue);
 
 // This would update the notification preference in the database
 toast.success(newValue 
 ?'Quarterly tax reminders enabled' 
 :'Quarterly tax reminders disabled'
 );
 } catch {
 toast.error('Failed to update notification settings');
 }
 };

 if (loadingEarnings) {
 return (
 <div className="flex items-center justify-center py-12">
 <LoadingSpinner />
 </div>
 );
 }

 const { 
 grossIncome, 
 totalExpenses, 
 totalDeductions,
 vehicleDeduction, 
 netProfit, 
 selfEmploymentTax, 
 federalIncomeTax, 
 totalTaxLiability, 
 quarterlyPayment,
 effectiveTaxRate,
 taxSavingsFromDeductions,
 businessMiles,
 } = taxCalculations;

 return (
 <div className="space-y-6">
 {/* Header with Refresh */}
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Calculator className="h-5 w-5 text-primary" />
 Real-Time Tax Liability Estimate
 </h3>
 <p className="text-sm text-muted-foreground">
 Based on your {taxYear} platform earnings and logged deductions
 </p>
 </div>
 <Button 
 variant="outline" 
 size="sm" 
 onClick={handleRefresh}
 disabled={isRefreshing}
 >
 <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ?'animate-spin' :''}`} />
 Refresh
 </Button>
 </div>

 {/* Filing Status & Notifications */}
 <Card>
 <CardContent className="pt-6">
 <div className="flex flex-col sm:flex-row gap-6 justify-between">
 <div className="flex-1">
 <Label className="text-sm font-medium mb-2 block">Filing Status</Label>
 <Select value={filingStatus} onValueChange={(v: any) => setFilingStatus(v)}>
 <SelectTrigger className="w-full max-w-[250px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="single">Single</SelectItem>
 <SelectItem value="married_joint">Married Filing Jointly</SelectItem>
 <SelectItem value="married_separate">Married Filing Separately</SelectItem>
 </SelectContent>
 </Select>
 </div>
 
 <div className="flex items-center gap-3">
 <Bell className="h-5 w-5 text-muted-foreground" />
 <div className="flex-1">
 <Label className="text-sm font-medium">Quarterly Tax Reminders</Label>
 <p className="text-xs text-muted-foreground">Get email & in-app notifications</p>
 </div>
 <Switch 
 checked={notificationsEnabled} 
 onCheckedChange={handleToggleNotifications}
 />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Main Tax Summary */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Estimated Tax Bill */}
 <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg flex items-center gap-2">
 <DollarSign className="h-5 w-5 text-primary" />
 Estimated Annual Tax
 </CardTitle>
 <CardDescription>Your projected {taxYear} tax liability</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-primary mb-4">
 ${totalTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </div>
 
 <div className="space-y-3">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Self-Employment Tax</span>
 <span className="font-medium">{Formatters.currency(selfEmploymentTax)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Federal Income Tax</span>
 <span className="font-medium">{Formatters.currency(federalIncomeTax)}</span>
 </div>
 <div className="border-t pt-2 flex justify-between text-sm">
 <span className="text-muted-foreground">Effective Tax Rate</span>
 <Badge variant={effectiveTaxRate < 25 ?'secondary' :'destructive'}>
 {Formatters.decimal(effectiveTaxRate, 1)}%
 </Badge>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Quarterly Payment */}
 <Card className="border-2 border-warning/20 bg-gradient-to-br from-warning/5 to-transparent">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg flex items-center gap-2">
 <Calendar className="h-5 w-5 text-warning" />
 Quarterly Payment Due
 </CardTitle>
 <CardDescription>
 Next: {currentQuarter.next.deadline} ({currentQuarter.next.quarter})
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="text-4xl font-bold text-warning mb-4">
 ${quarterlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </div>
 
 <Alert className="border-warning/30 bg-warning/10">
 <AlertTriangle className="h-4 w-4 text-warning" />
 <AlertTitle className="text-warning text-sm">Avoid Penalties</AlertTitle>
 <AlertDescription className="text-warning text-xs">
 Pay quarterly estimates to avoid underpayment penalties. 
 Safe harbor: Pay 100% of last year's tax or 90% of this year's.
 </AlertDescription>
 </Alert>
 </CardContent>
 </Card>
 </div>

 {/* Income & Deductions Breakdown */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Receipt className="h-5 w-5" />
 Income & Deductions Breakdown
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {/* Gross Income */}
 <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/30">
 <div className="flex items-center gap-3">
 <TrendingUp className="h-5 w-5 text-success" />
 <div>
 <p className="font-medium text-success">Gross Income (Platform Sales)</p>
 <p className="text-xs text-success">Total sales through PawBucks</p>
 </div>
 </div>
 <span className="text-xl font-bold text-success">
 +{Formatters.currency(grossIncome)}
 </span>
 </div>

 {/* Deductions */}
 <div className="space-y-2">
 <p className="text-sm font-medium text-muted-foreground">Deductions</p>
 
 <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
 <div className="flex items-center gap-3">
 <Receipt className="h-4 w-4 text-muted-foreground" />
 <span>Business Expenses (Tax Vault)</span>
 </div>
 <span className="font-medium text-destructive">
 -{Formatters.currency(totalExpenses)}
 </span>
 </div>

 <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
 <div className="flex items-center gap-3">
 <Car className="h-4 w-4 text-muted-foreground" />
 <div>
 <span>Vehicle Deduction</span>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger>
 <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">{Formatters.number(Math.round(businessMiles))} business miles @ ${IRS_MILEAGE_RATE}/mile ({taxYear} rate)</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 </div>
 <span className="font-medium text-destructive">
 -{Formatters.currency(vehicleDeduction)}
 </span>
 </div>
 </div>

 {/* Net Profit */}
 <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg border border-info/30 mt-4">
 <div className="flex items-center gap-3">
 <PiggyBank className="h-5 w-5 text-info" />
 <div>
 <p className="font-medium text-info">Net Profit (Taxable)</p>
 <p className="text-xs text-info">Schedule C Line 31</p>
 </div>
 </div>
 <span className="text-xl font-bold text-info">
 {Formatters.currency(netProfit)}
 </span>
 </div>

 {/* Tax Savings */}
 {taxSavingsFromDeductions > 0 && (
 <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/30">
 <div className="flex items-center gap-3">
 <CheckCircle2 className="h-5 w-5 text-success" />
 <div>
 <p className="font-medium text-success">Estimated Tax Savings</p>
 <p className="text-xs text-success">From logged deductions</p>
 </div>
 </div>
 <span className="text-lg font-bold text-success">
 {Formatters.currency(taxSavingsFromDeductions)}
 </span>
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 {/* Quarterly Timeline */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Calendar className="h-5 w-5" />
 {taxYear} Quarterly Payment Schedule
 </CardTitle>
 <CardDescription>
 IRS Form 1040-ES estimated tax payment deadlines
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {QUARTERLY_DEADLINES.map((q, idx) => {
 const isPast = idx < QUARTERLY_DEADLINES.findIndex(d => d.quarter === currentQuarter.current);
 const isCurrent = q.quarter === currentQuarter.current;
 
 return (
 <div 
 key={q.quarter}
 className={`p-4 rounded-lg border-2 text-center transition-all ${
 isCurrent 
 ?'border-primary bg-primary/5 ring-2 ring-primary/20' 
 : isPast 
 ?'border-muted bg-muted/30 opacity-60' 
 :'border-muted'
 }`}
 >
 <Badge variant={isCurrent ?'default' : isPast ?'secondary' :'outline'}>
 {q.quarter}
 </Badge>
 <p className="text-lg font-bold mt-2">
 ${Formatters.number(Math.round(quarterlyPayment))}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Due {q.deadline}
 </p>
 {isPast && (
 <CheckCircle2 className="h-4 w-4 text-success mx-auto mt-2" />
 )}
 {isCurrent && (
 <AlertTriangle className="h-4 w-4 text-warning mx-auto mt-2" />
 )}
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>

 {/* Disclaimer */}
 <Alert>
 <Info className="h-4 w-4" />
 <AlertTitle>Tax Estimate Disclaimer</AlertTitle>
 <AlertDescription className="text-xs text-muted-foreground">
 This is an estimate based on simplified calculations and current tax law. 
 It does not account for state taxes, QBI deductions, or other credits/deductions. 
 Consult a tax professional for accurate tax planning. Not tax advice.
 </AlertDescription>
 </Alert>
 </div>
 );
}

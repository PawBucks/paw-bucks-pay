import { useState } from'react';
import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { format } from'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Badge } from'@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from'@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Calendar } from'@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from'@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from'@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { Plus, Car, CalendarIcon, Trash2, MapPin, Calculator, PawPrint, User, Info, TrendingUp, Fuel, Wrench, Trophy, ChevronRight, Pencil } from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'sonner';
import { cn } from'@/lib/utils';

import { Formatters } from "@/utils/formatters";
// Helper to format date without timezone issues
const formatDateLocal = (date: Date): string => {
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2,'0');
 const day = String(date.getDate()).padStart(2,'0');
 return `${year}-${month}-${day}`;
};

// Helper to parse date string (YYYY-MM-DD) without timezone shift
const parseDateLocal = (dateStr: string): Date => {
 const [year, month, day] = dateStr.split('-').map(Number);
 return new Date(year, month - 1, day);
};

interface MileageEntry {
 id: string;
 merchant_id: string;
 trip_date: string;
 trip_type:'pet_commute' |'personal';
 miles: number;
 description: string | null;
 destination: string | null;
 vehicle_name: string | null;
 tax_year: number;
 created_at: string;
 start_odometer: number | null;
 end_odometer: number | null;
 start_location: string | null;
 end_location: string | null;
}

interface VehicleExpense {
 id: string;
 merchant_id: string;
 expense_date: string;
 expense_type: string;
 amount: number;
 description: string | null;
 vehicle_name: string | null;
 tax_year: number;
 created_at: string;
}

interface MileageLogProps {
 merchantId: string;
 taxYear: number;
}

// Fallback IRS rates if database fetch fails (updated annually)
const FALLBACK_IRS_RATES: Record<number, number> = {
 2024: 0.67,
 2025: 0.70,
 2026: 0.725,
};

const EXPENSE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
 gas: { label:'Gas/Fuel', icon: <Fuel className="h-4 w-4" /> },
 repairs: { label:'Repairs', icon: <Wrench className="h-4 w-4" /> },
 tires: { label:'Tires', icon: <Car className="h-4 w-4" /> },
 oil_change: { label:'Oil Change', icon: <Wrench className="h-4 w-4" /> },
 insurance: { label:'Insurance', icon: <Car className="h-4 w-4" /> },
 registration: { label:'Registration', icon: <Car className="h-4 w-4" /> },
 parking: { label:'Parking', icon: <MapPin className="h-4 w-4" /> },
 tolls: { label:'Tolls', icon: <MapPin className="h-4 w-4" /> },
 other: { label:'Other', icon: <Car className="h-4 w-4" /> },
};

export function MileageLog({ merchantId, taxYear }: MileageLogProps) {
 const queryClient = useQueryClient();
 
 // Mileage entry state
 const [isAddMileageOpen, setIsAddMileageOpen] = useState(false);
 const [editingEntry, setEditingEntry] = useState<MileageEntry | null>(null);
 const [tripDate, setTripDate] = useState<Date>(new Date());
 const [tripType, setTripType] = useState<'pet_commute' |'personal'>('pet_commute');
 const [miles, setMiles] = useState('');
 const [description, setDescription] = useState('');
 const [destination, setDestination] = useState('');
 const [vehicleName, setVehicleName] = useState('');
 const [startOdometer, setStartOdometer] = useState('');
 const [endOdometer, setEndOdometer] = useState('');
 const [startLocation, setStartLocation] = useState('');
 const [endLocation, setEndLocation] = useState('');
 const [useOdometer, setUseOdometer] = useState(true); // Default to odometer-based entry

 // Auto-calculate miles when odometers change
 const calculatedMiles = startOdometer && endOdometer 
 ? Math.max(0, parseFloat(endOdometer) - parseFloat(startOdometer))
 : null;

 // Vehicle expense state
 const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
 const [expenseDate, setExpenseDate] = useState<Date>(new Date());
 const [expenseType, setExpenseType] = useState<string>('gas');
 const [expenseAmount, setExpenseAmount] = useState('');
 const [expenseDescription, setExpenseDescription] = useState('');
 const [expenseVehicle, setExpenseVehicle] = useState('');

 // Fetch mileage entries
 const { data: entries = [], isLoading: loadingMileage } = useQuery({
 queryKey: ['mileage-log', merchantId, taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('merchant_mileage_log')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', taxYear)
 .order('trip_date', { ascending: false });

 if (error) throw error;
 return data as MileageEntry[];
 },
 enabled: !!merchantId,
 });

 // Fetch vehicle expenses
 const { data: vehicleExpenses = [], isLoading: loadingExpenses } = useQuery({
 queryKey: ['vehicle-expenses', merchantId, taxYear],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('merchant_vehicle_expenses')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('tax_year', taxYear)
 .order('expense_date', { ascending: false });

 if (error) throw error;
 return data as VehicleExpense[];
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

 if (error) {
 console.warn(`No IRS rate found for ${taxYear}, using fallback`);
 return null;
 }
 return data;
 },
 staleTime: 1000 * 60 * 60, // Cache for 1 hour - rates rarely change
 });

 // Use database rate or fallback
 const IRS_MILEAGE_RATE = irsRateData?.rate_per_mile 
 ? Number(irsRateData.rate_per_mile) 
 : (FALLBACK_IRS_RATES[taxYear] || FALLBACK_IRS_RATES[2026]);

 // Add mileage entry mutation
 const addMileageMutation = useMutation({
 mutationFn: async () => {
 // Use calculated miles if using odometer, otherwise use manual miles input
 const finalMiles = useOdometer && calculatedMiles !== null 
 ? calculatedMiles 
 : parseFloat(miles);

 const { error } = await supabase
 .from('merchant_mileage_log')
 .insert({
 merchant_id: merchantId,
 trip_date: formatDateLocal(tripDate),
 trip_type: tripType,
 miles: finalMiles,
 description: description || null,
 destination: destination || null,
 vehicle_name: vehicleName || null,
 tax_year: taxYear,
 start_odometer: useOdometer && startOdometer ? parseFloat(startOdometer) : null,
 end_odometer: useOdometer && endOdometer ? parseFloat(endOdometer) : null,
 start_location: startLocation || null,
 end_location: endLocation || null,
 });

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['mileage-log', merchantId, taxYear] });
 toast.success('Mileage entry added');
 resetMileageForm();
 setIsAddMileageOpen(false);
 },
 onError: (error) => {
 toast.error('Failed to add mileage entry');
 console.error(error);
 },
 });

 // Add vehicle expense mutation
 const addExpenseMutation = useMutation({
 mutationFn: async () => {
 const { error } = await supabase
 .from('merchant_vehicle_expenses')
 .insert({
 merchant_id: merchantId,
 expense_date: formatDateLocal(expenseDate),
 expense_type: expenseType,
 amount: parseFloat(expenseAmount),
 description: expenseDescription || null,
 vehicle_name: expenseVehicle || null,
 tax_year: taxYear,
 });

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['vehicle-expenses', merchantId, taxYear] });
 toast.success('Vehicle expense added');
 resetExpenseForm();
 setIsAddExpenseOpen(false);
 },
 onError: (error) => {
 toast.error('Failed to add vehicle expense');
 console.error(error);
 },
 });

 // Delete mileage entry
 const deleteMileageMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase
 .from('merchant_mileage_log')
 .delete()
 .eq('id', id);

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['mileage-log', merchantId, taxYear] });
 toast.success('Mileage entry deleted');
 },
 onError: (error) => {
 toast.error('Failed to delete mileage entry');
 console.error(error);
 },
 });

 // Update mileage entry mutation
 const updateMileageMutation = useMutation({
 mutationFn: async () => {
 if (!editingEntry) return;
 
 const finalMiles = useOdometer && calculatedMiles !== null 
 ? calculatedMiles 
 : parseFloat(miles);

 const { error } = await supabase
 .from('merchant_mileage_log')
 .update({
 trip_date: formatDateLocal(tripDate),
 trip_type: tripType,
 miles: finalMiles,
 description: description || null,
 destination: destination || null,
 vehicle_name: vehicleName || null,
 start_odometer: useOdometer && startOdometer ? parseFloat(startOdometer) : null,
 end_odometer: useOdometer && endOdometer ? parseFloat(endOdometer) : null,
 start_location: startLocation || null,
 end_location: endLocation || null,
 })
 .eq('id', editingEntry.id);

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['mileage-log', merchantId, taxYear] });
 toast.success('Mileage entry updated');
 resetMileageForm();
 setEditingEntry(null);
 setIsAddMileageOpen(false);
 },
 onError: (error) => {
 toast.error('Failed to update mileage entry');
 console.error(error);
 },
 });

 // Delete vehicle expense
 const deleteExpenseMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase
 .from('merchant_vehicle_expenses')
 .delete()
 .eq('id', id);

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['vehicle-expenses', merchantId, taxYear] });
 toast.success('Vehicle expense deleted');
 },
 onError: (error) => {
 toast.error('Failed to delete vehicle expense');
 console.error(error);
 },
 });

 const resetMileageForm = () => {
 setTripDate(new Date());
 setTripType('pet_commute');
 setMiles('');
 setDescription('');
 setDestination('');
 setVehicleName('');
 setStartOdometer('');
 setEndOdometer('');
 setStartLocation('');
 setEndLocation('');
 setUseOdometer(true);
 setEditingEntry(null);
 };

 const openEditMileage = (entry: MileageEntry) => {
 // Use helper to parse date without timezone issues
 setTripDate(parseDateLocal(entry.trip_date));
 setTripType(entry.trip_type);
 setMiles(entry.miles.toString());
 setDescription(entry.description ||'');
 setDestination(entry.destination ||'');
 setVehicleName(entry.vehicle_name ||'');
 setStartOdometer(entry.start_odometer?.toString() ||'');
 setEndOdometer(entry.end_odometer?.toString() ||'');
 setStartLocation(entry.start_location ||'');
 setEndLocation(entry.end_location ||'');
 setUseOdometer(!!(entry.start_odometer && entry.end_odometer));
 setEditingEntry(entry);
 setIsAddMileageOpen(true);
 };

 const resetExpenseForm = () => {
 setExpenseDate(new Date());
 setExpenseType('gas');
 setExpenseAmount('');
 setExpenseDescription('');
 setExpenseVehicle('');
 };

 // Calculate mileage statistics
 const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
 const petCommuteMiles = entries.filter(e => e.trip_type ==='pet_commute').reduce((sum, e) => sum + e.miles, 0);
 const personalMiles = entries.filter(e => e.trip_type ==='personal').reduce((sum, e) => sum + e.miles, 0);
 
 const petCommutePercentage = totalMiles > 0 ? (petCommuteMiles / totalMiles) * 100 : 0;
 const isExclusivelyBusiness = personalMiles === 0 && petCommuteMiles > 0;
 
 // Standard Mileage Rate calculation
 const standardMileageDeduction = petCommuteMiles * IRS_MILEAGE_RATE;

 // Actual Expenses calculation
 const totalVehicleExpenses = vehicleExpenses.reduce((sum, e) => sum + e.amount, 0);
 const actualExpensesDeduction = totalVehicleExpenses * (petCommutePercentage / 100);

 // Determine which method is better
 const betterMethod = standardMileageDeduction >= actualExpensesDeduction ?'standard' :'actual';
 const deductionDifference = Math.abs(standardMileageDeduction - actualExpensesDeduction);

 const handleMileageSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 
 if (useOdometer) {
 // Validate odometer readings
 if (!startOdometer || !endOdometer) {
 toast.error('Please enter both start and end odometer readings');
 return;
 }
 const start = parseFloat(startOdometer);
 const end = parseFloat(endOdometer);
 if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
 toast.error('Please enter valid odometer readings');
 return;
 }
 if (end <= start) {
 toast.error('End odometer must be greater than start odometer');
 return;
 }
 } else {
 // Validate manual miles input
 if (!miles || parseFloat(miles) <= 0) {
 toast.error('Please enter valid miles');
 return;
 }
 }
 
 if (editingEntry) {
 updateMileageMutation.mutate();
 } else {
 addMileageMutation.mutate();
 }
 };

 const handleExpenseSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
 toast.error('Please enter valid amount');
 return;
 }
 addExpenseMutation.mutate();
 };

 return (
 <div className="space-y-6">
 {/* Deduction Comparison Card */}
 <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calculator className="h-5 w-5 text-primary" />
 Vehicle Deduction Calculator
 </CardTitle>
 <CardDescription className="flex items-center gap-2">
 <span>Compare Standard Mileage Rate vs Actual Expenses to maximize your deduction</span>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger>
 <Info className="h-4 w-4 text-muted-foreground" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <p className="font-medium">{taxYear} IRS Standard Mileage Rate: ${IRS_MILEAGE_RATE}/mile</p>
 {irsRateData?.notes && <p className="text-xs mt-1">{irsRateData.notes}</p>}
 <p className="text-xs mt-1 text-muted-foreground">
 Source: <a href="https://www.irs.gov/tax-professionals/standard-mileage-rates" target="_blank" rel="noopener noreferrer" className="underline">IRS.gov</a>
 </p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {/* Standard Mileage Rate */}
 <Card className={cn(
"relative overflow-hidden transition-all",
 betterMethod ==='standard' && totalMiles > 0 && totalVehicleExpenses > 0
 ?"border-2 border-success bg-success/5" 
 :"border"
 )}>
 {betterMethod ==='standard' && totalMiles > 0 && totalVehicleExpenses > 0 && (
 <div className="absolute top-2 right-2">
 <Badge className="bg-success text-white">
 <Trophy className="h-3 w-3 mr-1" />
 Best Option
 </Badge>
 </div>
 )}
 <CardContent className="pt-6">
 <div className="space-y-2">
 <p className="text-sm font-medium text-muted-foreground">Standard Mileage Rate</p>
 <p className="text-3xl font-bold text-success">{Formatters.currency(standardMileageDeduction)}</p>
 <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
 <p>{Formatters.decimal(petCommuteMiles, 1)} business miles × ${IRS_MILEAGE_RATE}/mi</p>
 <p className="font-medium">
 {isExclusivelyBusiness ?'100% of miles' : `${Formatters.decimal(petCommutePercentage, 1)}% of miles`} deductible
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* VS Indicator */}
 <div className="flex items-center justify-center">
 <div className="hidden md:flex flex-col items-center gap-2">
 <div className="text-2xl font-bold text-muted-foreground">VS</div>
 {totalMiles > 0 && totalVehicleExpenses > 0 && (
 <div className="text-center">
 <p className="text-xs text-muted-foreground">Difference</p>
 <p className="text-lg font-bold text-primary">{Formatters.currency(deductionDifference)}</p>
 </div>
 )}
 </div>
 </div>

 {/* Actual Expenses */}
 <Card className={cn(
"relative overflow-hidden transition-all",
 betterMethod ==='actual' && totalMiles > 0 && totalVehicleExpenses > 0
 ?"border-2 border-success bg-success/5" 
 :"border"
 )}>
 {betterMethod ==='actual' && totalMiles > 0 && totalVehicleExpenses > 0 && (
 <div className="absolute top-2 right-2">
 <Badge className="bg-success text-white">
 <Trophy className="h-3 w-3 mr-1" />
 Best Option
 </Badge>
 </div>
 )}
 <CardContent className="pt-6">
 <div className="space-y-2">
 <p className="text-sm font-medium text-muted-foreground">Actual Expenses</p>
 <p className="text-3xl font-bold text-info">{Formatters.currency(actualExpensesDeduction)}</p>
 <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
 <p>{Formatters.currency(totalVehicleExpenses)} total expenses</p>
 <p className="font-medium">
 × {Formatters.decimal(petCommutePercentage, 1)}% business use
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Quick Tips */}
 {totalMiles === 0 && totalVehicleExpenses === 0 && (
 <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
 <p className="flex items-center gap-2">
 <Info className="h-4 w-4" />
 Log your mileage and vehicle expenses below to compare deduction methods
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Tabs for Mileage & Expenses */}
 <Tabs defaultValue="mileage" className="space-y-4">
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="mileage" className="flex items-center gap-2">
 <Car className="h-4 w-4" />
 Mileage Log ({entries.length})
 </TabsTrigger>
 <TabsTrigger value="expenses" className="flex items-center gap-2">
 <Fuel className="h-4 w-4" />
 Vehicle Expenses ({vehicleExpenses.length})
 </TabsTrigger>
 </TabsList>

 {/* Mileage Tab */}
 <TabsContent value="mileage">
 {/* Summary Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Miles</p>
 <p className="text-2xl font-bold">{Formatters.decimal(totalMiles, 1)}</p>
 </div>
 <Car className="h-8 w-8 text-primary opacity-80" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Business</p>
 <p className="text-2xl font-bold">{Formatters.decimal(petCommuteMiles, 1)} mi</p>
 </div>
 <PawPrint className="h-8 w-8 text-success opacity-80" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Business Use</p>
 <p className="text-2xl font-bold">
 {isExclusivelyBusiness ?'100%' : `${Formatters.decimal(petCommutePercentage, 1)}%`}
 </p>
 </div>
 <TrendingUp className="h-8 w-8 text-warning opacity-80" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Mileage Table */}
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
 <div>
 <CardTitle className="flex items-center gap-2">
 <Car className="h-5 w-5 text-primary" />
 Mileage Entries
 </CardTitle>
 <CardDescription>Track your business and personal trips</CardDescription>
 </div>
 <Dialog open={isAddMileageOpen} onOpenChange={(open) => {
 setIsAddMileageOpen(open);
 if (!open) {
 resetMileageForm();
 }
 }}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="mr-2 h-4 w-4" />
 Log Trip
 </Button>
 </DialogTrigger>
 <DialogContent>
 <form onSubmit={handleMileageSubmit}>
 <DialogHeader>
 <DialogTitle>{editingEntry ?'Edit Mileage Entry' :'Log Mileage'}</DialogTitle>
 <DialogDescription>
 {editingEntry ?'Update the details for this trip' :'Record a trip for your mileage deduction calculations'}
 </DialogDescription>
 </DialogHeader>

 <div className="grid gap-4 py-4">
 <div className="grid gap-2">
 <Label htmlFor="trip-type">Trip Type</Label>
 <Select value={tripType} onValueChange={(v) => setTripType(v as'pet_commute' |'personal')}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pet_commute">
 <span className="flex items-center gap-2">
 <PawPrint className="h-4 w-4 text-success" />
 Business
 </span>
 </SelectItem>
 <SelectItem value="personal">
 <span className="flex items-center gap-2">
 <User className="h-4 w-4 text-muted-foreground" />
 Personal Use
 </span>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="grid gap-2">
 <Label>Trip Date</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 className={cn(
"justify-start text-left font-normal",
 !tripDate &&"text-muted-foreground"
 )}
 >
 <CalendarIcon className="mr-2 h-4 w-4" />
 {tripDate ? format(tripDate,'PPP') :'Select date'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={tripDate}
 onSelect={(date) => date && setTripDate(date)}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 </div>

 {/* Entry Mode Toggle */}
 <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
 <div className="flex items-center gap-2">
 <Car className="h-4 w-4 text-primary" />
 <Label htmlFor="entry-mode" className="text-sm font-medium cursor-pointer">
 Use Odometer Readings
 </Label>
 </div>
 <Button
 type="button"
 variant={useOdometer ?"default" :"outline"}
 size="sm"
 onClick={() => setUseOdometer(!useOdometer)}
 className="h-8"
 >
 {useOdometer ?'On' :'Off'}
 </Button>
 </div>

 {useOdometer ? (
 <>
 {/* Odometer-based Entry */}
 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-2">
 <Label htmlFor="start-odometer" className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-success" />
 Start Trip
 </Label>
 <Input
 id="start-odometer"
 type="number"
 step="0.1"
 min="0"
 placeholder="e.g., 45,230"
 value={startOdometer}
 onChange={(e) => setStartOdometer(e.target.value)}
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="end-odometer" className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-destructive" />
 End Trip
 </Label>
 <Input
 id="end-odometer"
 type="number"
 step="0.1"
 min="0"
 placeholder="e.g., 45,242"
 value={endOdometer}
 onChange={(e) => setEndOdometer(e.target.value)}
 />
 </div>
 </div>

 {/* Auto-calculated Miles Display */}
 {calculatedMiles !== null && calculatedMiles >= 0 && (
 <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground flex items-center gap-2">
 <Calculator className="h-4 w-4" />
 Calculated Miles
 </span>
 <span className="text-lg font-bold text-success">
 {Formatters.decimal(calculatedMiles, 1)} mi
 </span>
 </div>
 {calculatedMiles === 0 && startOdometer && endOdometer && (
 <p className="text-xs text-warning mt-1">
 End odometer should be greater than start
 </p>
 )}
 </div>
 )}
 </>
 ) : (
 <div className="grid gap-2">
 <Label htmlFor="miles">Miles</Label>
 <Input
 id="miles"
 type="number"
 step="0.1"
 min="0.1"
 placeholder="e.g., 12.5"
 value={miles}
 onChange={(e) => setMiles(e.target.value)}
 />
 </div>
 )}

 {/* Start & End Location */}
 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-2">
 <Label htmlFor="start-location" className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-success" />
 Start Location
 </Label>
 <Input
 id="start-location"
 placeholder="e.g., Home, 123 Main St"
 value={startLocation}
 onChange={(e) => setStartLocation(e.target.value)}
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="end-location" className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-destructive" />
 End Location
 </Label>
 <Input
 id="end-location"
 placeholder="e.g., Happy Paws Grooming"
 value={endLocation}
 onChange={(e) => setEndLocation(e.target.value)}
 />
 </div>
 </div>

 <div className="grid gap-2">
 <Label htmlFor="description">Purpose/Notes (Optional)</Label>
 <Input
 id="description"
 placeholder="e.g., Client pickup for grooming"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 />
 </div>

 <div className="grid gap-2">
 <Label htmlFor="vehicle">Vehicle Name (Optional)</Label>
 <Input
 id="vehicle"
 placeholder="e.g., Pet Mobile Van"
 value={vehicleName}
 onChange={(e) => setVehicleName(e.target.value)}
 />
 </div>
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setIsAddMileageOpen(false)}>
 Cancel
 </Button>
 <Button 
 type="submit" 
 disabled={editingEntry ? updateMileageMutation.isPending : addMileageMutation.isPending}
 >
 {editingEntry 
 ? (updateMileageMutation.isPending ?'Saving...' :'Save Changes')
 : (addMileageMutation.isPending ?'Adding...' :'Add Entry')
 }
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 </CardHeader>
 <CardContent>
 {loadingMileage ? (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 ) : entries.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p className="font-medium">No mileage entries yet</p>
 <p className="text-sm">Start logging your business trips to track deductible miles</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Route</TableHead>
 <TableHead>Odometer</TableHead>
 <TableHead>Miles</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {entries.map((entry) => (
 <TableRow key={entry.id}>
 <TableCell className="font-medium">
 {format(parseDateLocal(entry.trip_date),'MMM d, yyyy')}
 </TableCell>
 <TableCell>
 <Badge 
 variant={entry.trip_type ==='pet_commute' ?'default' :'secondary'}
 className={cn(
 entry.trip_type ==='pet_commute' 
 ?'bg-success/10 text-success border-success/20 hover:bg-success/20' 
 :''
 )}
 >
 {entry.trip_type ==='pet_commute' ? (
 <><PawPrint className="h-3 w-3 mr-1" /> Business</>
 ) : (
 <><User className="h-3 w-3 mr-1" /> Personal</>
 )}
 </Badge>
 </TableCell>
 <TableCell>
 {entry.start_location || entry.end_location ? (
 <div className="text-xs space-y-0.5">
 {entry.start_location && (
 <div className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-success shrink-0" />
 <span className="truncate max-w-[120px]" title={entry.start_location}>{entry.start_location}</span>
 </div>
 )}
 {entry.end_location && (
 <div className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-destructive shrink-0" />
 <span className="truncate max-w-[120px]" title={entry.end_location}>{entry.end_location}</span>
 </div>
 )}
 </div>
 ) : (
 <span className="text-muted-foreground text-xs">—</span>
 )}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 {entry.start_odometer && entry.end_odometer ? (
 <span>{entry.start_odometer.toLocaleString()} → {entry.end_odometer.toLocaleString()}</span>
 ) : (
 <span>Manual</span>
 )}
 </TableCell>
 <TableCell className="font-mono font-semibold">{Formatters.decimal(entry.miles, 1)}</TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => openEditMileage(entry)}
 >
 <Pencil className="h-4 w-4 text-muted-foreground" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => deleteMileageMutation.mutate(entry.id)}
 disabled={deleteMileageMutation.isPending}
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Vehicle Expenses Tab */}
 <TabsContent value="expenses">
 {/* Expense Summary */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Expenses</p>
 <p className="text-2xl font-bold">{Formatters.currency(totalVehicleExpenses)}</p>
 </div>
 <Fuel className="h-8 w-8 text-info opacity-80" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Business Portion</p>
 <p className="text-2xl font-bold">{Formatters.currency(actualExpensesDeduction)}</p>
 </div>
 <Calculator className="h-8 w-8 text-success opacity-80" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Entries</p>
 <p className="text-2xl font-bold">{vehicleExpenses.length}</p>
 </div>
 <Wrench className="h-8 w-8 text-warning opacity-80" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Expense Table */}
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
 <div>
 <CardTitle className="flex items-center gap-2">
 <Fuel className="h-5 w-5 text-primary" />
 Vehicle Expenses
 </CardTitle>
 <CardDescription>Track gas, repairs, tires, and other vehicle costs</CardDescription>
 </div>
 <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="mr-2 h-4 w-4" />
 Add Expense
 </Button>
 </DialogTrigger>
 <DialogContent>
 <form onSubmit={handleExpenseSubmit}>
 <DialogHeader>
 <DialogTitle>Add Vehicle Expense</DialogTitle>
 <DialogDescription>
 Record vehicle expenses for the Actual Expenses deduction method
 </DialogDescription>
 </DialogHeader>

 <div className="grid gap-4 py-4">
 <div className="grid gap-2">
 <Label htmlFor="expense-type">Expense Type</Label>
 <Select value={expenseType} onValueChange={setExpenseType}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {Object.entries(EXPENSE_TYPE_LABELS).map(([key, { label, icon }]) => (
 <SelectItem key={key} value={key}>
 <span className="flex items-center gap-2">
 {icon}
 {label}
 </span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="grid gap-2">
 <Label>Expense Date</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 className={cn(
"justify-start text-left font-normal",
 !expenseDate &&"text-muted-foreground"
 )}
 >
 <CalendarIcon className="mr-2 h-4 w-4" />
 {expenseDate ? format(expenseDate,'PPP') :'Select date'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={expenseDate}
 onSelect={(date) => date && setExpenseDate(date)}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 </div>

 <div className="grid gap-2">
 <Label htmlFor="expense-amount">Amount ($)</Label>
 <Input
 id="expense-amount"
 type="number"
 step="0.01"
 min="0.01"
 placeholder="e.g., 45.00"
 value={expenseAmount}
 onChange={(e) => setExpenseAmount(e.target.value)}
 required
 />
 </div>

 <div className="grid gap-2">
 <Label htmlFor="expense-description">Description (Optional)</Label>
 <Input
 id="expense-description"
 placeholder="e.g., Shell station fill-up"
 value={expenseDescription}
 onChange={(e) => setExpenseDescription(e.target.value)}
 />
 </div>

 <div className="grid gap-2">
 <Label htmlFor="expense-vehicle">Vehicle Name (Optional)</Label>
 <Input
 id="expense-vehicle"
 placeholder="e.g., Pet Mobile Van"
 value={expenseVehicle}
 onChange={(e) => setExpenseVehicle(e.target.value)}
 />
 </div>
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setIsAddExpenseOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={addExpenseMutation.isPending}>
 {addExpenseMutation.isPending ?'Adding...' :'Add Expense'}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 </CardHeader>
 <CardContent>
 {loadingExpenses ? (
 <div className="flex justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 ) : vehicleExpenses.length === 0 ? (
 <div className="text-center py-12 text-muted-foreground">
 <Fuel className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p className="font-medium">No vehicle expenses yet</p>
 <p className="text-sm">Add gas, repairs, and other vehicle costs to compare deduction methods</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Amount</TableHead>
 <TableHead>Description</TableHead>
 <TableHead>Vehicle</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {vehicleExpenses.map((expense) => (
 <TableRow key={expense.id}>
 <TableCell className="font-medium">
 {format(parseDateLocal(expense.expense_date),'MMM d, yyyy')}
 </TableCell>
 <TableCell>
 <Badge variant="outline" className="flex items-center gap-1 w-fit">
 {EXPENSE_TYPE_LABELS[expense.expense_type]?.icon}
 {EXPENSE_TYPE_LABELS[expense.expense_type]?.label || expense.expense_type}
 </Badge>
 </TableCell>
 <TableCell className="font-mono font-medium">{Formatters.currency(expense.amount)}</TableCell>
 <TableCell className="max-w-[200px] truncate">
 {expense.description || <span className="text-muted-foreground">—</span>}
 </TableCell>
 <TableCell>
 {expense.vehicle_name || <span className="text-muted-foreground">—</span>}
 </TableCell>
 <TableCell className="text-right">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => deleteExpenseMutation.mutate(expense.id)}
 disabled={deleteExpenseMutation.isPending}
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* IRS Info Card */}
 <Card className="border-dashed">
 <CardContent className="pt-6">
 <div className="flex items-start gap-4">
 <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
 <div className="text-sm text-muted-foreground">
 <p className="font-medium text-foreground mb-2">IRS Vehicle Deduction Methods</p>
 <div className="grid md:grid-cols-2 gap-4">
 <div>
 <p className="font-medium text-foreground flex items-center gap-1">
 <ChevronRight className="h-4 w-4" />
 Standard Mileage Rate
 </p>
 <p className="ml-5">
 Deduct ${IRS_MILEAGE_RATE} per business mile driven. Simple to track—just log your trips.
 </p>
 </div>
 <div>
 <p className="font-medium text-foreground flex items-center gap-1">
 <ChevronRight className="h-4 w-4" />
 Actual Expenses
 </p>
 <p className="ml-5">
 Deduct the business-use percentage of actual vehicle costs (gas, repairs, tires, insurance, etc.).
 </p>
 </div>
 </div>
 <p className="mt-3 text-xs">
 <strong>Tip:</strong> You must choose one method and generally stick with it for that vehicle. Compare both above to see which yields a higher deduction.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

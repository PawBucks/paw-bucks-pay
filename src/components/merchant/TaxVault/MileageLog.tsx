import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Car, CalendarIcon, Trash2, MapPin, Calculator, PawPrint, User, Info, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MileageEntry {
  id: string;
  merchant_id: string;
  trip_date: string;
  trip_type: 'pet_commute' | 'personal';
  miles: number;
  description: string | null;
  destination: string | null;
  vehicle_name: string | null;
  tax_year: number;
  created_at: string;
}

interface MileageLogProps {
  merchantId: string;
  taxYear: number;
}

// IRS standard mileage rate for 2024/2025 (update as needed)
const IRS_MILEAGE_RATE = 0.67; // $0.67 per mile for 2024

export function MileageLog({ merchantId, taxYear }: MileageLogProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [tripDate, setTripDate] = useState<Date>(new Date());
  const [tripType, setTripType] = useState<'pet_commute' | 'personal'>('pet_commute');
  const [miles, setMiles] = useState('');
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleName, setVehicleName] = useState('');

  // Fetch mileage entries
  const { data: entries = [], isLoading } = useQuery({
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

  // Add mileage entry
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('merchant_mileage_log')
        .insert({
          merchant_id: merchantId,
          trip_date: format(tripDate, 'yyyy-MM-dd'),
          trip_type: tripType,
          miles: parseFloat(miles),
          description: description || null,
          destination: destination || null,
          vehicle_name: vehicleName || null,
          tax_year: taxYear,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage-log', merchantId, taxYear] });
      toast.success('Mileage entry added');
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to add mileage entry');
      console.error(error);
    },
  });

  // Delete mileage entry
  const deleteMutation = useMutation({
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

  const resetForm = () => {
    setTripDate(new Date());
    setTripType('pet_commute');
    setMiles('');
    setDescription('');
    setDestination('');
    setVehicleName('');
  };

  // Calculate statistics
  const totalMiles = entries.reduce((sum, e) => sum + e.miles, 0);
  const petCommuteMiles = entries.filter(e => e.trip_type === 'pet_commute').reduce((sum, e) => sum + e.miles, 0);
  const personalMiles = entries.filter(e => e.trip_type === 'personal').reduce((sum, e) => sum + e.miles, 0);
  
  const petCommutePercentage = totalMiles > 0 ? (petCommuteMiles / totalMiles) * 100 : 0;
  const isExclusivelyBusiness = personalMiles === 0 && petCommuteMiles > 0;
  
  const deductibleAmount = petCommuteMiles * IRS_MILEAGE_RATE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!miles || parseFloat(miles) <= 0) {
      toast.error('Please enter valid miles');
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Miles</p>
                <p className="text-2xl font-bold">{totalMiles.toFixed(1)}</p>
              </div>
              <Car className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pet Commutes</p>
                <p className="text-2xl font-bold">{petCommuteMiles.toFixed(1)} mi</p>
              </div>
              <PawPrint className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between cursor-help">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Deductible %
                        <Info className="h-3 w-3" />
                      </p>
                      <p className="text-2xl font-bold">
                        {isExclusivelyBusiness ? '100%' : `${petCommutePercentage.toFixed(1)}%`}
                      </p>
                    </div>
                    <Calculator className="h-8 w-8 text-amber-500 opacity-80" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">
                    {isExclusivelyBusiness 
                      ? '100% of miles deductible' 
                      : `${petCommutePercentage.toFixed(1)}% of miles deductible for Pet Commutes`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isExclusivelyBusiness 
                      ? 'Vehicle used exclusively for pet business commutes'
                      : `Mixed use: ${petCommuteMiles.toFixed(1)} business miles / ${totalMiles.toFixed(1)} total miles`
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between cursor-help">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Deductible Amount
                        <Info className="h-3 w-3" />
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">${deductibleAmount.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-emerald-500 opacity-80" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Based on IRS rate of ${IRS_MILEAGE_RATE}/mile × {petCommuteMiles.toFixed(1)} business miles
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Button & Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Mileage Log
            </CardTitle>
            <CardDescription>Track your pet business commutes and personal trips</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Log Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Log Mileage</DialogTitle>
                  <DialogDescription>
                    Record a trip for your mileage deduction calculations
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="trip-type">Trip Type</Label>
                    <Select value={tripType} onValueChange={(v) => setTripType(v as 'pet_commute' | 'personal')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pet_commute">
                          <span className="flex items-center gap-2">
                            <PawPrint className="h-4 w-4 text-green-500" />
                            Pet Commute (Business)
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
                            !tripDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {tripDate ? format(tripDate, 'PPP') : 'Select date'}
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
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="destination">Destination (Optional)</Label>
                    <Input
                      id="destination"
                      placeholder="e.g., Happy Paws Grooming"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    />
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
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addMutation.isPending}>
                    {addMutation.isPending ? 'Adding...' : 'Add Entry'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No mileage entries yet</p>
              <p className="text-sm">Start logging your pet commutes to track deductible miles</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Miles</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.trip_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={entry.trip_type === 'pet_commute' ? 'default' : 'secondary'}
                          className={cn(
                            entry.trip_type === 'pet_commute' 
                              ? 'bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20' 
                              : ''
                          )}
                        >
                          {entry.trip_type === 'pet_commute' ? (
                            <><PawPrint className="h-3 w-3 mr-1" /> Pet Commute</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" /> Personal</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{entry.miles.toFixed(1)}</TableCell>
                      <TableCell>
                        {entry.destination ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {entry.destination}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.description || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          disabled={deleteMutation.isPending}
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

      {/* IRS Info Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">IRS Mileage Deduction Guide</p>
              <p>
                The current IRS standard mileage rate is <strong>${IRS_MILEAGE_RATE}/mile</strong> for business use. 
                If your vehicle is used exclusively for pet business commutes, you can deduct 100% of your miles. 
                For mixed-use vehicles, only the business-use percentage is deductible.
              </p>
              <p className="mt-2">
                <strong>Tip:</strong> Keep detailed records including dates, destinations, and business purpose for each trip.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

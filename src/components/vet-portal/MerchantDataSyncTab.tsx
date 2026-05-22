import { useState } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Activity, AlertTriangle, BarChart3, Calendar, Dog, DollarSign, Heart, Search, TrendingDown, TrendingUp } from "lucide-react";
import { PawBucksIcon } from "@/components/PawBucksIcon";
import { format, subDays, differenceInDays } from"date-fns";

import { Formatters } from "@/utils/formatters";
interface MerchantDataSyncTabProps {
 vetId: string;
}

export function MerchantDataSyncTab({ vetId }: MerchantDataSyncTabProps) {
 const [selectedPetId, setSelectedPetId] = useState<string>("all");
 const [searchTerm, setSearchTerm] = useState("");

 // Fetch patients
 const { data: patients } = useQuery({
 queryKey: ["vet-patients-for-sync", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("vet_messages")
 .select("pet_id, pet:pet_profiles(id, name, type, user_id)")
 .eq("vet_id", vetId);

 if (error) throw error;
 
 const uniquePets = new Map();
 data?.forEach(item => {
 if (item.pet && !uniquePets.has(item.pet.id)) {
 uniquePets.set(item.pet.id, item.pet);
 }
 });
 return Array.from(uniquePets.values());
 },
 });

 // Fetch health expense data for patients' owners
 const { data: healthExpenses, isLoading: expensesLoading } = useQuery({
 queryKey: ["owner-health-expenses", vetId, selectedPetId],
 queryFn: async () => {
 if (!patients || patients.length === 0) return [];

 const userIds = patients.map((p: any) => p.user_id);
 
 let query = supabase
 .from("transactions")
 .select(`
 *,
 merchant:merchants!transactions_merchant_id_fkey(business_name, business_type)
 `)
 .in("user_id", userIds)
 .eq("status","completed")
 .gte("created_at", subDays(new Date(), 90).toISOString())
 .order("created_at", { ascending: false })
 .limit(100);

 if (selectedPetId !=="all") {
 const selectedPet = patients.find((p: any) => p.id === selectedPetId);
 if (selectedPet) {
 query = query.eq("user_id", selectedPet.user_id);
 }
 }

 const { data, error } = await query;
 if (error) throw error;
 return data;
 },
 enabled: !!patients && patients.length > 0,
 });

 // Fetch activity data (from walker/runner services)
 const { data: activityData, isLoading: activityLoading } = useQuery({
 queryKey: ["pet-activity-data", vetId, selectedPetId],
 queryFn: async () => {
 if (!patients || patients.length === 0) return [];

 const petIds = selectedPetId ==="all" 
 ? patients.map((p: any) => p.id)
 : [selectedPetId];

 // Fetch booking history from walkers/runners/hikers
 const { data, error } = await supabase
 .from("service_bookings")
 .select(`
 *,
 service:merchant_services(
 name,
 merchant:merchants(business_name, business_type)
 )
 `)
 .in("pet_id", petIds)
 .gte("booking_date", subDays(new Date(), 30).toISOString())
 .order("booking_date", { ascending: false });

 if (error) throw error;
 return data || [];
 },
 enabled: !!patients && patients.length > 0,
 });

 // Calculate activity trends
 const activityTrends = patients?.map((pet: any) => {
 const petActivities = activityData?.filter((a: any) => a.pet_id === pet.id) || [];
 const recentWeek = petActivities.filter((a: any) => 
 differenceInDays(new Date(), new Date(a.booking_date)) <= 7
 ).length;
 const previousWeek = petActivities.filter((a: any) => {
 const days = differenceInDays(new Date(), new Date(a.booking_date));
 return days > 7 && days <= 14;
 }).length;

 const trend = recentWeek - previousWeek;
 const hasAlert = trend < -2; // Alert if activity dropped significantly

 return {
 pet,
 recentWeek,
 previousWeek,
 trend,
 hasAlert,
 totalActivities: petActivities.length,
 };
 }) || [];

 const alertPets = activityTrends.filter(t => t.hasAlert);

 const filteredPatients = patients?.filter((pet: any) =>
 pet.name.toLowerCase().includes(searchTerm.toLowerCase())
 );

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
 Merchant Data Sync
 </h2>
 <p className="text-sm text-muted-foreground">
 View health expenses and activity data from your patients' owners
 </p>
 </div>

 {/* Activity Alerts */}
 {alertPets.length > 0 && (
 <Card className="p-4 bg-warning/10 /30 border-warning/20">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
 <div>
 <h4 className="font-medium text-warning">
 Activity Drop Detected
 </h4>
 <p className="text-sm text-warning mb-2">
 The following pets have shown a significant decrease in activity:
 </p>
 <div className="flex flex-wrap gap-2">
 {alertPets.map(({ pet }) => (
 <Badge 
 key={pet.id} 
 variant="outline" 
 className="bg-warning/10 border-warning/40"
 >
 <Dog className="h-3 w-3 mr-1" aria-hidden="true" />
 {pet.name}
 </Badge>
 ))}
 </div>
 </div>
 </div>
 </Card>
 )}

 {/* Filters */}
 <div className="flex gap-4">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search patients..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 <Select value={selectedPetId} onValueChange={setSelectedPetId}>
 <SelectTrigger className="w-[200px]">
 <SelectValue placeholder="Filter by pet" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Patients</SelectItem>
 {filteredPatients?.map((pet: any) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Activity Trends Grid */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {activityTrends.slice(0, 6).map(({ pet, recentWeek, previousWeek, trend, hasAlert, totalActivities }) => (
 <Card key={pet.id} className={`p-4 ${hasAlert ?'border-warning/40 bg-warning/50 /20' :''}`}>
 <div className="flex items-start justify-between">
 <div>
 <h4 className="font-medium">{pet.name}</h4>
 <p className="text-xs text-muted-foreground">{pet.type}</p>
 </div>
 {hasAlert && (
 <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40">
 <AlertTriangle className="h-3 w-3 mr-1" />
 Alert
 </Badge>
 )}
 </div>
 <div className="mt-4 grid grid-cols-2 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">This Week</p>
 <div className="flex items-center gap-1">
 <PawBucksIcon className="h-4 w-4" aria-hidden="true" />
 <span className="text-lg font-bold">{recentWeek}</span>
 </div>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">vs Last Week</p>
 <div className="flex items-center gap-1">
 {trend > 0 ? (
 <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
 ) : trend < 0 ? (
 <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
 ) : (
 <span className="h-4 w-4 text-muted-foreground">—</span>
 )}
 <span className={`text-lg font-bold ${
 trend > 0 ?'text-success' : trend < 0 ?'text-destructive' :''
 }`}>
 {trend > 0 ?'+' :''}{trend}
 </span>
 </div>
 </div>
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 {totalActivities} total activities in last 30 days
 </p>
 </Card>
 ))}
 </div>

 {/* Health Expense History */}
 <Card>
 <div className="p-4 border-b">
 <h3 className="font-semibold flex items-center gap-2">
 <DollarSign className="h-4 w-4" aria-hidden="true" />
 Owner Health Expense History (Last 90 Days)
 </h3>
 </div>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Owner</TableHead>
 <TableHead>Merchant</TableHead>
 <TableHead>Category</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {expensesLoading ? (
 <TableRow>
 <TableCell colSpan={5} className="text-center py-8">
 Loading expense data...
 </TableCell>
 </TableRow>
 ) : healthExpenses && healthExpenses.length > 0 ? (
 healthExpenses.slice(0, 20).map((expense: any) => (
 <TableRow key={expense.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 {format(new Date(expense.created_at),"MMM d, yyyy")}
 </div>
 </TableCell>
 <TableCell>
 {patients?.find((p: any) => p.user_id === expense.user_id)?.name ||"Unknown"}
 </TableCell>
 <TableCell>
 <div className="font-medium">{expense.merchant?.business_name}</div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">
 {expense.merchant?.business_type ||"Other"}
 </Badge>
 </TableCell>
 <TableCell className="text-right font-medium">
 {Formatters.currency(expense.amount ?? 0)}
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
 <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
 No expense data available for your patients' owners
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>

 {/* Info Card */}
 <Card className="p-4 bg-info/10 /30 border-info/20">
 <div className="flex items-start gap-3">
 <BarChart3 className="h-5 w-5 text-info mt-0.5" aria-hidden="true" />
 <div>
 <h4 className="font-medium text-info">
 Proactive Health Monitoring
 </h4>
 <p className="text-sm text-info">
 This dashboard syncs data from your patients' walkers, runners, and other care providers. 
 Activity drops can be early indicators of health issues—you'll see this data before owners 
 even mention it during their visit.
 </p>
 </div>
 </div>
 </Card>
 </div>
 );
}

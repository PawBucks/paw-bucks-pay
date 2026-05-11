import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { Switch } from"@/components/ui/switch";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { toast } from"sonner";
import { Heart, Plus, Edit, Trash2, CheckCircle, Dog, Cat, Bird } from "lucide-react";
import { format } from"date-fns";

interface WellnessPlansTabProps {
 vetId: string;
}

const petTypeIcons: Record<string, typeof Dog> = {
 dog: Dog,
 cat: Cat,
 bird: Bird,
 other: Heart,
 all: Heart,
};

export function WellnessPlansTab({ vetId }: WellnessPlansTabProps) {
 const queryClient = useQueryClient();
 const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
 const [editingPlan, setEditingPlan] = useState<any>(null);
 
 // Form state
 const [formData, setFormData] = useState({
 name:"",
 description:"",
 pet_type:"all" as string,
 age_category:"all" as string,
 price_usd:"",
 price_pawbucks:"",
 services: [] as string[],
 is_active: true,
 });
 const [newService, setNewService] = useState("");

 // Fetch wellness plans
 const { data: plans, isLoading: plansLoading } = useQuery({
 queryKey: ["vet-wellness-plans", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("vet_wellness_plans")
 .select("*")
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 return data;
 },
 });

 // Fetch plan purchases
 const { data: purchases, isLoading: purchasesLoading } = useQuery({
 queryKey: ["wellness-plan-purchases", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("wellness_plan_purchases")
 .select(`
 *,
 plan:vet_wellness_plans(name),
 pet:pet_profiles(name, type),
 user:profiles(full_name)
 `)
 .eq("vet_id", vetId)
 .order("purchased_at", { ascending: false });

 if (error) throw error;
 return data;
 },
 });

 // Create/Update plan mutation
 const savePlan = useMutation({
 mutationFn: async () => {
 const planData = {
 vet_id: vetId,
 name: formData.name,
 description: formData.description || null,
 pet_type: formData.pet_type,
 age_category: formData.age_category,
 price_usd: parseFloat(formData.price_usd),
 price_pawbucks: parseInt(formData.price_pawbucks),
 services: formData.services,
 is_active: formData.is_active,
 };

 if (editingPlan) {
 const { error } = await supabase
 .from("vet_wellness_plans")
 .update(planData)
 .eq("id", editingPlan.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("vet_wellness_plans")
 .insert(planData);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success(editingPlan ?"Plan updated" :"Plan created");
 queryClient.invalidateQueries({ queryKey: ["vet-wellness-plans"] });
 setIsCreateDialogOpen(false);
 resetForm();
 },
 onError: (error: Error) => {
 toast.error(error.message);
 },
 });

 // Delete plan mutation
 const deletePlan = useMutation({
 mutationFn: async (planId: string) => {
 const { error } = await supabase
 .from("vet_wellness_plans")
 .delete()
 .eq("id", planId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Plan deleted");
 queryClient.invalidateQueries({ queryKey: ["vet-wellness-plans"] });
 },
 onError: (error: Error) => {
 toast.error(error.message);
 },
 });

 // Update purchase status
 const updatePurchaseStatus = useMutation({
 mutationFn: async ({ purchaseId, status }: { purchaseId: string; status: string }) => {
 const { error } = await supabase
 .from("wellness_plan_purchases")
 .update({ status })
 .eq("id", purchaseId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Purchase status updated");
 queryClient.invalidateQueries({ queryKey: ["wellness-plan-purchases"] });
 },
 onError: (error: Error) => {
 toast.error(error.message);
 },
 });

 const resetForm = () => {
 setFormData({
 name:"",
 description:"",
 pet_type:"all",
 age_category:"all",
 price_usd:"",
 price_pawbucks:"",
 services: [],
 is_active: true,
 });
 setEditingPlan(null);
 setNewService("");
 };

 const openEditDialog = (plan: any) => {
 setEditingPlan(plan);
 setFormData({
 name: plan.name,
 description: plan.description ||"",
 pet_type: plan.pet_type,
 age_category: plan.age_category ||"all",
 price_usd: plan.price_usd.toString(),
 price_pawbucks: plan.price_pawbucks.toString(),
 services: plan.services || [],
 is_active: plan.is_active,
 });
 setIsCreateDialogOpen(true);
 };

 const addService = () => {
 if (newService.trim()) {
 setFormData(prev => ({
 ...prev,
 services: [...prev.services, newService.trim()],
 }));
 setNewService("");
 }
 };

 const removeService = (index: number) => {
 setFormData(prev => ({
 ...prev,
 services: prev.services.filter((_, i) => i !== index),
 }));
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"active":
 return <Badge className="bg-success/10 text-success">Active</Badge>;
 case"completed":
 return <Badge className="bg-info/10 text-info">Completed</Badge>;
 case"cancelled":
 return <Badge className="bg-destructive/10 text-destructive">Cancelled</Badge>;
 case"expired":
 return <Badge className="bg-muted text-muted-foreground">Expired</Badge>;
 default:
 return <Badge variant="outline">{status}</Badge>;
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">❤️</span>
 Wellness Plans
 </h2>
 <p className="text-sm text-muted-foreground">
 Create wellness packages that owners can pay for using PawBucks
 </p>
 </div>
 <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
 setIsCreateDialogOpen(open);
 if (!open) resetForm();
 }}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="h-4 w-4 mr-2" />
 Create Plan
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>
 {editingPlan ?"Edit Wellness Plan" :"Create Wellness Plan"}
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 pt-4">
 <div className="space-y-2">
 <Label>Plan Name *</Label>
 <Input
 value={formData.name}
 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
 placeholder="e.g., Annual Senior Wellness Screen"
 />
 </div>

 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 value={formData.description}
 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
 placeholder="Describe what's included in this plan..."
 rows={3}
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Pet Type</Label>
 <Select 
 value={formData.pet_type} 
 onValueChange={(v) => setFormData(prev => ({ ...prev, pet_type: v }))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Pets</SelectItem>
 <SelectItem value="dog">Dogs Only</SelectItem>
 <SelectItem value="cat">Cats Only</SelectItem>
 <SelectItem value="bird">Birds Only</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Age Category</Label>
 <Select 
 value={formData.age_category} 
 onValueChange={(v) => setFormData(prev => ({ ...prev, age_category: v }))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Ages</SelectItem>
 <SelectItem value="puppy_kitten">Puppy/Kitten</SelectItem>
 <SelectItem value="adult">Adult</SelectItem>
 <SelectItem value="senior">Senior</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="flex items-center gap-1">
 <span className="h-4 w-4" aria-hidden="true">💵</span>
 Price (USD) *
 </Label>
 <Input
 type="number"
 step="0.01"
 value={formData.price_usd}
 onChange={(e) => setFormData(prev => ({ ...prev, price_usd: e.target.value }))}
 placeholder="99.99"
 />
 </div>
 <div className="space-y-2">
 <Label className="flex items-center gap-1">
 <PawBucksLogo className="h-4 w-4" />
 Price (PawBucks) *
 </Label>
 <Input
 type="number"
 value={formData.price_pawbucks}
 onChange={(e) => setFormData(prev => ({ ...prev, price_pawbucks: e.target.value }))}
 placeholder="75000"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Services Included</Label>
 <div className="flex gap-2">
 <Input
 value={newService}
 onChange={(e) => setNewService(e.target.value)}
 placeholder="e.g., Comprehensive blood panel"
 onKeyDown={(e) => e.key ==='Enter' && (e.preventDefault(), addService())}
 />
 <Button type="button" onClick={addService} size="sm">
 Add
 </Button>
 </div>
 {formData.services.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-2">
 {formData.services.map((service, index) => (
 <Badge key={index} variant="secondary" className="flex items-center gap-1">
 <CheckCircle className="h-3 w-3" />
 {service}
 <button
 onClick={() => removeService(index)}
 className="ml-1 hover:text-destructive"
 >
 ×
 </button>
 </Badge>
 ))}
 </div>
 )}
 </div>

 <div className="flex items-center justify-between">
 <Label>Active</Label>
 <Switch
 checked={formData.is_active}
 onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
 />
 </div>

 <Button
 onClick={() => savePlan.mutate()}
 disabled={!formData.name || !formData.price_usd || !formData.price_pawbucks || savePlan.isPending}
 className="w-full"
 >
 {savePlan.isPending ?"Saving..." : editingPlan ?"Update Plan" :"Create Plan"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 <Tabs defaultValue="plans">
 <TabsList>
 <TabsTrigger value="plans" className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">📦</span>
 Plans ({plans?.length || 0})
 </TabsTrigger>
 <TabsTrigger value="purchases" className="flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">👥</span>
 Purchases ({purchases?.length || 0})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="plans" className="space-y-4 mt-4">
 {plansLoading ? (
 <div className="text-center py-8">Loading plans...</div>
 ) : plans && plans.length > 0 ? (
 <div className="grid gap-4 md:grid-cols-2">
 {plans.map((plan: any) => {
 const PetIcon = petTypeIcons[plan.pet_type] || Heart;
 return (
 <Card key={plan.id} className={`p-4 ${!plan.is_active ?'opacity-60' :''}`}>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <PetIcon className="h-5 w-5 text-primary" />
 <div>
 <h3 className="font-semibold">{plan.name}</h3>
 <p className="text-xs text-muted-foreground">
 {plan.pet_type !=='all' && `${plan.pet_type}s • `}
 {plan.age_category !=='all' && plan.age_category}
 </p>
 </div>
 </div>
 <div className="flex gap-1">
 <Button variant="ghost" size="sm" onClick={() => openEditDialog(plan)}>
 <Edit className="h-4 w-4" />
 </Button>
 <Button 
 variant="ghost" 
 size="sm"
 onClick={() => deletePlan.mutate(plan.id)}
 className="text-destructive hover:text-destructive"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 
 {plan.description && (
 <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
 )}

 <div className="flex items-center gap-4 mt-4">
 <div className="flex items-center gap-1">
 <span className="h-4 w-4 text-success" aria-hidden="true">💵</span>
 <span className="font-bold">${plan.price_usd}</span>
 </div>
 <div className="flex items-center gap-1">
 <PawBucksLogo className="h-4 w-4 text-warning" />
 <span className="font-bold">{plan.price_pawbucks.toLocaleString()}</span>
 </div>
 {!plan.is_active && (
 <Badge variant="outline" className="ml-auto">Inactive</Badge>
 )}
 </div>

 {plan.services && plan.services.length > 0 && (
 <div className="mt-4 space-y-1">
 <p className="text-xs font-medium text-muted-foreground">Includes:</p>
 <div className="flex flex-wrap gap-1">
 {plan.services.slice(0, 4).map((service: string, i: number) => (
 <Badge key={i} variant="secondary" className="text-xs">
 {service}
 </Badge>
 ))}
 {plan.services.length > 4 && (
 <Badge variant="outline" className="text-xs">
 +{plan.services.length - 4} more
 </Badge>
 )}
 </div>
 </div>
 )}
 </Card>
 );
 })}
 </div>
 ) : (
 <Card className="p-8 text-center text-muted-foreground">
 <span className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true">📦</span>
 <h3 className="font-medium">No Wellness Plans Yet</h3>
 <p className="text-sm">Create your first plan to start offering reward-funded wellness packages.</p>
 </Card>
 )}
 </TabsContent>

 <TabsContent value="purchases" className="mt-4">
 <Card>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Plan</TableHead>
 <TableHead>Pet</TableHead>
 <TableHead>Owner</TableHead>
 <TableHead>Payment</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {purchasesLoading ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8">
 Loading purchases...
 </TableCell>
 </TableRow>
 ) : purchases && purchases.length > 0 ? (
 purchases.map((purchase: any) => (
 <TableRow key={purchase.id}>
 <TableCell>
 {format(new Date(purchase.purchased_at),"MMM d, yyyy")}
 </TableCell>
 <TableCell className="font-medium">
 {purchase.plan?.name}
 </TableCell>
 <TableCell>
 {purchase.pet?.name} ({purchase.pet?.type})
 </TableCell>
 <TableCell>{purchase.user?.full_name}</TableCell>
 <TableCell>
 <div className="text-sm">
 {purchase.payment_method ==='pawbucks' ? (
 <span className="flex items-center gap-1">
 <PawBucksLogo className="h-3 w-3 text-warning" />
 {purchase.amount_pawbucks?.toLocaleString()}
 </span>
 ) : purchase.payment_method ==='combined' ? (
 <div>
 <span className="flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">💵</span>
 ${purchase.amount_usd}
 </span>
 <span className="flex items-center gap-1 text-muted-foreground">
 <PawBucksLogo className="h-3 w-3" />
 {purchase.amount_pawbucks?.toLocaleString()}
 </span>
 </div>
 ) : (
 <span className="flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">💵</span>
 ${purchase.amount_usd}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell>{getStatusBadge(purchase.status)}</TableCell>
 <TableCell>
 <Select
 value={purchase.status}
 onValueChange={(status) => updatePurchaseStatus.mutate({
 purchaseId: purchase.id,
 status,
 })}
 >
 <SelectTrigger className="w-[120px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="completed">Completed</SelectItem>
 <SelectItem value="cancelled">Cancelled</SelectItem>
 </SelectContent>
 </Select>
 </TableCell>
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
 <span className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true">⏰</span>
 No purchases yet
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Info Card */}
 <Card className="p-4 bg-warning/10 /30 border-warning/20">
 <div className="flex items-start gap-3">
 <PawBucksLogo className="h-5 w-5 text-warning mt-0.5" />
 <div>
 <h4 className="font-medium text-warning">
 PawBucks Integration
 </h4>
 <p className="text-sm text-warning">
 Pet owners can use their accumulated PawBucks rewards to pay for wellness plans. 
 This encourages preventive care by making it more accessible. You'll receive the 
 full USD value regardless of payment method.
 </p>
 </div>
 </div>
 </Card>
 </div>
 );
}

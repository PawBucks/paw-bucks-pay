import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Edit, DollarSign, Users, Calendar, Heart, Sparkles, Package } from "lucide-react";

interface WellnessPlanArchitectProps {
  vetId: string;
}

interface PlanService {
  id?: string;
  service_name: string;
  service_category: string;
  quantity_included: number;
  retail_value: number;
  description?: string;
  frequency: string;
}

interface WellnessPlan {
  id: string;
  name: string;
  description: string;
  pet_type?: string;
  species?: string[];
  age_category?: string;
  price_usd?: number;
  monthly_price?: number;
  annual_price?: number;
  setup_fee?: number;
  billing_interval?: string;
  commitment_months?: number;
  total_value?: number;
  savings_percentage?: number;
  is_active: boolean;
  is_featured?: boolean;
  current_subscribers?: number;
  max_subscribers?: number;
  services?: any;
}

const SERVICE_CATEGORIES = [
  { value: "exam", label: "Wellness Exam" },
  { value: "vaccine", label: "Vaccine" },
  { value: "lab_work", label: "Lab Work" },
  { value: "dental", label: "Dental" },
  { value: "preventive", label: "Preventive Care" },
  { value: "grooming", label: "Grooming" },
  { value: "other", label: "Other" },
];

const FREQUENCIES = [
  { value: "per_year", label: "Per Year" },
  { value: "per_visit", label: "Per Visit" },
  { value: "unlimited", label: "Unlimited" },
  { value: "as_needed", label: "As Needed" },
];

export function WellnessPlanArchitect({ vetId }: WellnessPlanArchitectProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WellnessPlan | null>(null);
  const [planServices, setPlanServices] = useState<PlanService[]>([]);
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    species: ["dog", "cat"],
    age_category: "all",
    monthly_price: "",
    annual_price: "",
    setup_fee: "0",
    billing_interval: "monthly",
    commitment_months: "12",
    max_subscribers: "",
    is_featured: false,
    terms_conditions: "",
    cancellation_policy: "Subscribers may cancel with 30 days notice. No refunds for partial months.",
  });

  // Fetch wellness plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["vet-wellness-plans", vetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_wellness_plans")
        .select("*")
        .eq("vet_id", vetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WellnessPlan[];
    },
  });

  // Fetch plan services when editing
  const { data: selectedPlanServices = [] } = useQuery({
    queryKey: ["plan-services", editingPlan?.id],
    queryFn: async () => {
      if (!editingPlan?.id) return [];
      const { data, error } = await supabase
        .from("vet_wellness_plan_services")
        .select("*")
        .eq("plan_id", editingPlan.id)
        .order("sort_order");

      if (error) throw error;
      return data as PlanService[];
    },
    enabled: !!editingPlan?.id,
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const monthlyPrice = parseFloat(newPlan.monthly_price);
      const totalValue = planServices.reduce((sum, s) => sum + (s.retail_value * s.quantity_included), 0);
      const annualCost = monthlyPrice * 12;
      const savingsPercentage = totalValue > 0 ? ((totalValue - annualCost) / totalValue) * 100 : 0;

      // Create plan
      const { data: plan, error: planError } = await supabase
        .from("vet_wellness_plans")
        .insert({
          vet_id: vetId,
          name: newPlan.name,
          description: newPlan.description,
          pet_type: newPlan.species[0] || "dog",
          age_category: newPlan.age_category,
          price_usd: monthlyPrice,
          is_active: true,
          services: planServices,
        } as any)
        .select()
        .single();

      if (planError) throw planError;

      // Create services
      if (planServices.length > 0) {
        const { error: servicesError } = await supabase
          .from("vet_wellness_plan_services")
          .insert(
            planServices.map((service, index) => ({
              plan_id: plan.id,
              service_name: service.service_name,
              service_category: service.service_category,
              quantity_included: service.quantity_included,
              retail_value: service.retail_value,
              description: service.description,
              frequency: service.frequency,
              sort_order: index,
            }))
          );

        if (servicesError) throw servicesError;
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vet-wellness-plans", vetId] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success("Wellness plan created successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to create plan: ${error.message}`);
    },
  });

  // Toggle plan status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ planId, isActive }: { planId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("vet_wellness_plans")
        .update({ is_active: isActive })
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vet-wellness-plans", vetId] });
      toast.success("Plan status updated");
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("vet_wellness_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vet-wellness-plans", vetId] });
      toast.success("Plan deleted");
    },
  });

  const resetForm = () => {
    setNewPlan({
      name: "",
      description: "",
      species: ["dog", "cat"],
      age_category: "all",
      monthly_price: "",
      annual_price: "",
      setup_fee: "0",
      billing_interval: "monthly",
      commitment_months: "12",
      max_subscribers: "",
      is_featured: false,
      terms_conditions: "",
      cancellation_policy: "Subscribers may cancel with 30 days notice. No refunds for partial months.",
    });
    setPlanServices([]);
  };

  const addService = () => {
    setPlanServices([
      ...planServices,
      {
        service_name: "",
        service_category: "exam",
        quantity_included: 1,
        retail_value: 0,
        frequency: "per_year",
      },
    ]);
  };

  const updateService = (index: number, field: keyof PlanService, value: any) => {
    const updated = [...planServices];
    updated[index] = { ...updated[index], [field]: value };
    setPlanServices(updated);
  };

  const removeService = (index: number) => {
    setPlanServices(planServices.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalValue = planServices.reduce((sum, s) => sum + (s.retail_value * s.quantity_included), 0);
    const monthlyPrice = parseFloat(newPlan.monthly_price) || 0;
    const annualCost = monthlyPrice * 12;
    const savings = totalValue - annualCost;
    const savingsPercentage = totalValue > 0 ? (savings / totalValue) * 100 : 0;

    return { totalValue, annualCost, savings, savingsPercentage };
  };

  const totals = calculateTotals();

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading wellness plans...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-destructive" />
            Wellness Plan Architect
          </h2>
          <p className="text-muted-foreground">
            Create recurring revenue plans. Owners earn 10x-30x PawBucks rewards on every payment.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Wellness Plan</DialogTitle>
              <DialogDescription>
                Design a subscription wellness plan for your patients
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Plan Details</TabsTrigger>
                <TabsTrigger value="services">Services ({planServices.length})</TabsTrigger>
                <TabsTrigger value="pricing">Pricing & Terms</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Plan Name *</Label>
                    <Input
                      id="name"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      placeholder="e.g., Puppy Wellness Plus"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      placeholder="Describe what's included in this plan..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Pet Species</Label>
                      <div className="flex gap-2 mt-2">
                        {["dog", "cat", "bird", "exotic"].map((species) => (
                          <Badge
                            key={species}
                            variant={newPlan.species.includes(species) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => {
                              const newSpecies = newPlan.species.includes(species)
                                ? newPlan.species.filter((s) => s !== species)
                                : [...newPlan.species, species];
                              setNewPlan({ ...newPlan, species: newSpecies });
                            }}
                          >
                            {species}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="age_category">Age Category</Label>
                      <Select
                        value={newPlan.age_category}
                        onValueChange={(value) => setNewPlan({ ...newPlan, age_category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Ages</SelectItem>
                          <SelectItem value="puppy_kitten">Puppy/Kitten (0-1 year)</SelectItem>
                          <SelectItem value="adult">Adult (1-7 years)</SelectItem>
                          <SelectItem value="senior">Senior (7+ years)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={newPlan.is_featured}
                      onCheckedChange={(checked) => setNewPlan({ ...newPlan, is_featured: checked })}
                    />
                    <Label htmlFor="featured">Featured Plan (highlighted to customers)</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="services" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Add services included in this plan. Total retail value helps calculate savings.
                  </p>
                  <Button variant="outline" size="sm" onClick={addService}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Service
                  </Button>
                </div>

                {planServices.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mb-2" />
                      <p>No services added yet</p>
                      <Button variant="link" onClick={addService}>
                        Add your first service
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {planServices.map((service, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-4">
                            <Label className="text-xs">Service Name</Label>
                            <Input
                              value={service.service_name}
                              onChange={(e) => updateService(index, "service_name", e.target.value)}
                              placeholder="e.g., Annual Exam"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={service.service_category}
                              onValueChange={(value) => updateService(index, "service_category", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SERVICE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              min="1"
                              value={service.quantity_included}
                              onChange={(e) => updateService(index, "quantity_included", parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Retail Value ($)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={service.retail_value}
                              onChange={(e) => updateService(index, "retail_value", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Frequency</Label>
                            <Select
                              value={service.frequency}
                              onValueChange={(value) => updateService(index, "frequency", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCIES.map((freq) => (
                                  <SelectItem key={freq.value} value={freq.value}>
                                    {freq.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeService(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    <Card className="bg-muted/50">
                      <CardContent className="py-3">
                        <div className="flex justify-between text-sm">
                          <span>Total Retail Value:</span>
                          <span className="font-semibold">${totals.totalValue.toFixed(2)}/year</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthly_price">Monthly Price ($) *</Label>
                    <Input
                      id="monthly_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newPlan.monthly_price}
                      onChange={(e) => setNewPlan({ ...newPlan, monthly_price: e.target.value })}
                      placeholder="e.g., 49.99"
                    />
                  </div>

                  <div>
                    <Label htmlFor="annual_price">Annual Price ($) (optional discount)</Label>
                    <Input
                      id="annual_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newPlan.annual_price}
                      onChange={(e) => setNewPlan({ ...newPlan, annual_price: e.target.value })}
                      placeholder="Leave blank for 12x monthly"
                    />
                  </div>

                  <div>
                    <Label htmlFor="setup_fee">Setup Fee ($)</Label>
                    <Input
                      id="setup_fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newPlan.setup_fee}
                      onChange={(e) => setNewPlan({ ...newPlan, setup_fee: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="commitment_months">Commitment Period (months)</Label>
                    <Select
                      value={newPlan.commitment_months}
                      onValueChange={(value) => setNewPlan({ ...newPlan, commitment_months: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No Commitment</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">12 Months</SelectItem>
                        <SelectItem value="24">24 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="max_subscribers">Max Subscribers (optional)</Label>
                    <Input
                      id="max_subscribers"
                      type="number"
                      min="0"
                      value={newPlan.max_subscribers}
                      onChange={(e) => setNewPlan({ ...newPlan, max_subscribers: e.target.value })}
                      placeholder="Leave blank for unlimited"
                    />
                  </div>

                  <div>
                    <Label htmlFor="billing_interval">Billing Interval</Label>
                    <Select
                      value={newPlan.billing_interval}
                      onValueChange={(value) => setNewPlan({ ...newPlan, billing_interval: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Savings Summary */}
                {parseFloat(newPlan.monthly_price) > 0 && planServices.length > 0 && (
                  <Card className="bg-gradient-to-r from-success/20 to-success/20 /30 /30 border-success/20">
                    <CardContent className="py-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Retail Value</p>
                          <p className="text-lg font-bold">${totals.totalValue.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Plan Cost/Year</p>
                          <p className="text-lg font-bold">${totals.annualCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Customer Savings</p>
                          <p className="text-lg font-bold text-success">
                            {totals.savingsPercentage > 0 ? `${totals.savingsPercentage.toFixed(0)}%` : "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
                  <Textarea
                    id="cancellation_policy"
                    value={newPlan.cancellation_policy}
                    onChange={(e) => setNewPlan({ ...newPlan, cancellation_policy: e.target.value })}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                  <Textarea
                    id="terms_conditions"
                    value={newPlan.terms_conditions}
                    onChange={(e) => setNewPlan({ ...newPlan, terms_conditions: e.target.value })}
                    placeholder="Additional terms and conditions..."
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createPlanMutation.mutate()}
                disabled={!newPlan.name || !newPlan.monthly_price || createPlanMutation.isPending}
              >
                {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Heart className="h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No Wellness Plans Yet</h3>
            <p className="text-sm mb-4">Create your first wellness plan to generate recurring revenue</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const monthlyPrice = plan.monthly_price || plan.price_usd || 0;
            const services = plan.services || [];

            return (
              <Card key={plan.id} className={`relative ${plan.is_featured ? "ring-2 ring-primary" : ""}`}>
                {plan.is_featured && (
                  <Badge className="absolute -top-2 -right-2 bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {plan.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${monthlyPrice}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  {plan.savings_percentage && plan.savings_percentage > 0 && (
                    <Badge variant="outline" className="text-success border-success/40">
                      Save {plan.savings_percentage.toFixed(0)}% vs. à la carte
                    </Badge>
                  )}

                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {plan.pet_type || plan.species?.[0] || "All pets"}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {plan.age_category?.replace("_", "/") || "All ages"}
                    </Badge>
                  </div>

                  {services.length > 0 && (
                    <div className="text-sm">
                      <p className="font-medium mb-1">Includes:</p>
                      <ul className="text-muted-foreground space-y-0.5">
                        {services.slice(0, 3).map((s: any, i: number) => (
                          <li key={i} className="truncate">
                            • {s.quantity_included || 1}x {s.service_name || s.name}
                          </li>
                        ))}
                        {services.length > 3 && (
                          <li className="text-primary">+ {services.length - 3} more services</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {plan.current_subscribers || 0} subscribers
                    </div>
                    {plan.commitment_months && plan.commitment_months > 0 && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {plan.commitment_months}mo term
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStatusMutation.mutate({ planId: plan.id, isActive: !plan.is_active })}
                    >
                      {plan.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this plan?")) {
                          deletePlanMutation.mutate(plan.id);
                        }
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-info/20 to-primary/20 /30 /30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-info mt-0.5" />
            <div>
              <p className="font-medium">How Wellness Plan Billing Works</p>
              <p className="text-sm text-muted-foreground mt-1">
                PawBucks manages all billing. Subscribers are charged automatically each month, and pet owners earn
                10x-30x PawBucks rewards (based on their subscription tier) on every payment. You receive payouts
                directly to your connected Stripe account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

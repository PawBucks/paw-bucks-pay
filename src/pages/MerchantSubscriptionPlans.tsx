import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { merchantSubscriptionPlansService } from "@/services/api/merchantSubscriptionPlans.service";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Upload,
  Loader2,
  RefreshCw,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionPlanForm } from "@/components/merchant/SubscriptionPlanForm";

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billing_interval: string;
  billing_interval_count: number;
  is_active: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  features: string[];
  trial_days: number;
  max_subscribers: number | null;
  current_subscribers: number;
  created_at: string;
};

const MerchantSubscriptionPlans = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [publishingPlanId, setPublishingPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Get merchant
        const { data: merchant, error: merchantError } = await supabase
          .from("merchants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (merchantError || !merchant) {
          navigate("/merchant-onboarding");
          return;
        }

        setMerchantId(merchant.id);

        // Get plans
        const { data: plansData, error: plansError } = await merchantSubscriptionPlansService.getMyPlans(merchant.id);
        
        if (plansError) {
          throw plansError;
        }

        setPlans((plansData || []).map(p => ({
          ...p,
          features: Array.isArray(p.features) ? p.features as string[] : [],
        })));
      } catch (error) {
        console.error("Error loading plans:", error);
        toast.error("Failed to load subscription plans");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, navigate]);

  const handleCreatePlan = async (data: {
    name: string;
    description: string;
    amount: number;
    billingInterval: "day" | "week" | "month" | "year";
    billingIntervalCount: number;
    features: string[];
    trialDays: number;
  }) => {
    if (!merchantId) return;

    const { data: newPlan, error } = await merchantSubscriptionPlansService.create({
      merchantId,
      name: data.name,
      description: data.description || undefined,
      amount: data.amount,
      billingInterval: data.billingInterval,
      billingIntervalCount: data.billingIntervalCount,
      features: data.features,
      trialDays: data.trialDays,
    });

    if (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create plan";
      toast.error(errorMessage);
      throw error;
    }

    if (newPlan) {
      setPlans([...plans, { ...newPlan, features: data.features }]);
      // Check if plan was auto-published (has stripe_price_id)
      if (newPlan.stripe_price_id) {
        toast.success("Subscription plan created and published to your storefront!");
      } else {
        toast.success("Plan created! Click Publish to make it available on your storefront.");
      }
    }
  };

  const handleEditPlan = async (data: {
    name: string;
    description: string;
    amount: number;
    billingInterval: "day" | "week" | "month" | "year";
    billingIntervalCount: number;
    features: string[];
    trialDays: number;
  }) => {
    if (!editingPlan) return;

    const { data: updatedPlan, error } = await merchantSubscriptionPlansService.update(editingPlan.id, {
      name: data.name,
      description: data.description || undefined,
      amount: data.amount,
      billingInterval: data.billingInterval,
      billingIntervalCount: data.billingIntervalCount,
      features: data.features,
      trialDays: data.trialDays,
    });

    if (error) {
      toast.error("Failed to update plan");
      throw error;
    }

    if (updatedPlan) {
      setPlans(plans.map(p => p.id === editingPlan.id ? { ...updatedPlan, features: data.features } : p));
      toast.success("Plan updated! Re-publish to apply changes to Stripe.");
    }
    setEditingPlan(null);
  };

  const handlePublishPlan = async (planId: string) => {
    setPublishingPlanId(planId);
    
    try {
      const { data, error } = await merchantSubscriptionPlansService.publish(planId);
      
      if (error) {
        toast.error(typeof error === "object" && error !== null && "message" in error 
          ? (error as { message: string }).message 
          : "Failed to publish plan");
        return;
      }

      if (data) {
        setPlans(plans.map(p => 
          p.id === planId 
            ? { ...p, stripe_product_id: data.stripeProductId, stripe_price_id: data.stripePriceId, is_active: true }
            : p
        ));
        toast.success("Plan published! It's now available on your storefront.");
      }
    } catch (error) {
      console.error("Error publishing plan:", error);
      toast.error("Failed to publish plan");
    } finally {
      setPublishingPlanId(null);
    }
  };

  const handleToggleActive = async (planId: string, isActive: boolean) => {
    const { error } = await merchantSubscriptionPlansService.update(planId, { isActive });
    
    if (error) {
      toast.error("Failed to update plan status");
      return;
    }

    setPlans(plans.map(p => p.id === planId ? { ...p, is_active: isActive } : p));
    toast.success(isActive ? "Plan activated" : "Plan deactivated");
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    
    setDeletingPlanId(planToDelete.id);
    
    try {
      const { error } = await merchantSubscriptionPlansService.delete(planToDelete.id);
      
      if (error) {
        toast.error("Failed to delete plan");
        return;
      }

      setPlans(plans.filter(p => p.id !== planToDelete.id));
      toast.success("Plan deleted");
    } finally {
      setDeletingPlanId(null);
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  const formatInterval = (interval: string, count: number) => {
    const labels: Record<string, [string, string]> = {
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"],
      year: ["year", "years"],
    };
    const [singular, plural] = labels[interval] || ["period", "periods"];
    return count === 1 ? `per ${singular}` : `every ${count} ${plural}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Subscription Plans - Merchant Dashboard"
        description="Create and manage recurring billing plans for your customers."
        noIndex
      />
      
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="container max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Subscription Plans</h1>
                <p className="text-sm text-muted-foreground">Create recurring billing plans</p>
              </div>
            </div>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </div>
        </div>

        <main className="container max-w-5xl mx-auto px-4 py-6">
          {plans.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <RefreshCw className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Subscription Plans Yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Create recurring billing plans for wellness memberships, monthly services, or any subscription offering.
                </p>
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {plans.map(plan => (
                <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          {plan.stripe_price_id ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Draft
                            </Badge>
                          )}
                          {!plan.is_active && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        {plan.description && (
                          <CardDescription>{plan.description}</CardDescription>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(checked) => handleToggleActive(plan.id, checked)}
                          aria-label="Toggle plan active"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditingPlan(plan);
                              setFormOpen(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handlePublishPlan(plan.id)}
                              disabled={publishingPlanId === plan.id}
                            >
                              {publishingPlanId === plan.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              {plan.stripe_price_id ? "Re-publish" : "Publish"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setPlanToDelete(plan);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">${(plan.amount / 100).toFixed(2)}</span>
                        <span className="text-muted-foreground">{formatInterval(plan.billing_interval, plan.billing_interval_count)}</span>
                      </div>
                      
                      {plan.trial_days > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{plan.trial_days} day trial</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{plan.current_subscribers} subscribers</span>
                      </div>
                    </div>
                    
                    {plan.features.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {plan.features.map((feature, i) => (
                          <Badge key={i} variant="outline">{feature}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <SubscriptionPlanForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingPlan(null);
        }}
        onSubmit={editingPlan ? handleEditPlan : handleCreatePlan}
        initialData={editingPlan ? {
          name: editingPlan.name,
          description: editingPlan.description || "",
          amount: editingPlan.amount,
          billingInterval: editingPlan.billing_interval as "day" | "week" | "month" | "year",
          billingIntervalCount: editingPlan.billing_interval_count,
          features: editingPlan.features,
          trialDays: editingPlan.trial_days,
        } : undefined}
        isEditing={!!editingPlan}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{planToDelete?.name}". Existing subscribers will not be affected, but no new subscriptions can be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingPlanId === planToDelete?.id}
            >
              {deletingPlanId === planToDelete?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MerchantSubscriptionPlans;

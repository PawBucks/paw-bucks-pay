import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, DollarSign, TrendingUp, Users, Store, Plus, ArrowRight,
  Calendar, CheckCircle2, Clock, Loader2, LogOut, Building2, BarChart3,
  Target, Zap, PieChart, LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import {
  getBrandAccountForUser,
  getBrandCampaigns,
  createBrandCampaign,
  getCampaignMerchants,
  getCampaignActivity,
  calculatePawbucksFromBudget,
  calculateEstimatedReach,
  startBrandCampaignCheckout,
  requestBrandCampaignInvoice,
  verifyBrandCampaignPayment,
  type BrandCampaign,
  type TargetingRules,
} from "@/services/api/brandCampaigns.service";
import { CommandCenter } from "@/components/brand/CommandCenter";
import { TargetingRulesEditor } from "@/components/brand/TargetingRulesEditor";

const statusConfig: Record<string, { color: string; label: string; emoji: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Draft", emoji: "📝" },
  pending_payment: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: "Pending Payment", emoji: "💳" },
  active: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Active", emoji: "🟢" },
  paused: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", label: "Paused", emoji: "⏸️" },
  completed: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "Completed", emoji: "✅" },
  expired: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Expired", emoji: "⏰" },
};

const BrandDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<BrandCampaign | null>(null);

  // Campaign form
  const [form, setForm] = useState({
    name: "",
    description: "",
    budget_usd: 500,
    pawbucks_per_checkin: 500,
    start_date: "",
    end_date: "",
    campaign_color: "#6366f1",
    targeting_notes: "",
  });

  const pawbucksPool = useMemo(() => calculatePawbucksFromBudget(form.budget_usd), [form.budget_usd]);
  const estimatedReach = useMemo(() => calculateEstimatedReach(pawbucksPool, form.pawbucks_per_checkin), [pawbucksPool, form.pawbucks_per_checkin]);

  const { data: brandAccount, isLoading: brandLoading } = useQuery({
    queryKey: ["brand-account", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await getBrandAccountForUser(user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["brand-campaigns", brandAccount?.id],
    queryFn: async () => {
      if (!brandAccount) return [];
      const { data, error } = await getBrandCampaigns(brandAccount.id);
      if (error) throw error;
      return data;
    },
    enabled: !!brandAccount,
  });

  const { data: campaignMerchants = [] } = useQuery({
    queryKey: ["brand-campaign-merchants", selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const { data, error } = await getCampaignMerchants(selectedCampaign.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaign,
  });

  const { data: campaignActivity = [] } = useQuery({
    queryKey: ["brand-campaign-activity", selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const { data, error } = await getCampaignActivity(selectedCampaign.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaign,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!brandAccount) throw new Error("No brand account");
      return createBrandCampaign({
        brand_id: brandAccount.id,
        name: form.name,
        description: form.description || undefined,
        budget_usd: form.budget_usd,
        pawbucks_pool: pawbucksPool,
        pawbucks_per_checkin: form.pawbucks_per_checkin,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        campaign_color: form.campaign_color,
        targeting_notes: form.targeting_notes || undefined,
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error("Failed to create campaign");
        return;
      }
      toast.success("Campaign created! Submit for payment when ready.");
      setShowCreate(false);
      setForm({ name: "", description: "", budget_usd: 500, pawbucks_per_checkin: 500, start_date: "", end_date: "", campaign_color: "#6366f1", targeting_notes: "" });
      queryClient.invalidateQueries({ queryKey: ["brand-campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (brandLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brandAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>No Brand Account</CardTitle>
            <CardDescription>
              Your account doesn't have a brand profile yet. Please contact the PawBucks team to get set up as a Brand/Manufacturer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!(brandAccount as any).setup_completed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle>Finish Brand Setup</CardTitle>
            <CardDescription>
              Complete your brand profile to unlock campaign funding, audience targeting, and the Brand Command Center.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/brand-setup/${(brandAccount as any).invitation_token}`)}>
              Complete Setup
            </Button>
            <Button variant="outline" onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Campaign detail view
  if (selectedCampaign) {
    const distributionPct = selectedCampaign.pawbucks_pool > 0
      ? (selectedCampaign.total_distributed / selectedCampaign.pawbucks_pool) * 100
      : 0;
    const redemptionPct = selectedCampaign.total_distributed > 0
      ? (selectedCampaign.total_redeemed / selectedCampaign.total_distributed) * 100
      : 0;
    const status = statusConfig[selectedCampaign.status] || statusConfig.draft;

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>← Back</Button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">{selectedCampaign.name}</h1>
            </div>
            <Badge className={status.color}>{status.emoji} {status.label}</Badge>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Budget</p>
                <p className="text-xl font-bold">${selectedCampaign.budget_usd.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />PB Pool</p>
                <p className="text-xl font-bold">{selectedCampaign.pawbucks_pool.toLocaleString()}</p>
                <Progress value={distributionPct} className="h-1 mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />Per Check-in</p>
                <p className="text-xl font-bold">{selectedCampaign.pawbucks_per_checkin} PB</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Check-ins</p>
                <p className="text-xl font-bold">{selectedCampaign.total_checkins.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribution & Redemption */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{selectedCampaign.total_distributed.toLocaleString()} <span className="text-base font-normal text-muted-foreground">PB</span></p>
                <p className="text-sm text-muted-foreground">{distributionPct.toFixed(1)}% of {selectedCampaign.pawbucks_pool.toLocaleString()} PB pool</p>
                <Progress value={distributionPct} className="h-2 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-blue-500" /> Redemption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{selectedCampaign.total_redeemed.toLocaleString()} <span className="text-base font-normal text-muted-foreground">PB</span></p>
                <p className="text-sm text-muted-foreground">{redemptionPct.toFixed(1)}% of distributed PawBucks redeemed</p>
                <Progress value={redemptionPct} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Merchants & Activity */}
          <Tabs defaultValue="merchants">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="merchants">
                <Store className="h-4 w-4 mr-1" /> Merchants ({campaignMerchants.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                <BarChart3 className="h-4 w-4 mr-1" /> Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="merchants" className="mt-4">
              {campaignMerchants.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Merchants will be added by the PawBucks team</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {campaignMerchants.map((cm) => (
                    <Card key={cm.id}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Store className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{(cm as any).merchants?.business_name || "Merchant"}</p>
                            <p className="text-xs text-muted-foreground">
                              {cm.joined_at ? `Active since ${new Date(cm.joined_at).toLocaleDateString()}` : "Invited"}
                            </p>
                          </div>
                        </div>
                        <Badge variant={cm.status === "active" ? "default" : "secondary"}>{cm.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              {campaignActivity.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No activity yet. PawBucks will be distributed when pet owners check in at participating merchants.</p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {campaignActivity.map((a) => (
                      <Card key={a.id}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {a.type === "earn" ? "🟢" : "🔴"} {Math.abs(a.amount).toLocaleString()} PB {a.type === "earn" ? "distributed" : "redeemed"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                at {(a as any).merchants?.business_name || "Unknown Merchant"}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  // Main dashboard
  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const totalBudget = campaigns.reduce((sum, c) => sum + Number(c.budget_usd), 0);
  const totalDistributed = campaigns.reduce((sum, c) => sum + c.total_distributed, 0);
  const totalRedeemed = campaigns.reduce((sum, c) => sum + c.total_redeemed, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{brandAccount.brand_name}</h1>
              <p className="text-xs text-muted-foreground">Brand Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <Tabs defaultValue="command-center" className="space-y-5">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="command-center" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Command Center
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="h-4 w-4" />
              Campaigns ({campaigns.length})
            </TabsTrigger>
          </TabsList>

          {/* Command Center tab — the WOW moment */}
          <TabsContent value="command-center" className="mt-0">
            <CommandCenter brandId={brandAccount.id} />
          </TabsContent>

          {/* Campaigns tab — original campaign list & creation */}
          <TabsContent value="campaigns" className="mt-0 space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Active Campaigns</p>
                  <p className="text-2xl font-bold">{activeCampaigns.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Budget</p>
                  <p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">PB Distributed</p>
                  <p className="text-2xl font-bold">{totalDistributed.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">PB Redeemed</p>
                  <p className="text-2xl font-bold">{totalRedeemed.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Create campaign */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Campaigns</h2>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Funded PawBucks Campaign</DialogTitle>
                <DialogDescription>Set your budget and parameters. An invoice will be sent for payment before activation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Spring 2026 Promotion" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your campaign goals..." rows={2} />
                </div>

                <Separator />

                {/* Budget calculator */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Budget Calculator
                  </h3>
                  <div className="space-y-2">
                    <Label>Campaign Budget (USD)</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={100}
                        step={100}
                        value={form.budget_usd}
                        onChange={(e) => setForm(f => ({ ...f, budget_usd: Math.max(100, Number(e.target.value)) }))}
                      />
                    </div>
                    <Slider
                      value={[form.budget_usd]}
                      onValueChange={([v]) => setForm(f => ({ ...f, budget_usd: v }))}
                      min={100}
                      max={50000}
                      step={100}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>$100</span>
                      <span>$50,000</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>PawBucks Per Check-in</Label>
                    <Input
                      type="number"
                      min={100}
                      step={100}
                      value={form.pawbucks_per_checkin}
                      onChange={(e) => setForm(f => ({ ...f, pawbucks_per_checkin: Math.max(100, Number(e.target.value)) }))}
                    />
                    <p className="text-xs text-muted-foreground">How many branded PawBucks each pet owner receives per check-in</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-background border text-center">
                      <p className="text-xs text-muted-foreground">Total PawBucks Pool</p>
                      <p className="text-xl font-bold text-primary">{pawbucksPool.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">PB</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background border text-center">
                      <p className="text-xs text-muted-foreground">Est. Pet Owners Reached</p>
                      <p className="text-xl font-bold text-emerald-600">{estimatedReach.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">check-ins</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Campaign Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.campaign_color}
                      onChange={(e) => setForm(f => ({ ...f, campaign_color: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <span className="text-sm text-muted-foreground">{form.campaign_color}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Targeting Notes</Label>
                  <Textarea value={form.targeting_notes} onChange={(e) => setForm(f => ({ ...f, targeting_notes: e.target.value }))} placeholder="Any specific targeting preferences..." rows={2} />
                </div>

                <Button
                  className="w-full"
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={!form.name || form.budget_usd < 100 || createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns list */}
        {campaignsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-semibold text-lg mb-1">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">Create your first funded PawBucks campaign to reach pet owners.</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const status = statusConfig[campaign.status] || statusConfig.draft;
              const poolPct = campaign.pawbucks_pool > 0
                ? (campaign.total_distributed / campaign.pawbucks_pool) * 100
                : 0;

              return (
                <Card
                  key={campaign.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: campaign.campaign_color || "#6366f1" }}
                        />
                        <h3 className="font-bold">{campaign.name}</h3>
                      </div>
                      <Badge className={status.color}>{status.emoji} {status.label}</Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{campaign.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">${Number(campaign.budget_usd).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Budget</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{campaign.total_distributed.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">PB Distributed</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{campaign.total_checkins}</p>
                        <p className="text-xs text-muted-foreground">Check-ins</p>
                      </div>
                    </div>
                    <Progress value={poolPct} className="h-1.5 mt-3" />
                    <p className="text-xs text-muted-foreground mt-1">{poolPct.toFixed(0)}% of PawBucks pool distributed</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BrandDashboard;

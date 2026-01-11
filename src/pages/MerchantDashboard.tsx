import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGeocoding } from "@/hooks/useGeocoding";
import { useMerchantActiveServices, SERVICE_NAMES } from "@/hooks/useMerchantServices";
import { useMerchantPawBucksRealtime } from "@/hooks/usePawBucksRealtime";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LogOut,
  PawPrint,
  Loader2,
  LayoutDashboard,
  BarChart3,
  Sparkles,
  Zap,
  DollarSign,
  Menu,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// Tab Components
import { MerchantOverviewTab } from "@/components/merchant/MerchantOverviewTab";
import { MerchantQuickActionsTab } from "@/components/merchant/MerchantQuickActionsTab";
import { MerchantPremiumServicesTab } from "@/components/merchant/MerchantPremiumServicesTab";
import { MerchantEarningsTab } from "@/components/merchant/MerchantEarningsTab";

// Dialogs
import { EditMerchantProfileDialog } from "@/components/merchant/EditMerchantProfileDialog";
import { FundingRequestDialog } from "@/components/merchant/FundingRequestDialog";
import { TransactionsDialog } from "@/components/merchant/TransactionsDialog";

type Merchant = {
  id: string;
  business_name: string;
  contact_person: string;
  phone?: string;
  business_type: string;
  address?: string;
  description?: string;
  cashback_rate: number;
  stripe_account_id?: string;
  stripe_account_status?: string;
  logo_url?: string;
  accepts_pawbucks?: boolean;
  latitude?: number;
  longitude?: number;
};

type Analytics = {
  total_sales: number;
  total_cashback: number;
  repayment_rate: number | null;
  remaining_balance: number;
  total_transactions: number;
  total_customers: number;
  avg_transaction_amount: number;
  funding_deal_status?: string | null;
};

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned: number;
  description: string;
  created_at: string;
};

// Define navigation sections
const NAV_SECTIONS = [
  {
    title: "Dashboard",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        description: "View your sales analytics, rewards, and recent transactions",
      },
      {
        id: "analytics",
        label: "Earnings",
        icon: DollarSign,
        description: "View your Stripe earnings, payouts, and balance information",
      },
    ],
  },
  {
    title: "Services",
    items: [
      {
        id: "premium",
        label: "Premium Services",
        icon: Sparkles,
        description: "Manage your active premium service dashboards",
      },
      {
        id: "actions",
        label: "Quick Actions",
        icon: Zap,
        description: "Access all merchant tools, products, and settings",
      },
    ],
  },
];

const MerchantDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { geocodeAddress } = useGeocoding();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [requestingFunding, setRequestingFunding] = useState(false);
  const [togglingPawbucks, setTogglingPawbucks] = useState(false);
  
  // Enable realtime updates for merchant PawBucks and transactions
  useMerchantPawBucksRealtime(merchant?.id);
  
  // Fetch active services for this merchant
  const { data: activeServices = [] } = useMerchantActiveServices(merchant?.id);
  
  // Check which premium services are active
  const hasSponsored = activeServices.includes(SERVICE_NAMES.SPONSORED_PLACEMENT);
  const hasPremiumAd = activeServices.includes(SERVICE_NAMES.PREMIUM_AD);
  const hasFeaturedPartner = activeServices.includes(SERVICE_NAMES.FEATURED_PARTNER);
  const hasSearchBooster = activeServices.includes(SERVICE_NAMES.SEARCH_RANKING_BOOSTER);
  const hasProfileOptimization = activeServices.includes(SERVICE_NAMES.PROFILE_OPTIMIZATION);
  const hasReviewCampaign = activeServices.includes(SERVICE_NAMES.REVIEW_CAMPAIGN);
  const hasPrioritySupport = activeServices.includes(SERVICE_NAMES.PRIORITY_SUPPORT);
  const hasSpotlight = activeServices.includes(SERVICE_NAMES.MERCHANT_SPOTLIGHT);
  
  const hasPremiumServices = hasSponsored || hasPremiumAd || hasFeaturedPartner || hasSearchBooster || hasProfileOptimization || hasReviewCampaign || hasPrioritySupport || hasSpotlight;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const loadMerchantData = useCallback(async () => {
    if (!user) return;

    try {
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (merchantError) {
        if (merchantError.code === "PGRST116") {
          navigate("/merchant-onboarding");
          return;
        }
        throw merchantError;
      }

      setMerchant(merchantData);

      const { data: analyticsData, error: analyticsError } = await supabase.functions.invoke(
        "merchant-dashboard"
      );

      if (!analyticsError && analyticsData) {
        setAnalytics(analyticsData);
      }

      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setTransactions(transactionsData || []);

      const { data: allTransactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false });

      setAllTransactions(allTransactionsData || []);
    } catch (error: any) {
      console.error("Error loading merchant data:", error);
      toast.error("Failed to load merchant data");
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      loadMerchantData();
    }
  }, [user, loadMerchantData]);

  const handleConnectStripe = async () => {
    if (!merchant) return;

    setConnectingStripe(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-stripe-connect-account",
        {
          body: { merchantId: merchant.id },
        }
      );

      if (error) {
        console.error("Stripe Connect invocation error:", error);
        toast.error("Failed to connect Stripe account");
        return;
      }

      if (data?.error || data?.success === false) {
        console.error("Stripe Connect error:", data.error);
        toast.error(data.error || "Failed to connect Stripe account");
        return;
      }

      if (data?.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        throw new Error("No onboarding URL received");
      }
    } catch (error: any) {
      console.error("Unexpected error connecting Stripe:", error);
      toast.error("Failed to connect Stripe account");
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleUpdateProfile = async (formData: FormData, logoFile: File | null) => {
    if (!merchant || !user) return;

    try {
      let logoUrl = merchant.logo_url;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('merchant-logos')
          .upload(filePath, logoFile);

        if (uploadError) {
          throw new Error("Failed to upload logo");
        }

        const { data: urlData } = supabase.storage
          .from('merchant-logos')
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      const newAddress = formData.get("address") as string;
      const addressChanged = newAddress !== merchant.address;

      const updates = {
        business_name: formData.get("businessName") as string,
        contact_person: formData.get("contactPerson") as string,
        phone: formData.get("phone") as string || null,
        business_type: formData.get("businessType") as string,
        address: newAddress,
        description: formData.get("description") as string,
        logo_url: logoUrl,
      };

      const { error } = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", merchant.id);

      if (error) throw error;

      if (addressChanged && newAddress) {
        geocodeAddress(newAddress, merchant.id);
      }

      toast.success("Profile updated successfully!");
      setEditDialogOpen(false);
      loadMerchantData();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleRequestFunding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!merchant) return;

    setRequestingFunding(true);

    try {
      const formData = new FormData(e.currentTarget);
      const requestedAmount = parseFloat(formData.get("requestedAmount") as string);
      const reason = formData.get("reason") as string;
      const estimatedMonthlySales = parseFloat(formData.get("estimatedMonthlySales") as string);

      const { error } = await supabase
        .from("funding_requests")
        .insert({
          merchant_id: merchant.id,
          requested_amount: requestedAmount,
          reason,
          estimated_monthly_sales: estimatedMonthlySales,
        });

      if (error) throw error;

      toast.success(`Funding request for $${requestedAmount.toFixed(2)} submitted successfully!`);
      setFundingDialogOpen(false);
    } catch (error: any) {
      console.error("Error requesting funding:", error);
      toast.error("Failed to submit funding request");
    } finally {
      setRequestingFunding(false);
    }
  };

  const handleTogglePawbucks = async (checked: boolean) => {
    if (!merchant) return;
    
    setTogglingPawbucks(true);
    try {
      const { error } = await supabase
        .from("merchants")
        .update({ accepts_pawbucks: checked })
        .eq("id", merchant.id);

      if (error) throw error;

      setMerchant({ ...merchant, accepts_pawbucks: checked });
      toast.success(checked ? "Now accepting PawBucks!" : "PawBucks acceptance disabled");
    } catch (error) {
      console.error("Error toggling PawBucks:", error);
      toast.error("Failed to update PawBucks setting");
    } finally {
      setTogglingPawbucks(false);
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setMobileNavOpen(false);
  }, []);

  const getMonthlySalesData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};

    allTransactions.forEach((transaction) => {
      const month = format(startOfMonth(parseISO(transaction.created_at)), "MMM yyyy");
      monthlyData[month] = (monthlyData[month] || 0) + transaction.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6);
  }, [allTransactions]);

  const getCashbackDistribution = useMemo(() => {
    const totalRewardsPawBucks = allTransactions.reduce((sum, t) => sum + (t.rewards_earned || 0), 0);
    const totalRewardsUSD = totalRewardsPawBucks * 0.001;
    const remainingBalance = analytics?.remaining_balance || 0;

    return [
      { name: "Rewards Given", value: totalRewardsUSD, color: "hsl(var(--accent))" },
      { name: "Remaining Balance", value: remainingBalance, color: "hsl(var(--primary))" }
    ].filter(item => item.value > 0);
  }, [allTransactions, analytics?.remaining_balance]);

  // Find current tab info for header
  const currentTabInfo = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const item = section.items.find(i => i.id === activeTab);
      if (item) return item;
    }
    return NAV_SECTIONS[0].items[0];
  }, [activeTab]);

  // Render tab content
  const renderTabContent = useCallback(() => {
    if (!merchant) return null;

    switch (activeTab) {
      case "overview":
        return (
          <MerchantOverviewTab
            merchant={merchant}
            analytics={analytics}
            transactions={transactions}
            monthlySalesData={getMonthlySalesData}
            cashbackDistribution={getCashbackDistribution}
            onConnectStripe={handleConnectStripe}
            onTogglePawbucks={handleTogglePawbucks}
            connectingStripe={connectingStripe}
            togglingPawbucks={togglingPawbucks}
            onViewWallet={() => navigate('/merchant/pawbucks')}
          />
        );
      case "analytics":
        return <MerchantEarningsTab />;
      case "premium":
        return (
          <MerchantPremiumServicesTab
            merchantId={merchant.id}
            hasSponsored={hasSponsored}
            hasPremiumAd={hasPremiumAd}
            hasFeaturedPartner={hasFeaturedPartner}
            hasSearchBooster={hasSearchBooster}
            hasProfileOptimization={hasProfileOptimization}
            hasReviewCampaign={hasReviewCampaign}
            hasPrioritySupport={hasPrioritySupport}
            hasSpotlight={hasSpotlight}
            onNavigate={navigate}
          />
        );
      case "actions":
        return (
          <MerchantQuickActionsTab
            hasStripeAccount={!!merchant.stripe_account_id}
            onViewTransactions={() => setTransactionsDialogOpen(true)}
            onRequestFunding={() => setFundingDialogOpen(true)}
            onEditProfile={() => setEditDialogOpen(true)}
            onNavigate={navigate}
          />
        );
      default:
        return null;
    }
  }, [activeTab, merchant, analytics, transactions, getMonthlySalesData, getCashbackDistribution, connectingStripe, togglingPawbucks, hasSponsored, hasPremiumAd, hasFeaturedPartner, hasSearchBooster, hasProfileOptimization, hasReviewCampaign, hasPrioritySupport, hasSpotlight, navigate]);

  // Navigation sidebar component
  const NavigationSidebar = ({ className }: { className?: string }) => (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Logo and Title */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <PawPrint className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg truncate">{merchant?.business_name || "Merchant"}</h1>
            <p className="text-xs text-muted-foreground">Merchant Dashboard</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Merchant
          </Badge>
          {hasPremiumServices && (
            <Badge variant="default" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Premium
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 py-2">
        <div className="px-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <TooltipProvider key={item.id} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleTabChange(item.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                              "hover:bg-accent/50 hover:text-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive && "bg-primary/10 text-primary border-l-2 border-primary"
                            )}
                          >
                            <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
                            <span className="truncate">{item.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-3 border-t space-y-2">
        <Separator className="mb-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading merchant dashboard...</p>
        </div>
      </div>
    );
  }

  if (!merchant) {
    return null;
  }

  return (
    <>
      <SEO 
        title="Merchant Dashboard - PawBucks"
        description="Manage your PawBucks merchant account, track sales, and view analytics."
        keywords={["merchant dashboard", "PawBucks merchant", "sales analytics"]}
        noIndex={true}
      />
      <TooltipProvider>
        <div className="min-h-screen bg-background flex">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex w-64 border-r bg-card flex-shrink-0 sticky top-0 h-screen">
            <NavigationSidebar />
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-screen">
            {/* Top Header */}
            <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-area-inset-top">
              <div className="flex items-center justify-between px-4 h-16">
                {/* Mobile Menu */}
                <div className="flex items-center gap-3 lg:hidden">
                  <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72">
                      <NavigationSidebar />
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Current Page Info */}
                <div className="flex items-center gap-3">
                  <div className="hidden lg:block">
                    {currentTabInfo && (
                      <div className="flex items-center gap-2">
                        <currentTabInfo.icon className="w-5 h-5 text-primary" />
                        <div>
                          <h2 className="font-semibold">{currentTabInfo.label}</h2>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="lg:hidden">
                    <h2 className="font-semibold">{currentTabInfo?.label}</h2>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2">
                  {user && <NotificationsDropdown userId={user.id} />}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <HelpCircle className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px]">
                        <p className="font-semibold mb-1">{currentTabInfo?.label}</p>
                        <p className="text-xs text-muted-foreground">{currentTabInfo?.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="lg:hidden"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
              <div className="max-w-7xl mx-auto">
                {/* Description Card for Context */}
                <Card className="mb-6 bg-muted/30 border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {currentTabInfo?.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Tab Content */}
                {renderTabContent()}
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>

      {/* Dialogs */}
      <EditMerchantProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        merchant={merchant}
        onSubmit={handleUpdateProfile}
      />

      <TransactionsDialog
        open={transactionsDialogOpen}
        onOpenChange={setTransactionsDialogOpen}
        transactions={transactions}
      />

      <FundingRequestDialog
        open={fundingDialogOpen}
        onOpenChange={setFundingDialogOpen}
        totalSales={analytics?.total_sales || 0}
        onSubmit={handleRequestFunding}
        isSubmitting={requestingFunding}
      />
    </>
  );
};

export default MerchantDashboard;

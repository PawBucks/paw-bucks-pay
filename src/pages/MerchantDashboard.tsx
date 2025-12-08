import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGeocoding } from "@/hooks/useGeocoding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  LogOut,
  PawPrint,
  ExternalLink,
  Edit,
  Loader2,
  CreditCard,
  FileText,
  ShoppingCart,
  AlertCircle,
  Package,
  Coins,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, startOfMonth, parseISO } from "date-fns";

// Extracted components
import { MerchantAnalyticsCards } from "@/components/merchant/MerchantAnalyticsCards";
import { MerchantCharts } from "@/components/merchant/MerchantCharts";
import { MerchantTransactionList } from "@/components/merchant/MerchantTransactionList";
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
  description: string;
  created_at: string;
};

const MerchantDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { geocodeAddress } = useGeocoding();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [requestingFunding, setRequestingFunding] = useState(false);
  const [togglingPawbucks, setTogglingPawbucks] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadMerchantData();
    }
  }, [user]);

  const loadMerchantData = async () => {
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
  };

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
        toast.error("Failed to connect Stripe account", {
          description: "Network error. Please check your connection and try again.",
          duration: 5000,
        });
        return;
      }

      if (data?.error || data?.success === false) {
        console.error("Stripe Connect error:", data.error || data.originalError);
        const errorMessage = data.error || "An unexpected error occurred";

        if (errorMessage.includes("PLATFORM_NOT_CONFIGURED") || errorMessage.includes("platform-profile")) {
          toast.error("Stripe Platform Setup Required", {
            description: (
              <>
                <p className="mb-2">Before merchants can accept payments, the platform owner must complete Stripe Connect setup:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Visit <a href="https://dashboard.stripe.com/settings/connect" target="_blank" rel="noopener noreferrer" className="underline font-medium">Stripe Dashboard</a></li>
                  <li>Go to Settings → Connect → Platform Profile</li>
                  <li>Complete all required fields</li>
                  <li>Select who manages losses for connected accounts</li>
                </ol>
                <p className="mt-2 text-xs opacity-80">This is a one-time setup required by Stripe.</p>
              </>
            ),
            duration: 20000,
          });
        } else if (errorMessage.includes("CAPABILITIES_ERROR") || errorMessage.includes("capabilities")) {
          toast.error("Payment Capabilities Error", {
            description: "Unable to enable payment capabilities. Please ensure your Stripe account has the necessary permissions.",
            duration: 6000,
          });
        } else {
          toast.error("Failed to connect Stripe account", {
            description: errorMessage.replace(/^[A-Z_]+:\s*/, ''),
            duration: 6000,
          });
        }
        return;
      }

      if (data?.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        throw new Error("No onboarding URL received");
      }
    } catch (error: any) {
      console.error("Unexpected error connecting Stripe:", error);
      toast.error("Failed to connect Stripe account", {
        description: "An unexpected error occurred. Please try again.",
        duration: 5000,
      });
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

      // Geocode the new address if it changed
      if (addressChanged && newAddress) {
        geocodeAddress(newAddress, merchant.id).then(result => {
          if (result.latitude && result.longitude) {
            console.log(`Merchant geocoded: lat=${result.latitude}, lng=${result.longitude}`);
          } else {
            console.warn("Could not geocode merchant address:", result.error);
          }
        }).catch(err => {
          console.error("Geocoding error:", err);
        });
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

  const getMonthlySalesData = () => {
    const monthlyData: { [key: string]: number } = {};

    allTransactions.forEach((transaction) => {
      const month = format(startOfMonth(parseISO(transaction.created_at)), "MMM yyyy");
      monthlyData[month] = (monthlyData[month] || 0) + transaction.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6);
  };

  const getCashbackDistribution = () => {
    // total_cashback is stored in PawBucks, convert to USD (1000 PawBucks = $1)
    const totalRewardsUSD = (analytics?.total_cashback || 0) / 1000;
    const remainingBalance = analytics?.remaining_balance || 0;

    return [
      { name: "Rewards Given", value: totalRewardsUSD, color: "hsl(var(--accent))" },
      { name: "Remaining Balance", value: remainingBalance, color: "hsl(var(--primary))" }
    ].filter(item => item.value > 0);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!merchant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm safe-area-inset-top">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{merchant.business_name}</h1>
              <p className="text-xs text-muted-foreground">Merchant Dashboard</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Merchant Dashboard</h1>
          <p className="text-muted-foreground">
            Track your PawBucks sales, rewards, and repayments in one place.
          </p>
        </div>

        {/* Stripe Connect Status */}
        {!merchant.stripe_account_id && (
          <GradientCard gradient className="mb-6 bg-accent/10 border-accent/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Connect Your Bank Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up Stripe Connect to receive payments directly to your bank account
                  </p>
                </div>
                <Button onClick={handleConnectStripe} disabled={connectingStripe}>
                  {connectingStripe ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect Stripe
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs bg-background/50 p-3 rounded-md border border-border/50">
                <p className="font-medium mb-2 text-warning flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Important: Platform Setup Required
                </p>
                <p className="opacity-90 mb-2">
                  If you see an error when clicking "Connect Stripe", it means the platform owner needs to complete a one-time Stripe Connect setup:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2 opacity-80">
                  <li>Visit <a href="https://dashboard.stripe.com/settings/connect" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Stripe Dashboard</a></li>
                  <li>Go to Settings → Connect → Platform Profile</li>
                  <li>Complete all required fields including loss management selection</li>
                </ol>
              </div>
            </div>
          </GradientCard>
        )}

        {/* PawBucks Acceptance Settings */}
        {merchant.stripe_account_id && (
          <GradientCard className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Accept PawBucks</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow customers to pay with PawBucks (1000 PawBucks = $1.00)
                  </p>
                </div>
              </div>
              <Switch
                checked={merchant.accepts_pawbucks ?? false}
                onCheckedChange={handleTogglePawbucks}
                disabled={togglingPawbucks}
              />
            </div>
            {merchant.accepts_pawbucks && (
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Customers can now pay using their PawBucks balance
                </p>
              </div>
            )}
          </GradientCard>
        )}

        {/* Analytics Summary Cards */}
        <MerchantAnalyticsCards analytics={analytics} />

        {/* Repayment Progress */}
        {analytics?.funding_deal_status === 'active' && analytics?.remaining_balance !== undefined && (
          <GradientCard className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Repayment Progress</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Funding Balance Remaining</span>
                <span className="font-bold">${analytics.remaining_balance.toFixed(2)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-accent to-secondary h-full transition-all duration-500 rounded-full"
                  style={{ width: analytics.remaining_balance > 0 ? '100%' : '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.repayment_rate}% of each sale goes toward repayment
              </p>
            </div>
          </GradientCard>
        )}

        {!analytics?.funding_deal_status && (
          <GradientCard className="mb-8 text-center py-8">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No active funding deal</p>
          </GradientCard>
        )}

        {/* Charts */}
        <MerchantCharts
          monthlySalesData={getMonthlySalesData()}
          cashbackDistribution={getCashbackDistribution()}
        />

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Button
            variant="outline"
            className="h-auto py-4 justify-start"
            onClick={() => setTransactionsDialogOpen(true)}
          >
            <FileText className="w-5 h-5 mr-3" />
            <div className="text-left">
              <p className="font-semibold">View Detailed Transactions</p>
              <p className="text-xs text-muted-foreground">See all activity</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 justify-start"
            onClick={() => setFundingDialogOpen(true)}
          >
            <CreditCard className="w-5 h-5 mr-3" />
            <div className="text-left">
              <p className="font-semibold">Request Funding</p>
              <p className="text-xs text-muted-foreground">Get advance on earnings</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 justify-start"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="w-5 h-5 mr-3" />
            <div className="text-left">
              <p className="font-semibold">Edit Profile</p>
              <p className="text-xs text-muted-foreground">Update business info</p>
            </div>
          </Button>
          {merchant.stripe_account_id && (
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => navigate("/merchant/products")}
            >
              <Package className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Manage Products</p>
                <p className="text-xs text-muted-foreground">Add and edit products</p>
              </div>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-auto py-4 justify-start"
            onClick={() => navigate("/merchant/offers")}
          >
            <ShoppingCart className="w-5 h-5 mr-3" />
            <div className="text-left">
              <p className="font-semibold">Partner Offers</p>
              <p className="text-xs text-muted-foreground">PawBucks redemptions</p>
            </div>
          </Button>
        </div>

        {/* Recent Transactions */}
        <MerchantTransactionList transactions={transactions} />
      </main>

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
    </div>
  );
};

export default MerchantDashboard;

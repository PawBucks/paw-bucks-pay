import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  PawPrint,
  TrendingUp,
  Users,
  DollarSign,
  Percent,
  ExternalLink,
  Edit,
  Loader2,
  Clock,
  CreditCard,
  FileText,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Merchant = {
  id: string;
  business_name: string;
  contact_person: string;
  business_type: string;
  address?: string;
  description?: string;
  cashback_rate: number;
  stripe_account_id?: string;
  stripe_account_status?: string;
  logo_url?: string;
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
      // Load merchant profile
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

      // Load analytics using edge function
      const { data: analyticsData, error: analyticsError } = await supabase.functions.invoke(
        "merchant-dashboard"
      );

      if (!analyticsError && analyticsData) {
        setAnalytics(analyticsData);
      }

      // Load recent transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setTransactions(transactionsData || []);

      // Load all transactions for chart
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

      // Handle network/invocation errors
      if (error) {
        console.error("Stripe Connect invocation error:", error);
        toast.error("Failed to connect Stripe account", {
          description: "Network error. Please check your connection and try again.",
          duration: 5000,
        });
        return;
      }

      // Handle application errors (returned with success: false)
      if (data?.error || data?.success === false) {
        console.error("Stripe Connect error:", data.error || data.originalError);
        
        const errorMessage = data.error || "An unexpected error occurred";
        
        // Check for specific error types
        if (errorMessage.includes("PLATFORM_NOT_CONFIGURED") || errorMessage.includes("platform-profile")) {
          toast.error("Stripe Platform Configuration Required", {
            description: "Your Stripe Connect platform needs to be configured. Please go to Stripe Dashboard → Settings → Connect → Platform Profile and complete the setup, including selecting who manages losses for connected accounts.",
            duration: 12000,
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

      // Success - redirect to Stripe onboarding
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!merchant || !user) return;

    try {
      const formData = new FormData(e.currentTarget);
      
      // Upload logo if provided
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

      const updates = {
        business_name: formData.get("businessName") as string,
        contact_person: formData.get("contactPerson") as string,
        business_type: formData.get("businessType") as string,
        address: formData.get("address") as string,
        description: formData.get("description") as string,
        logo_url: logoUrl,
      };

      const { error } = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", merchant.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      setEditDialogOpen(false);
      setLogoFile(null);
      setLogoPreview(null);
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

  const getMonthlySalesData = () => {
    const monthlyData: { [key: string]: number } = {};

    allTransactions.forEach((transaction) => {
      const month = format(startOfMonth(parseISO(transaction.created_at)), "MMM yyyy");
      monthlyData[month] = (monthlyData[month] || 0) + transaction.amount;
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6); // Last 6 months
  };

  const getCashbackDistribution = () => {
    const totalCashback = analytics?.total_cashback || 0;
    const remainingBalance = analytics?.remaining_balance || 0;
    
    return [
      { name: "Cashback Given", value: totalCashback, color: "hsl(var(--accent))" },
      { name: "Remaining Balance", value: remainingBalance, color: "hsl(var(--primary))" }
    ].filter(item => item.value > 0);
  };

  const getRepaymentProgress = () => {
    if (!analytics?.funding_deal_status || analytics.funding_deal_status !== 'active') {
      return null;
    }
    
    // We need to calculate what was funded originally
    // remaining_balance = amount_funded - total_repaid
    // So: amount_funded = remaining_balance + total_repaid (we need total_repaid)
    // For now, we'll estimate the progress from remaining balance
    const remaining = analytics.remaining_balance || 0;
    
    // This is a simplified calculation - ideally we'd fetch the original funding amount
    if (remaining === 0) return 100;
    
    // Estimate: if repayment rate is 10%, assume they've repaid some portion
    // This is approximate without the original amount_funded
    return null; // We can't accurately calculate without amount_funded from the API
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
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
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
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Merchant Dashboard</h1>
          <p className="text-muted-foreground">
            Track your PawBucks sales, cashback, and repayments in one place.
          </p>
        </div>

        {/* Stripe Connect Status */}
        {!merchant.stripe_account_id && (
          <GradientCard gradient className="mb-6 bg-accent/10 border-accent/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
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
          </GradientCard>
        )}

        {/* Analytics Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <GradientCard gradient>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">
                  ${analytics?.total_sales?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Percent className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cashback Given</p>
                <p className="text-2xl font-bold">
                  ${analytics?.total_cashback?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Repayment Remaining</p>
                <p className="text-2xl font-bold">
                  ${analytics?.remaining_balance?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Repayment Rate</p>
                <p className="text-2xl font-bold">
                  {analytics?.repayment_rate ? `${analytics.repayment_rate}%` : "N/A"}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{analytics?.total_transactions || 0}</p>
              </div>
            </div>
          </GradientCard>
        </div>

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
                  style={{ 
                    width: analytics.remaining_balance > 0 ? '100%' : '0%'
                  }}
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

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Monthly Sales Chart */}
          <GradientCard>
            <h3 className="text-xl font-semibold mb-4">Monthly Sales Overview</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getMonthlySalesData()}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-sm"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-sm"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Sales']}
                />
                <Bar dataKey="amount" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GradientCard>

          {/* Cashback Distribution Chart */}
          <GradientCard>
            <h3 className="text-xl font-semibold mb-4">Cashback vs Balance Distribution</h3>
            {getCashbackDistribution().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getCashbackDistribution()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {getCashbackDistribution().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </GradientCard>
        </div>

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
        </div>

        {/* Recent Transactions */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-accent">
                      +${transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cashback: ${transaction.cashback_earned.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          )}
        </GradientCard>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Business Profile</DialogTitle>
            <DialogDescription>Update your business information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                defaultValue={merchant.business_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                name="contactPerson"
                defaultValue={merchant.contact_person}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <select
                id="businessType"
                name="businessType"
                defaultValue={merchant.business_type}
                className="w-full p-3 rounded-lg border bg-background"
                required
              >
                <option value="vet">Vet</option>
                <option value="groomer">Groomer</option>
                <option value="sitter">Sitter</option>
                <option value="pet_store">Pet Store</option>
                <option value="walker">Walker</option>
                <option value="trainer">Trainer</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Business Logo</Label>
              <div className="flex flex-col gap-4">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {(logoPreview || merchant.logo_url) && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-border">
                    <img
                      src={logoPreview || merchant.logo_url || ""}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                defaultValue={merchant.address || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={merchant.description || ""}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View All Transactions Dialog */}
      <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Transactions</DialogTitle>
            <DialogDescription>
              Complete history of your business transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-accent">
                      +${transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cashback: ${transaction.cashback_earned.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Funding Dialog */}
      <Dialog open={fundingDialogOpen} onOpenChange={setFundingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Funding</DialogTitle>
            <DialogDescription>
              Get an advance on your future earnings to grow your business
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestFunding} className="space-y-4">
            <div className="bg-muted rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Available to borrow:</span>
                <span className="font-bold">
                  ${((analytics?.total_sales || 0) * 0.8).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Up to 80% of your total sales
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedAmount">Requested Amount ($)</Label>
              <Input
                id="requestedAmount"
                name="requestedAmount"
                type="number"
                step="0.01"
                min="100"
                max={(analytics?.total_sales || 0) * 0.8}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Funding</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Inventory, equipment, marketing, etc."
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedMonthlySales">Estimated Monthly Sales ($)</Label>
              <Input
                id="estimatedMonthlySales"
                name="estimatedMonthlySales"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <p className="text-sm font-semibold mb-1">Funding Terms</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• 5% fee on funded amount</li>
                <li>• Repaid automatically from future transactions</li>
                <li>• No fixed repayment schedule</li>
                <li>• Funds deposited within 1-2 business days</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFundingDialogOpen(false)}
                className="flex-1"
                disabled={requestingFunding}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={requestingFunding}>
                {requestingFunding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Request Funding"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantDashboard;
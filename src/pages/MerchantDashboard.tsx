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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const [editCashbackDialogOpen, setEditCashbackDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [requestingFunding, setRequestingFunding] = useState(false);

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

      if (error) throw error;

      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    } catch (error: any) {
      console.error("Error connecting Stripe:", error);
      toast.error("Failed to connect Stripe account");
      setConnectingStripe(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!merchant) return;

    try {
      const formData = new FormData(e.currentTarget);
      const updates = {
        business_name: formData.get("businessName") as string,
        contact_person: formData.get("contactPerson") as string,
        address: formData.get("address") as string,
        description: formData.get("description") as string,
        cashback_rate: parseFloat(formData.get("cashbackRate") as string),
      };

      const { error } = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", merchant.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      setEditDialogOpen(false);
      loadMerchantData();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleUpdateCashback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!merchant) return;

    try {
      const formData = new FormData(e.currentTarget);
      const newRate = parseFloat(formData.get("cashbackRate") as string);

      const { error } = await supabase
        .from("merchants")
        .update({ cashback_rate: newRate })
        .eq("id", merchant.id);

      if (error) throw error;

      toast.success("Cashback rate updated successfully!");
      setEditCashbackDialogOpen(false);
      loadMerchantData();
    } catch (error: any) {
      console.error("Error updating cashback rate:", error);
      toast.error("Failed to update cashback rate");
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
      <header className="border-b bg-card sticky top-0 z-10">
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
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stripe Connect Status */}
        {!merchant.stripe_account_id && (
          <GradientCard gradient className="mb-6 bg-accent/10 border-accent/20">
            <div className="flex items-center justify-between">
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

        {/* Monthly Sales Chart */}
        <GradientCard className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Monthly Sales Volume</h3>
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

        {/* Action Buttons */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <GradientCard className="cursor-pointer hover:shadow-[var(--shadow-glow)] transition-all" onClick={() => setEditCashbackDialogOpen(true)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Percent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Edit Cashback Rate</p>
                <p className="text-sm text-muted-foreground">Current: {merchant.cashback_rate}%</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard className="cursor-pointer hover:shadow-[var(--shadow-glow)] transition-all" onClick={() => setTransactionsDialogOpen(true)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold">View All Transactions</p>
                <p className="text-sm text-muted-foreground">{analytics?.total_transactions || 0} total</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard className="cursor-pointer hover:shadow-[var(--shadow-glow)] transition-all" onClick={() => setFundingDialogOpen(true)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-semibold">Request Funding</p>
                <p className="text-sm text-muted-foreground">Get advance on earnings</p>
              </div>
            </div>
          </GradientCard>
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
            <div className="space-y-2">
              <Label htmlFor="cashbackRate">Cashback Rate (%)</Label>
              <Input
                id="cashbackRate"
                name="cashbackRate"
                type="number"
                step="0.01"
                defaultValue={merchant.cashback_rate}
                required
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

      {/* Edit Cashback Rate Dialog */}
      <Dialog open={editCashbackDialogOpen} onOpenChange={setEditCashbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cashback Rate</DialogTitle>
            <DialogDescription>
              Set the percentage of each transaction you'll offer as cashback
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCashback} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCashbackRate">Cashback Rate (%)</Label>
              <Input
                id="newCashbackRate"
                name="cashbackRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={merchant.cashback_rate}
                required
              />
              <p className="text-sm text-muted-foreground">
                Higher rates attract more customers but reduce your profit margin
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCashbackDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Update Rate
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
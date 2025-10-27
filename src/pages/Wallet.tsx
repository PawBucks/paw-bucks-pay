import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { LogOut, PawPrint, Wallet as WalletIcon, TrendingUp, Gift, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type WalletData = {
  balance: number;
  rewards_points: number;
  total_spent: number;
};

type Transaction = {
  id: string;
  amount: number;
  cashback_amount: number;
  rewards_earned: number;
  description: string;
  created_at: string;
  merchant_id: string;
};

const Wallet = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadWalletData();
      loadTransactions();
    }
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setWallet(data);
    } catch (error: any) {
      console.error("Error loading wallet:", error);
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("pet_owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error loading transactions:", error);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              PetalPay
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/discover")}>
              Discover
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">My Wallet</h2>
          <p className="text-muted-foreground">Track your cashback and spending</p>
        </div>

        {/* Wallet Overview */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <GradientCard gradient>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <WalletIcon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-accent">${wallet?.balance?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">${wallet?.total_spent?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Gift className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rewards Points</p>
                <p className="text-2xl font-bold">{wallet?.rewards_points || 0}</p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* Recent Transactions */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
          {transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(transaction.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">-${transaction.amount.toFixed(2)}</p>
                    <p className="text-sm text-accent">+${transaction.cashback_amount.toFixed(2)} cashback</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No transactions yet</p>
              <Button onClick={() => navigate("/discover")}>
                Start Shopping
              </Button>
            </div>
          )}
        </GradientCard>
      </main>
    </div>
  );
};

export default Wallet;
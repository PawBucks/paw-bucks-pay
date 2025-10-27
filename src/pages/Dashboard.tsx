import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Wallet, Gift, TrendingUp, LogOut, Store, Users } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  user_type: "pet_owner" | "merchant";
  full_name: string;
};

type WalletData = {
  balance: number;
  rewards_points: number;
};

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      toast.error("Failed to load profile");
      return;
    }

    setProfile(profileData);

    if (profileData.user_type === "pet_owner") {
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletError) {
        console.error("Wallet error:", walletError);
      } else {
        setWallet(walletData);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
            PetalPay
          </h1>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {profile.full_name}!</h2>
          <p className="text-muted-foreground">
            {profile.user_type === "pet_owner" ? "Manage your pet expenses and rewards" : "Manage your business transactions"}
          </p>
        </div>

        {profile.user_type === "pet_owner" ? (
          <div className="grid gap-6 md:grid-cols-3">
            <GradientCard gradient>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="text-2xl font-bold">${wallet?.balance?.toFixed(2) || "0.00"}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rewards Points</p>
                  <p className="text-2xl font-bold">{wallet?.rewards_points || 0}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saved</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard className="md:col-span-3">
              <h3 className="text-xl font-semibold mb-4">Nearby Pet Services</h3>
              <p className="text-muted-foreground">Discover pet stores, groomers, and trainers near you.</p>
              <div className="mt-4 flex gap-4">
                <Button>Find Services</Button>
                <Button variant="outline">View History</Button>
              </div>
            </GradientCard>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <GradientCard gradient>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Store className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard className="md:col-span-3">
              <h3 className="text-xl font-semibold mb-4">Business Management</h3>
              <p className="text-muted-foreground">View transactions, manage your business profile, and track analytics.</p>
              <div className="mt-4 flex gap-4">
                <Button>View Transactions</Button>
                <Button variant="outline">Edit Profile</Button>
              </div>
            </GradientCard>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
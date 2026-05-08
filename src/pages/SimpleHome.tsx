import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { usePawBucksRealtime } from "@/hooks/usePawBucksRealtime";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { SavingsHero } from "@/components/simple/SavingsHero";
import { Button } from "@/components/ui/button";
import { Search, Receipt, PawPrint, ChevronRight } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Formatters } from "@/utils/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MaximusChat } from "@/components/maximus/MaximusChat";

const PB_TO_USD = 0.001;

const SimpleHome = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, pets, dataLoading, effectiveWalletUserId } = useDashboardData();
  const walletId = effectiveWalletUserId || user?.id;
  usePawBucksRealtime(walletId);

  const { spendableBalance, petFundBalance, welcomeCreditBalance } =
    useSpendablePawBucks(user?.id);

  // Total $ available = earned + promotional, displayed in USD only
  const availableUsd = useMemo(
    () =>
      (spendableBalance + petFundBalance + welcomeCreditBalance) * PB_TO_USD,
    [spendableBalance, petFundBalance, welcomeCreditBalance],
  );

  const { data: recentSaves } = useQuery({
    queryKey: ["simple-recent-saves", walletId],
    queryFn: async () => {
      if (!walletId) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, cashback_earned, created_at, merchants(business_name)")
        .eq("user_id", walletId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!walletId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    else if (!authLoading && profile?.user_type === "merchant") navigate("/merchant-dashboard");
  }, [user, authLoading, profile, navigate]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <SEO title="Home — PawBucks" description="Pay for pet care and save automatically." noIndex />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />

        <main className="flex-1 container mx-auto px-4 pt-6 pb-28 md:pb-10 max-w-2xl">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5"
          >
            <p className="text-sm text-muted-foreground">Hi {firstName} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Pay for pet care. Save automatically.
            </h1>
          </motion.div>

          {/* Savings hero */}
          <SavingsHero
            availableUsd={availableUsd}
            helperText={
              availableUsd > 0
                ? "Auto-applied next time you pay"
                : "Your savings grow every time you pay"
            }
          />

          {/* Primary actions */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-16 text-base rounded-xl shadow-[var(--shadow-medium)]"
              onClick={() => navigate("/pay")}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Pay & save
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 text-base rounded-xl"
              onClick={() => navigate("/discover")}
            >
              <Search className="h-5 w-5 mr-2" />
              Find a place
            </Button>
          </div>

          {/* Recent saves */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Recent visits
              </h2>
              <button
                className="text-sm text-primary inline-flex items-center hover:underline"
                onClick={() => navigate("/savings")}
              >
                View all <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {(!recentSaves || recentSaves.length === 0) ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No visits yet. Your first payment starts your savings.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {recentSaves.map((t: any) => {
                  const saved = (t.cashback_earned ?? 0) * PB_TO_USD;
                  return (
                    <li key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.merchants?.business_name ?? "Pet care"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), "MMM d")} · paid{" "}
                          {Formatters.currency(t.amount ?? 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-success">
                          +{Formatters.currency(saved)}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          saved
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pets — kept ultra simple */}
          {pets.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Your pets
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/pet-health/${p.id}`)}
                    className="flex flex-col items-center gap-2 min-w-[72px]"
                  >
                    <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-1 ring-border">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <PawPrint className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-xs font-medium truncate max-w-[72px]">{p.name}</span>
                  </button>
                ))}
                <button
                  onClick={() => navigate("/create-pet-profile")}
                  className="flex flex-col items-center gap-2 min-w-[72px]"
                >
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                    +
                  </div>
                  <span className="text-xs text-muted-foreground">Add pet</span>
                </button>
              </div>
            </section>
          )}

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Every payment automatically builds your savings. No points to manage.
          </p>
        </main>

        <BottomNav />
        <MaximusChat />
      </div>
    </>
  );
};

export default SimpleHome;
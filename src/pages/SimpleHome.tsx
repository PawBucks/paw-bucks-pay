import { useEffect, useMemo, useState } from "react";
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
import { Search, ChevronRight, FileText, CalendarPlus } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Formatters } from "@/utils/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MaximusChat } from "@/components/maximus/MaximusChat";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { CustomerLoyaltyCards } from "@/components/dashboard/CustomerLoyaltyCards";
import { ConfettiCanvas } from "@/components/birthday/ConfettiCanvas";
import { BirthdayOverlay } from "@/components/birthday/BirthdayOverlay";
import { BirthdayBanner } from "@/components/birthday/BirthdayBanner";
import { getTodayBirthdays } from "@/components/birthday/birthdayUtils";
import { CheckInFollowupBanner } from "@/components/checkin";

const PB_TO_USD = 0.001;

const SimpleHome = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { profile, pets, dataLoading, effectiveWalletUserId } = useDashboardData();
  const walletId = effectiveWalletUserId || user?.id;
  usePawBucksRealtime(walletId);

  const { spendableBalance, petFundBalance, welcomeCreditBalance } =
    useSpendablePawBucks(user?.id);

  // Birthday detection
  const birthdayPets = useMemo(() => getTodayBirthdays(pets as any), [pets]);
  const hasBirthday = birthdayPets.length > 0;
  const sessionKey = `pb_bday_shown_${new Date().toDateString()}`;
  const bannerKey = `pb_bday_banner_${new Date().toDateString()}`;

  const [showOverlay, setShowOverlay] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showBanner, setShowBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(bannerKey) !== "dismissed";
  });

  useEffect(() => {
    if (!hasBirthday) return;
    const alreadyShown = sessionStorage.getItem(sessionKey);
    const bannerDismissed = localStorage.getItem(bannerKey) === "dismissed";
    if (alreadyShown) {
      if (!bannerDismissed) setShowBanner(true);
      return;
    }
    sessionStorage.setItem(sessionKey, "1");
    if (!bannerDismissed) {
      setShowConfetti(true);
      setShowOverlay(true);
      setShowBanner(true);
    }
  }, [hasBirthday, sessionKey, bannerKey]);

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
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, amount, cashback_earned, created_at, merchant_id")
        .eq("user_id", walletId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(4);
      const rows = txs ?? [];
      const ids = Array.from(
        new Set(rows.map((r: any) => r.merchant_id).filter(Boolean)),
      );
      let nameById = new Map<string, string>();
      if (ids.length) {
        const { data: merchants } = await supabase
          .from("merchants_public")
          .select("id, business_name")
          .in("id", ids);
        nameById = new Map(
          (merchants ?? []).map((m: any) => [m.id, m.business_name]),
        );
      }
      return rows.map((r: any) => ({
        ...r,
        merchants: { business_name: nameById.get(r.merchant_id) ?? null },
      }));
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
        <ConfettiCanvas active={showConfetti} onDone={() => setShowConfetti(false)} />
        {showOverlay && (
          <BirthdayOverlay pets={birthdayPets as any} onDismiss={() => setShowOverlay(false)} />
        )}
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />

        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-12 pb-28 md:pb-10 max-w-6xl">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 lg:mb-10"
          >
            <p className="text-sm text-muted-foreground">Hi {firstName} 👋</p>
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-semibold tracking-tight lg:leading-tight max-w-5xl">
              Pay for pet care. Save automatically.
            </h1>
          </motion.div>

          {/* Birthday banner */}
          {hasBirthday && showBanner && (
            <div className="mb-6">
              <BirthdayBanner
                pets={birthdayPets as any}
                onDismiss={() => {
                  setShowBanner(false);
                  localStorage.setItem(bannerKey, "dismissed");
                }}
              />
            </div>
          )}

      <div className="grid gap-6 lg:gap-10 lg:grid-cols-5">
        {/* Left column — hero + actions */}
        <div className="lg:col-span-3 space-y-5 lg:space-y-6">
          <SavingsHero
            availableUsd={availableUsd}
            helperText={
              availableUsd > 0
                ? "Auto-applied next time you pay"
                : "Your savings grow every time you pay"
            }
          />

          {/* Primary actions */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <Button
              size="lg"
              className="h-16 lg:h-20 text-base lg:text-lg rounded-xl shadow-[var(--shadow-medium)]"
              onClick={() => navigate("/pay")}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Pay & save
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 lg:h-20 text-base lg:text-lg rounded-xl"
              onClick={() => navigate("/discover")}
            >
              <Search className="h-5 w-5 mr-2" />
              Find a place
            </Button>
          </div>

          {/* My New Customer Deals Banner/Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-accent/25 bg-accent/5 p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-accent/10 transition-all group"
            onClick={() => navigate("/my-deals")}
          >
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🎁
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-primary text-sm sm:text-base flex items-center gap-1.5">
                  My New Customer Deals
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  View unlocked reward codes and locked deals from local pet care merchants.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary/70 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </motion.div>
        </div>

        {/* Right column — recent visits + pets */}
        <div className="lg:col-span-2 mt-2 lg:mt-0 space-y-6">
          {/* Recent visits */}
          <section>
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
                <span className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true">🧾</span>
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

          {/* Pets — desktop */}
          {user && (
            <section>
              <CustomerLoyaltyCards userId={user.id} compact />
            </section>
          )}

          {pets.length > 0 && (
            <section className="hidden lg:block">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Your pets
              </h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex gap-3 flex-wrap">
                  {pets.map((p) => (
                    <div key={p.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                      <div className="relative group">
                        <button
                          onClick={() => navigate(`/pet-health/${p.id}`)}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-1 ring-border">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <PawBucksLogo className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        {/* Hover quick actions */}
                        <div className="absolute inset-0 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pet-health/${p.id}`);
                            }}
                            className="p-2 rounded-full bg-accent/90 hover:bg-accent text-accent-foreground shadow-sm transition-colors"
                            aria-label={`View health for ${p.name}`}
                            title="Health history"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/discover?petId=${p.id}&intent=book`);
                            }}
                            className="p-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground shadow-sm transition-colors"
                            aria-label={`Schedule visit for ${p.name}`}
                            title="Schedule visit"
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <span className="text-xs font-medium truncate max-w-[80px]">{p.name}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate("/create-pet-profile")}
                    className="flex flex-col items-center gap-2 min-w-[80px]"
                  >
                    <div className="h-20 w-20 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                      +
                    </div>
                    <span className="text-xs text-muted-foreground">Add pet</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Pets — mobile/tablet */}
      {pets.length > 0 && (
        <section className="mt-6 lg:hidden">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Your pets
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {pets.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2 min-w-[72px]">
                <button
                  onClick={() => navigate(`/pet-health/${p.id}`)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-1 ring-border">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <PawBucksLogo className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs font-medium truncate max-w-[72px]">{p.name}</span>
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate(`/pet-health/${p.id}`)}
                    className="p-1 rounded-md bg-muted hover:bg-accent/20 transition-colors"
                    aria-label={`View health for ${p.name}`}
                    title="Health history"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => navigate(`/discover?petId=${p.id}&intent=book`)}
                    className="p-1 rounded-md bg-muted hover:bg-accent/20 transition-colors"
                    aria-label={`Schedule visit for ${p.name}`}
                    title="Schedule visit"
                  >
                    <CalendarPlus className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
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

          <p className="mt-10 lg:mt-16 text-center text-xs text-muted-foreground">
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
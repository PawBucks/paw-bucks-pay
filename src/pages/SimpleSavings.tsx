import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { SavingsHero } from "@/components/simple/SavingsHero";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { format } from "date-fns";
import { ChevronRight, Info } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";

const PB_TO_USD = 0.001;

const SimpleSavings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const {
    spendableBalance,
    petFundBalance,
    welcomeCreditBalance,
    earnedNextExpiresAt,
    promotionalNextExpiresAt,
  } = useSpendablePawBucks(user?.id);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const earnedUsd = spendableBalance * PB_TO_USD;
  const promoUsd = (petFundBalance + welcomeCreditBalance) * PB_TO_USD;
  const availableUsd = earnedUsd + promoUsd;

  const { data: history } = useQuery({
    queryKey: ["simple-savings-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, amount, cashback_earned, created_at, merchant_id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(25);
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
    enabled: !!user?.id,
  });

  const lifetimeUsd =
    (history ?? []).reduce((s, t: any) => s + (t.cashback_earned ?? 0), 0) *
    PB_TO_USD;

  const expiryLine = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return days <= 0
      ? "Expires today"
      : days === 1
        ? "Expires tomorrow"
        : `Expires in ${days} days · ${format(d, "MMM d")}`;
  };

  return (
    <>
      <SEO title="Your savings — PawBucks" noIndex />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />

        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-12 pb-28 md:pb-10 max-w-6xl">
          <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight mb-4 lg:mb-8">
            Your savings
          </h1>

          <div className="grid gap-6 lg:gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            <SavingsHero
              availableUsd={availableUsd}
              lifetimeUsd={lifetimeUsd}
              onClick={() => navigate("/pay")}
            />

            <Button
              size="lg"
              className="w-full h-14 lg:h-16 rounded-xl text-base lg:text-lg"
              onClick={() => navigate("/pay")}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Use my savings — pay a place
            </Button>

            {/* Expiry reassurance — friendly, never alarming */}
            {(earnedNextExpiresAt || promotionalNextExpiresAt) && availableUsd > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <span className="h-4 w-4 text-muted-foreground" aria-hidden="true">⏰</span>
                Use it before it expires
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {promoUsd > 0 && promotionalNextExpiresAt && (
                  <li>
                    <span className="text-foreground font-medium">
                      {Formatters.currency(promoUsd)}
                    </span>{" "}
                    bonus credit · {expiryLine(promotionalNextExpiresAt)}
                  </li>
                )}
                {earnedUsd > 0 && earnedNextExpiresAt && (
                  <li>
                    <span className="text-foreground font-medium">
                      {Formatters.currency(earnedUsd)}
                    </span>{" "}
                    earned · {expiryLine(earnedNextExpiresAt)}
                  </li>
                )}
              </ul>
            </div>
            )}
          </div>

          {/* History */}
          <section className="lg:col-span-2 mt-2 lg:mt-0">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Savings history
            </h2>
            {(!history || history.length === 0) ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Pay a pet care place to start saving.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden lg:max-h-[640px] lg:overflow-y-auto">
                {history.map((t: any) => {
                  const saved = (t.cashback_earned ?? 0) * PB_TO_USD;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.merchants?.business_name ?? "Pet care"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), "MMM d, yyyy")} · paid{" "}
                          {Formatters.currency(t.amount ?? 0)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-success">
                        +{Formatters.currency(saved)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>

          {/* Hidden mechanics — opens drawer */}
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetTrigger asChild>
              <button className="mt-8 lg:mt-12 w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-3">
                <span className="inline-flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  How does this work?
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>How your savings work</SheetTitle>
                <SheetDescription>
                  We do the math so you don't have to.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm leading-relaxed">
                <p>
                  Every time you pay a pet care place through PawBucks, a small
                  percentage of what you spend comes back to you as savings —
                  automatically.
                </p>
                <p>
                  The next time you pay, your savings get applied for you.
                  Nothing to redeem. Nothing to manage.
                </p>
                <div className="rounded-lg bg-muted p-3">
                  <p className="font-medium mb-1">Two kinds of savings</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>
                      <span className="text-foreground">Earned</span> — from
                      your visits. Good for 60 days.
                    </li>
                    <li>
                      <span className="text-foreground">Bonus</span> — gifts,
                      welcome credits, Pet Fund. Good for 30 days from release.
                    </li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  We always use the savings that expire soonest first.
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </main>

        <BottomNav />
      </div>
    </>
  );
};

export default SimpleSavings;
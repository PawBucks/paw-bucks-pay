import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Store, Loader2, ArrowRight, Check } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Formatters } from "@/utils/formatters";
import { motion, AnimatePresence } from "framer-motion";

const PB_TO_USD = 0.001;

type Merchant = {
  id: string;
  business_name: string;
  logo_url: string | null;
  business_type: string | null;
};

const SimplePay = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, signOut } = useAuth();
  const { spendableBalance, petFundBalance, welcomeCreditBalance } =
    useSpendablePawBucks(user?.id);

  const availableUsd =
    (spendableBalance + petFundBalance + welcomeCreditBalance) * PB_TO_USD;

  const initialMerchantId = params.get("merchantId");
  const [step, setStep] = useState<"merchant" | "amount">(
    initialMerchantId ? "amount" : "merchant",
  );
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [tipPct, setTipPct] = useState<number | "custom" | 0>(0);
  const [customTip, setCustomTip] = useState("");

  // If a merchantId came in via URL, hydrate the merchant
  useEffect(() => {
    if (initialMerchantId && !selected) {
      supabase
        .from("merchants_public")
        .select("id, business_name, logo_url, business_type")
        .eq("id", initialMerchantId)
        .maybeSingle()
        .then(({ data }) => data && setSelected(data as Merchant));
    }
  }, [initialMerchantId, selected]);

  const { data: merchants, isLoading } = useQuery({
    queryKey: ["simple-pay-merchants", search],
    queryFn: async () => {
      const term = search.trim();
      const client: any = supabase;
      let base = client
        .from("merchants_public")
        .select("id, business_name, logo_url, business_type")
        .order("business_name", { ascending: true })
        .limit(20);
      if (term) base = base.ilike("business_name", `%${term}%`);
      const { data } = await base;
      return (data ?? []) as Merchant[];
    },
    staleTime: 60_000,
  });

  const amountNum = parseFloat(amount) || 0;
  // Tip is computed off the bill (pre-savings) and is USD-only — savings never apply to tip.
  const tipAmount =
    tipPct === "custom"
      ? Math.max(0, parseFloat(customTip) || 0)
      : tipPct
        ? +(amountNum * (tipPct / 100)).toFixed(2)
        : 0;
  // Auto-applied savings preview: clamp to available, never above the bill (excludes tip).
  const autoApplied = Math.min(availableUsd, amountNum);
  const dueNow = Math.max(0, amountNum - autoApplied) + tipAmount;

  const handleContinue = () => {
    if (!selected) return;
    if (amountNum < 0.5) {
      toast.error("Minimum payment is $0.50");
      return;
    }
    // Hand off to existing direct-checkout flow (auto-redeem will apply savings server-side).
    // Tip is passed through so it can be added on top, USD-only.
    const qs = new URLSearchParams({ amount: amountNum.toFixed(2) });
    if (tipAmount > 0) qs.set("tip", tipAmount.toFixed(2));
    navigate(`/pay/${selected.id}?${qs.toString()}`);
  };

  return (
    <>
      <SEO title="Pay & save — PawBucks" noIndex />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />

        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-12 pb-28 md:pb-10 max-w-6xl">
          <div className="lg:grid lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-3">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span className={step === "merchant" ? "text-foreground font-medium" : ""}>
              1. Where
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className={step === "amount" ? "text-foreground font-medium" : ""}>
              2. How much
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === "merchant" && (
              <motion.div
                key="merchant"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-semibold tracking-tight mb-1">
                  Who are you paying?
                </h1>
                <p className="text-sm text-muted-foreground mb-5">
                  Pick a place. We'll handle the savings.
                </p>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vets, groomers, pet stores…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-12 rounded-xl"
                  />
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                    {merchants?.length ? (
                      merchants.map((m) => (
                        <li key={m.id}>
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                            onClick={() => {
                              setSelected(m);
                              setStep("amount");
                            }}
                          >
                            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                              {m.logo_url ? (
                                <img src={m.logo_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Store className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{m.business_name}</p>
                              {m.business_type && (
                                <p className="text-xs text-muted-foreground capitalize truncate">
                                  {m.business_type.replace(/_/g, " ")}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No places found. Try another search.
                      </li>
                    )}
                  </ul>
                )}
              </motion.div>
            )}

            {step === "amount" && selected && (
              <motion.div
                key="amount"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Selected merchant */}
                <button
                  onClick={() => setStep("merchant")}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 mb-5 text-left hover:bg-muted/30"
                >
                  <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {selected.logo_url ? (
                      <img src={selected.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Paying</p>
                    <p className="text-sm font-medium truncate">{selected.business_name}</p>
                  </div>
                  <span className="text-xs text-primary">Change</span>
                </button>

                <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight mb-1">
                  How much?
                </h1>
                <p className="text-sm text-muted-foreground mb-5">
                  Your savings get applied automatically.
                </p>

                <div className="space-y-2 mb-5">
                  <Label htmlFor="amt" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="amt"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.50"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                      className="h-20 pl-10 text-3xl font-semibold rounded-xl"
                    />
                  </div>
                </div>

                {/* Auto-save preview */}
                {amountNum >= 0.5 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border bg-card overflow-hidden mb-5"
                  >
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Bill</span>
                      <span className="text-sm font-medium">
                        {Formatters.currency(amountNum)}
                      </span>
                    </div>
                    {autoApplied > 0 && (
                      <div className="px-4 py-3 flex items-center justify-between bg-success/5 border-y border-success/15">
                        <span className="text-sm flex items-center gap-1.5 text-success">
                          <Sparkles className="h-4 w-4" />
                          Savings auto-applied
                        </span>
                        <span className="text-sm font-semibold text-success">
                          −{Formatters.currency(autoApplied)}
                        </span>
                      </div>
                    )}
                    {tipAmount > 0 && (
                      <div className="px-4 py-3 flex items-center justify-between border-t border-border">
                        <span className="text-sm text-muted-foreground">Tip</span>
                        <span className="text-sm font-medium">
                          +{Formatters.currency(tipAmount)}
                        </span>
                      </div>
                    )}
                    <div className="px-4 py-3 flex items-center justify-between bg-primary/5">
                      <span className="text-sm font-medium">You pay</span>
                      <span className="text-lg font-semibold">
                        {Formatters.currency(dueNow)}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Tip selector — USD only, never applied to PawBucks */}
                {amountNum >= 0.5 && (
                  <div className="mb-5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Add a tip (optional)
                    </Label>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                      {([0, 15, 18, 20, "custom"] as const).map((opt) => {
                        const active = tipPct === opt;
                        return (
                          <button
                            key={String(opt)}
                            type="button"
                            onClick={() => setTipPct(opt)}
                            className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card hover:bg-muted/50"
                            }`}
                          >
                            {opt === 0 ? "None" : opt === "custom" ? "Custom" : `${opt}%`}
                          </button>
                        );
                      })}
                    </div>
                    {tipPct === "custom" && (
                      <div className="relative mt-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={customTip}
                          onChange={(e) => setCustomTip(e.target.value)}
                          className="pl-7 h-11 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full h-14 lg:h-16 rounded-xl text-base lg:text-lg"
                  onClick={handleContinue}
                  disabled={amountNum < 0.5}
                >
                  <Check className="h-5 w-5 mr-2" />
                  {amountNum >= 0.5
                    ? `Pay ${Formatters.currency(dueNow)} & save ${Formatters.currency(autoApplied)}`
                    : "Enter an amount"}
                </Button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  And earn even more savings on this payment.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Right rail — desktop reassurance / preview panel */}
          <aside className="hidden lg:block lg:col-span-2 lg:pl-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Your savings</h3>
                </div>
                <p className="text-3xl font-semibold tracking-tight mb-1">
                  {Formatters.currency(availableUsd)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto-applied to this payment, up to the bill total.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-border p-6 space-y-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">How it works</p>
                <ol className="space-y-2 list-decimal list-inside">
                  <li>Pick a place you're paying.</li>
                  <li>Enter the amount on your bill.</li>
                  <li>We apply your savings, you cover the rest.</li>
                </ol>
                <p className="text-xs">
                  Tips are USD only and never come out of your savings.
                </p>
              </div>
            </div>
          </aside>
          </div>
        </main>

        <BottomNav />
      </div>
    </>
  );
};

export default SimplePay;
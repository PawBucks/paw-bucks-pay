import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Star,
  Shield,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { WorkspacePageHeader } from "./MerchantWorkspaceLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { toast } from "@/hooks/use-toast";

type RecentTx = {
  id: string;
  short_id: string;
  initials: string;
  name: string;
  date: string;
  method: "USD" | "PawBucks" | "Mixed";
  amount: string;
  rewards: string;
  isRefunded: boolean;
};

type CompletedTxRow = {
  amount: number;
  stripe_amount: number | null;
  application_fee: number | null;
  rewards_earned: number | null;
  cashback_earned: number | null;
  pawbucks_used: number | null;
  created_at: string;
  status: string | null;
};

type DirectPaymentRow = {
  amount: number | null;
  application_fee: number | null;
  status: string | null;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "GU";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  badge?: { label: string; tone?: "success" | "muted" };
  accent?: "default" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

function StatCard({ label, value, sub, badge, accent = "default", onClick }: StatCardProps) {
  const tone = {
    default: "text-foreground",
    success: "text-[hsl(var(--success))]",
    warning: "text-[hsl(var(--warning))]",
    destructive: "text-destructive",
  }[accent];
  return (
    <Card
      className={`shadow-none ${onClick ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/40" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {badge && (
          <Badge
            variant="secondary"
            className={`mt-2 text-[10px] ${
              badge.tone === "success"
                ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.12)]"
                : ""
            }`}
          >
            {badge.label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkspaceOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [feeModel, setFeeModel] = useState<"full_ecosystem" | "acquisition_only">("full_ecosystem");
  const [acceptPB, setAcceptPB] = useState(false);
  const [capEnabled, setCapEnabled] = useState(false);
  const [capPct, setCapPct] = useState("50");
  const [savingSetting, setSavingSetting] = useState(false);
  const [salesTx, setSalesTx] = useState<{ amount: number; created_at: string }[]>([]);
  const [allTxRows, setAllTxRows] = useState<CompletedTxRow[]>([]);
  const [directPaymentRows, setDirectPaymentRows] = useState<DirectPaymentRow[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [funding, setFunding] = useState<{ status: string | null; remaining: number; rate: number | null }>({ status: null, remaining: 0, rate: null });
  const [latestInvite, setLatestInvite] = useState<{ id: string; name: string; status: string; date: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setChartsLoading(true);
      try {
        const { data: merchant } = await supabase
          .from("merchants")
          .select("id, accepts_pawbucks, pawbucks_cap_enabled, pawbucks_cap_pct, fee_model")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!merchant?.id || cancelled) return;
        setMerchantId(merchant.id);
        setAcceptPB(!!(merchant as any).accepts_pawbucks);
        setCapEnabled(!!(merchant as any).pawbucks_cap_enabled);
        if ((merchant as any).pawbucks_cap_pct != null) setCapPct(String((merchant as any).pawbucks_cap_pct));
        if ((merchant as any).fee_model === "acquisition_only") setFeeModel("acquisition_only");

        const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString();

        const [{ data: recentTxs }, { data: allTxs }, { data: directPayments }, deals, invites] = await Promise.all([
          supabase
            .from("transactions")
            .select("amount, created_at")
            .eq("merchant_id", merchant.id)
            .eq("status", "completed")
            .gte("created_at", sixMonthsAgo),
          supabase
            .from("transactions")
            .select("amount, stripe_amount, application_fee, rewards_earned, cashback_earned, pawbucks_used, created_at, status")
            .eq("merchant_id", merchant.id)
            .eq("status", "completed"),
          supabase
            .from("direct_payments")
            .select("amount, application_fee, status")
            .eq("merchant_id", merchant.id)
            .eq("status", "succeeded"),
          supabase
            .from("funding_deals")
            .select("status, remaining_balance, repayment_rate")
            .eq("merchant_id", merchant.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("brand_campaign_invitations")
            .select("id, status, invited_at, responded_at, brand_campaigns(name)")
            .eq("merchant_id", merchant.id)
            .order("invited_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        setSalesTx(recentTxs || []);
        setAllTxRows((allTxs || []) as any);
        setDirectPaymentRows((directPayments || []) as any);

        const dealRow: any = (deals as any)?.data ?? null;
        if (dealRow) {
          setFunding({
            status: dealRow.status ?? null,
            remaining: Number(dealRow.remaining_balance) || 0,
            rate: dealRow.repayment_rate != null ? Number(dealRow.repayment_rate) : null,
          });
        }

        const inviteRow: any = (invites as any)?.data ?? null;
        if (inviteRow) {
          setLatestInvite({
            id: inviteRow.id,
            name: inviteRow.brand_campaigns?.name || "Brand Campaign",
            status: inviteRow.status || "pending",
            date: format(parseISO(inviteRow.responded_at || inviteRow.invited_at), "M/d/yyyy"),
          });
        }

        // Recent transactions (live)
        setRecentLoading(true);
        const { data: latest } = await supabase
          .from("transactions")
          .select(
            "id, amount, rewards_earned, cashback_earned, pawbucks_used, created_at, status, profiles!transactions_user_id_fkey(full_name)"
          )
          .eq("merchant_id", merchant.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (cancelled) return;
        const mapped: RecentTx[] = (latest || []).map((t: any) => {
          const name = t.profiles?.full_name || "Guest";
          const usd = Number(t.amount) || 0;
          const pb = Number(t.pawbucks_used) || 0;
          const rewardsPB =
            Number(t.rewards_earned ?? t.cashback_earned) || 0;
          const method: RecentTx["method"] =
            pb > 0 && usd > 0 ? "Mixed" : pb > 0 ? "PawBucks" : "USD";
          const isRefunded = t.status === "refunded";
          return {
            id: t.id,
            short_id: String(t.id).slice(0, 8).toUpperCase(),
            initials: getInitials(name),
            name,
            date: format(parseISO(t.created_at), "MMM d"),
            method,
            amount: `${isRefunded ? "-" : "+"}$${usd.toFixed(2)}`,
            rewards: `$${(rewardsPB * 0.001).toFixed(2)}`,
            isRefunded,
          };
        });
        setRecentTx(mapped);
        setRecentLoading(false);
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const salesData = useMemo(() => {
    const buckets: Record<string, number> = {};
    // Seed last 6 months with zeros so empty months still appear
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(startOfMonth(new Date()), i), "MMM yy");
      buckets[key] = 0;
    }
    salesTx.forEach((t) => {
      const key = format(startOfMonth(parseISO(t.created_at)), "MMM yy");
      if (key in buckets) buckets[key] += Number(t.amount) || 0;
    });
    return Object.entries(buckets).map(([month, value]) => ({ month, value }));
  }, [salesTx]);

  const stats = useMemo(() => {
    let totalSalesUsd = 0;
    let totalPbReceived = 0; // PawBucks units used by customers
    let totalRewardsGivenPb = 0; // PawBucks units rewarded to customers
    let txCount = 0;
    let monthPbReceived = 0;
    let storedFees = 0; // Sum of stored application_fee (Stripe-authoritative)
    const monthStart = startOfMonth(new Date()).getTime();
    allTxRows.forEach((t) => {
      const usd = Number(t.amount) || 0;
      const pbUsed = Number(t.pawbucks_used) || 0;
      const rewards = Number(t.rewards_earned ?? t.cashback_earned) || 0;
      const fee = Number(t.application_fee) || 0;
      totalSalesUsd += usd;
      totalPbReceived += pbUsed;
      totalRewardsGivenPb += rewards;
      storedFees += fee;
      txCount += 1;
      const ts = parseISO(t.created_at).getTime();
      if (ts >= monthStart) monthPbReceived += pbUsed;
    });
    const avg = txCount > 0 ? totalSalesUsd / txCount : 0;
    // Read fees from the actually-stored application_fee (Stripe charge time),
    // never re-derive 3% locally — manual/invoice payments have no Stripe fee.
    const successFees = feeModel === "full_ecosystem" ? storedFees : 0;
    return {
      totalSalesUsd,
      avg,
      txCount,
      rewardsGivenUsd: totalRewardsGivenPb / 1000,
      rewardsGivenPb: totalRewardsGivenPb,
      pbReceivedUsd: totalPbReceived / 1000,
      monthPbReceivedUsd: monthPbReceived / 1000,
      successFees,
    };
  }, [allTxRows, feeModel]);

  const rewardsData = useMemo(
    () => [
      { name: "PawBucks Received", value: stats.pbReceivedUsd },
      { name: "Rewards Given", value: stats.rewardsGivenUsd },
    ],
    [stats],
  );
  const rewardsTotal = stats.pbReceivedUsd + stats.rewardsGivenUsd;

  const fmtUsd = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const updateMerchantSetting = async (patch: Record<string, unknown>) => {
    if (!merchantId) return;
    setSavingSetting(true);
    const { error } = await supabase.from("merchants").update(patch).eq("id", merchantId);
    setSavingSetting(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleAcceptPB = async (checked: boolean) => {
    const prev = acceptPB;
    setAcceptPB(checked);
    const ok = await updateMerchantSetting({ accepts_pawbucks: checked });
    if (!ok) setAcceptPB(prev);
  };

  const handleCapToggle = async (checked: boolean) => {
    const prev = capEnabled;
    setCapEnabled(checked);
    const ok = await updateMerchantSetting({ pawbucks_cap_enabled: checked });
    if (!ok) setCapEnabled(prev);
  };

  const handleCapBlur = async () => {
    const n = Number(capPct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast({ title: "Enter a value between 0 and 100", variant: "destructive" });
      return;
    }
    await updateMerchantSetting({ pawbucks_cap_pct: n });
  };

  return (
    <div className="flex flex-col">
      <WorkspacePageHeader
        section="Dashboard"
        title="Overview"
        subtitle="Track your PawBucks sales, rewards, and account settings."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/merchant/sales-report")}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export Report
            </Button>
            <Button size="sm" onClick={() => navigate("/merchant/market")}>
              <Star className="h-4 w-4 mr-1.5" />
              Services Marketplace
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 space-y-4 max-w-7xl w-full mx-auto">
        {/* Funding banner */}
        {funding.status === "active" ? (
          <Card className="border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] shadow-none">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <Sparkles className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-sm">Active Funding Deal</p>
                <p className="text-xs text-muted-foreground">
                  Remaining balance {fmtUsd(funding.remaining)}
                  {funding.rate != null ? ` · ${funding.rate}% repayment rate` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/merchant/support")}>
                Manage
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] shadow-none">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Sparkles className="h-5 w-5 text-[hsl(var(--warning))] shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold text-sm">Merchant Funding — Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                PawBucks will offer working capital loans to qualified merchants. No equity, no
                lengthy applications.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.15)] text-[hsl(38_92%_30%)] hover:bg-[hsl(var(--warning)/0.25)]"
              onClick={() => navigate("/merchant/support")}
            >
              Join Waitlist
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Account type */}
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">Account Type</p>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 text-[10px]">
                  {feeModel === "acquisition_only" ? "Acquisition Only" : "Full Ecosystem"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feeModel === "acquisition_only"
                  ? "You pay only an acquisition fee on new customers — no per-transaction Success Fee."
                  : "You pay a 3% Success Fee on every USD transaction and participate in the full PawBucks rewards ecosystem."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/merchant/support")}
            >
              {feeModel === "acquisition_only" ? "Switch to Full Ecosystem" : "Request Acquisition-Only"}
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="shadow-none">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Accept PawBucks</Label>
                  {acceptPB && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--success))]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allow customers to pay with their PawBucks balance (1,000 PawBucks = $1.00).
                </p>
              </div>
              <Switch checked={acceptPB} onCheckedChange={handleAcceptPB} disabled={savingSetting || !merchantId} />
            </div>
            <div className="border-t pt-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-semibold">PawBucks Acceptance Cap</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Limit the % of each transaction payable with PawBucks. Off = no limit.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={capPct}
                  onChange={(e) => setCapPct(e.target.value)}
                  onBlur={handleCapBlur}
                  className="w-16 h-8 text-sm"
                  disabled={!capEnabled || savingSetting}
                />
                <span className="text-xs text-muted-foreground">% max</span>
                <Switch checked={capEnabled} onCheckedChange={handleCapToggle} disabled={savingSetting || !merchantId} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Sales"
            value={fmtUsd(stats.totalSalesUsd)}
            sub="All-time completed"
            badge={{ label: `${stats.txCount} transactions`, tone: "success" }}
            onClick={() => navigate("/merchant/total-earnings")}
          />
          <StatCard
            label="Avg Transaction"
            value={fmtUsd(stats.avg)}
            sub="Per transaction"
            onClick={() => navigate("/merchant/transactions")}
          />
          <StatCard
            label="Rewards Given"
            value={fmtUsd(stats.rewardsGivenUsd)}
            sub={`${Math.round(stats.rewardsGivenPb).toLocaleString()} PawBucks`}
            accent="success"
            onClick={() => navigate("/merchant-analytics")}
          />
          <StatCard
            label="PawBucks Received"
            value={fmtUsd(stats.pbReceivedUsd)}
            sub={`${fmtUsd(stats.monthPbReceivedUsd)} this month`}
            onClick={() => navigate("/merchant/pawbucks")}
          />
          <StatCard
            label="Success Fees Paid"
            value={fmtUsd(stats.successFees)}
            sub={feeModel === "acquisition_only" ? "Acquisition-only plan" : "3% of USD transactions"}
            accent="warning"
            onClick={() => navigate("/merchant/tax-vault")}
          />
          <StatCard
            label="Merchant Funding"
            value={funding.status === "active" ? "Active" : "No Loan"}
            sub={funding.status === "active" ? `Remaining: ${fmtUsd(funding.remaining)}` : "Repayment: $0.00"}
            onClick={() => navigate("/merchant/support")}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Sales Overview</CardTitle>
              <p className="text-xs text-muted-foreground">USD revenue — last 6 months</p>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rewards Distribution</CardTitle>
              <p className="text-xs text-muted-foreground">All-time PawBucks activity</p>
            </CardHeader>
            <CardContent className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rewardsData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--accent))" />
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold">
                  ${rewardsTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Received
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Given
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recent Transactions</CardTitle>
                <p className="text-xs text-muted-foreground">Latest client payments</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => navigate("/merchant/transactions")}
              >
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading transactions…
                </div>
              ) : recentTx.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No transactions yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {recentTx.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 p-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                        {tx.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.name}
                          {tx.isRefunded && (
                            <span className="ml-2 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                              Refunded
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {tx.short_id} · {tx.date} · {tx.method}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            tx.isRefunded
                              ? "text-destructive line-through"
                              : "text-[hsl(var(--success))]"
                          }`}
                        >
                          {tx.amount}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Rewards: {tx.rewards}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Brand Campaigns</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Brands fund 100% of the rewards pool
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => navigate("/merchant/brand-campaigns")}
              >
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Your Invitations
              </p>
              {latestInvite ? (
                <div
                  className="rounded-md border p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate("/merchant/brand-campaigns")}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{latestInvite.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Brand-funded · {latestInvite.status} {latestInvite.date}
                    </p>
                  </div>
                  <Badge
                    className={
                      latestInvite.status === "accepted"
                        ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.12)] capitalize"
                        : "capitalize"
                    }
                  >
                    {latestInvite.status}
                  </Badge>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
                  No campaign invitations yet.
                </div>
              )}
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
                <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">How it works:</strong> Brands invite your
                  business to funded campaigns. They cover 100% of the rewards pool — you get
                  incremental revenue at zero cost.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PawBucks footer chip */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
          <PawBucksLogo className="h-3.5 w-3.5 text-primary" />
          Powered by PawBucks Merchant Workspace
        </div>
      </div>
    </div>
  );
}
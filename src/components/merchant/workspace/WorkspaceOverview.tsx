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

const recentTx = [
  { initials: "MG", name: "Markus Gerdemann", id: "IHD01082", date: "May 8", method: "USD", amount: "+$300.00", rewards: "$3.00" },
  { initials: "MC", name: "Matthew Colon", id: "IHD01080", date: "Apr 27", method: "USD", amount: "+$640.00", rewards: "$6.40" },
  { initials: "BK", name: "Brooke Kain", id: "IHD01079", date: "Apr 25", method: "USD", amount: "+$640.00", rewards: "$6.40" },
  { initials: "JL", name: "Jamie Lin", id: "IHD01077", date: "Apr 22", method: "PawBucks", amount: "+$120.00", rewards: "$0.00" },
];

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  badge?: { label: string; tone?: "success" | "muted" };
  accent?: "default" | "success" | "warning" | "destructive";
}

function StatCard({ label, value, sub, badge, accent = "default" }: StatCardProps) {
  const tone = {
    default: "text-foreground",
    success: "text-[hsl(var(--success))]",
    warning: "text-[hsl(var(--warning))]",
    destructive: "text-destructive",
  }[accent];
  return (
    <Card className="shadow-none">
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
  const [acceptPB, setAcceptPB] = useState(true);
  const [capEnabled, setCapEnabled] = useState(false);
  const [capPct, setCapPct] = useState("50");
  const [salesTx, setSalesTx] = useState<{ amount: number; created_at: string }[]>([]);
  const [rewardsTotals, setRewardsTotals] = useState({ given: 0, received: 0 });
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setChartsLoading(true);
      try {
        const { data: merchant } = await supabase
          .from("merchants")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!merchant?.id || cancelled) return;

        const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString();

        const [{ data: recentTxs }, { data: allTxs }] = await Promise.all([
          supabase
            .from("transactions")
            .select("amount, created_at")
            .eq("merchant_id", merchant.id)
            .eq("status", "completed")
            .gte("created_at", sixMonthsAgo),
          supabase
            .from("transactions")
            .select("rewards_earned, pawbucks_used")
            .eq("merchant_id", merchant.id)
            .eq("status", "completed"),
        ]);

        if (cancelled) return;
        setSalesTx(recentTxs || []);
        const given = (allTxs || []).reduce(
          (s, t: any) => s + (Number(t.rewards_earned) || 0) * 0.001,
          0,
        );
        const received = (allTxs || []).reduce(
          (s, t: any) => s + (Number(t.pawbucks_used) || 0) * 0.001,
          0,
        );
        setRewardsTotals({ given, received });
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

  const rewardsData = useMemo(
    () => [
      { name: "PawBucks Received", value: rewardsTotals.received },
      { name: "Rewards Given", value: rewardsTotals.given },
    ],
    [rewardsTotals],
  );
  const rewardsTotal = rewardsTotals.given + rewardsTotals.received;

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
              onClick={() => navigate("/merchant/quick-actions")}
            >
              Join Waitlist
            </Button>
          </CardContent>
        </Card>

        {/* Account type */}
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">Account Type</p>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 text-[10px]">
                  Full Ecosystem
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                You pay a 3% Success Fee on every USD transaction and participate in the full
                PawBucks rewards ecosystem.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/merchant/support")}
            >
              Request Acquisition-Only
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
              <Switch checked={acceptPB} onCheckedChange={setAcceptPB} />
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
                  className="w-16 h-8 text-sm"
                  disabled={!capEnabled}
                />
                <span className="text-xs text-muted-foreground">% max</span>
                <Switch checked={capEnabled} onCheckedChange={setCapEnabled} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Sales"
            value="$25,439"
            sub=".03 all-time"
            badge={{ label: "93 transactions", tone: "success" }}
          />
          <StatCard label="Avg Transaction" value="$273" sub=".54 per transaction" />
          <StatCard label="Rewards Given" value="$190.61" sub="190,610 PawBucks" accent="success" />
          <StatCard label="PawBucks Received" value="$1,551.89" sub="Spent in March" />
          <StatCard label="Success Fees Paid" value="$465.36" sub="3% of USD transactions" accent="warning" />
          <StatCard label="Merchant Funding" value="No Loan" sub="Repayment: $0.00" />
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
              <ul className="divide-y">
                {recentTx.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                      {tx.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {tx.id} · {tx.date} · {tx.method}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[hsl(var(--success))]">{tx.amount}</p>
                      <p className="text-[11px] text-muted-foreground">Rewards: {tx.rewards}</p>
                    </div>
                  </li>
                ))}
              </ul>
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
                onClick={() => navigate("/merchant/campaigns")}
              >
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Your Invitations
              </p>
              <div className="rounded-md border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Test Campaign 2</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Brand-funded · accepted 4/23/2026
                  </p>
                </div>
                <Badge className="bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.12)]">
                  Accepted
                </Badge>
              </div>
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
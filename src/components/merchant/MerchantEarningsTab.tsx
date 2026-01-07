import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  ExternalLink, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface BalanceAmount {
  amount: number;
  currency: string;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: number;
  created: number;
}

interface EarningsData {
  connected: boolean;
  balance: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
  };
  recentPayouts: Payout[];
  summary: {
    totalEarnings: number;
    totalFees: number;
    transactionCount: number;
  };
  dashboardUrl: string | null;
}

export function MerchantEarningsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<EarningsData | null>(null);

  const fetchEarnings = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      
      const { data: earnings, error } = await supabase.functions.invoke("get-merchant-earnings");
      
      if (error) throw error;
      
      setData(earnings);
      if (showToast) toast.success("Earnings data refreshed");
    } catch (error) {
      console.error("Error fetching earnings:", error);
      if (showToast) toast.error("Failed to refresh earnings data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const formatCurrency = (amount: number, currency = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getAvailableBalance = () => {
    if (!data?.balance?.available) return 0;
    return data.balance.available.reduce((sum, b) => sum + b.amount, 0);
  };

  const getPendingBalance = () => {
    if (!data?.balance?.pending) return 0;
    return data.balance.pending.reduce((sum, b) => sum + b.amount, 0);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Connect your Stripe account to view earnings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh and dashboard link */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Earnings & Payouts</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchEarnings(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {data.dashboardUrl && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => window.open(data.dashboardUrl!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Stripe Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(getAvailableBalance())}
            </div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(getPendingBalance())}
            </div>
            <p className="text-xs text-muted-foreground">Processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.summary.totalEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.summary.transactionCount} transactions • ${data.summary.totalFees.toFixed(2)} in fees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
          <CardDescription>Your recent payouts to your bank account</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentPayouts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payouts yet. Payouts will appear here once processed.
            </p>
          ) : (
            <div className="space-y-4">
              {data.recentPayouts.map((payout) => (
                <div 
                  key={payout.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {payout.status === "paid" ? (
                      <ArrowUpRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payout.amount, payout.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payout.created * 1000), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={payout.status === "paid" ? "default" : "secondary"}
                    className={payout.status === "paid" ? "bg-green-100 text-green-700" : ""}
                  >
                    {payout.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

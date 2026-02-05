import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Clock, ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, ChevronRight } from "lucide-react";
import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
import { format } from "date-fns";

export function MerchantEarningsTab() {
  const navigate = useNavigate();
  const { loading, refreshing, data, fetchEarnings, formatCurrency, getAvailableBalance, getPendingBalance } = useMerchantEarnings();

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
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => navigate("/merchant/available-balance")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
              {formatCurrency(getAvailableBalance())}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => navigate("/merchant/pending-balance")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-600">
              {formatCurrency(getPendingBalance())}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Processing</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => navigate("/merchant/total-earnings")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                ${data.summary?.totalEarnings?.toFixed(2) || "0.00"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.summary?.transactionCount || 0} transactions • ${data.summary?.totalFees?.toFixed(2) || "0.00"} in fees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Complete history of all payouts to your bank account</CardDescription>
        </CardHeader>
        <CardContent>
          {!data.payoutHistory || data.payoutHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No payouts yet. Payouts will appear here once processed.
            </p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {data.payoutHistory.map((payout) => (
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

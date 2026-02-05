import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, RefreshCw, Wallet, CreditCard, Receipt } from "lucide-react";
import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
import { format } from "date-fns";

export default function MerchantPendingBalance() {
  const navigate = useNavigate();
  const { loading, refreshing, data, fetchEarnings, formatCurrency } = useMerchantEarnings();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/merchant")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">Connect your Stripe account to view balance details</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pendingBalances = data.balance?.pending || [];
  const totalPending = pendingBalances.reduce((sum, b) => sum + b.amount, 0);
  const pendingPayouts = data.payoutHistory.filter(p => ["pending", "in_transit"].includes(p.status));
  const recentCharges = data.recentCharges || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/merchant")} size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Pending Balance</h1>
              <p className="text-muted-foreground">Funds being processed and cleared</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEarnings(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Main Balance Card */}
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-3xl text-yellow-700 dark:text-yellow-400">
                  {formatCurrency(totalPending)}
                </CardTitle>
                <CardDescription>Total pending clearance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pendingBalances.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">Balance by Currency</p>
                {pendingBalances.map((balance, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{balance.currency.toUpperCase()}</Badge>
                      <span className="text-sm text-muted-foreground">Pending</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(balance.amount, balance.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No pending balance</p>
            )}
          </CardContent>
        </Card>

        {/* In-Transit Payouts */}
        {pendingPayouts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                In-Transit Payouts
              </CardTitle>
              <CardDescription>Payouts currently being transferred to your bank</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingPayouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{formatCurrency(payout.amount, payout.currency)}</p>
                      <p className="text-sm text-muted-foreground">
                        Expected {format(new Date(payout.arrivalDate * 1000), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      {payout.status === "in_transit" ? "In Transit" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Charges with Payment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Recent Payments
            </CardTitle>
            <CardDescription>Latest payments with detailed fee breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCharges.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recent payments</p>
            ) : (
              <div className="space-y-4">
                {recentCharges.map((charge) => {
                  const totalFees = (charge.stripeFee || 0) + (charge.applicationFee || 0);
                  
                  return (
                    <Card key={charge.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        {/* Header with date and status */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(charge.created * 1000), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          <Badge variant={charge.status === "succeeded" ? "default" : "secondary"}>
                            {charge.status}
                          </Badge>
                        </div>

                        {/* Description */}
                        {charge.description && (
                          <p className="text-sm text-muted-foreground mb-4">{charge.description}</p>
                        )}

                        {/* Payment Breakdown */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Payment amount</span>
                            <span className="font-semibold">
                              {formatCurrency(charge.amount, charge.currency)} {charge.currency.toUpperCase()}
                            </span>
                          </div>

                          <Separator />

                          {/* Fees Section */}
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-muted-foreground">Fees</span>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground pl-2">Stripe processing fees</span>
                              <span className="text-destructive">
                                - {formatCurrency(charge.stripeFee || 0, charge.currency)} {charge.currency.toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground pl-2">PawBucks, Inc. application fee</span>
                              <span className="text-destructive">
                                - {formatCurrency(charge.applicationFee || 0, charge.currency)} {charge.currency.toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-sm pt-1 border-t border-dashed">
                              <span className="text-muted-foreground pl-2 font-medium">Total fees</span>
                              <span className="text-destructive font-medium">
                                - {formatCurrency(totalFees, charge.currency)} {charge.currency.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <Separator />

                          {/* Net Amount */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-semibold text-lg">Net amount</span>
                            <span className="font-bold text-lg text-primary">
                              {formatCurrency(charge.netAmount || (charge.amount - totalFees), charge.currency)} {charge.currency.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Pending balance represents funds from recent transactions that are still being processed. 
              These typically take 2-7 business days to clear and become available for payout, depending on your account settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
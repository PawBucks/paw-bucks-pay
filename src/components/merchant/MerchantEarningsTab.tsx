import { useNavigate } from"react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { RefreshCw, ArrowUpRight, ArrowDownRight, ChevronRight, AlertTriangle } from "lucide-react";
import { useMerchantEarnings } from"@/hooks/useMerchantEarnings";
import { format } from"date-fns";

import { Formatters } from "@/utils/formatters";
export function MerchantEarningsTab() {
 const navigate = useNavigate();
 const { loading, refreshing, data, fetchEarnings, formatCurrency, getAvailableBalance, getPendingBalance, formatPayoutSchedule } = useMerchantEarnings();

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
 <span className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true">👛</span>
 <p className="text-muted-foreground">
 Connect your Stripe account to view earnings
 </p>
 </CardContent>
 </Card>
 );
 }

 const pendingBalance = getPendingBalance();

 return (
 <div className="space-y-6">
 {/* Header with refresh */}
 <div className="flex items-center justify-between">
 <h2 className="text-2xl font-bold">Earnings & Payouts</h2>
 <Button 
 variant="outline" 
 size="sm" 
 onClick={() => fetchEarnings(true)}
 disabled={refreshing}
 >
 <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ?"animate-spin" :""}`} />
 Refresh
 </Button>
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
 <span className="h-5 w-5 text-success" aria-hidden="true">💵</span>
 <span className="text-2xl font-bold text-success">
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
 <span className="h-5 w-5 text-warning" aria-hidden="true">⏰</span>
 <span className="text-2xl font-bold text-warning">
 {formatCurrency(pendingBalance)}
 </span>
 </div>
 {data.estimatedNextArrival && pendingBalance > 0 ? (
 <p className="text-xs text-muted-foreground">
 Est. arrival {format(new Date(data.estimatedNextArrival * 1000),"MMM d, yyyy")}
 </p>
 ) : (
 <p className="text-xs text-muted-foreground">Processing</p>
 )}
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
 <span className="h-5 w-5 text-primary" aria-hidden="true">📈</span>
 <span className="text-2xl font-bold">
                {Formatters.currency(data.summary?.totalEarnings || 0)}
 </span>
 </div>
 <p className="text-xs text-muted-foreground">
              {Formatters.number(data.summary?.transactionCount || 0)} transactions • {Formatters.currency(data.summary?.totalFees || 0)} in fees
 </p>
 </CardContent>
 </Card>
 </div>

 {/* Secondary Stats Row */}
 <div className="grid gap-4 md:grid-cols-4">
 {/* Payout Schedule */}
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center gap-2 mb-2">
 <span className="h-4 w-4 text-muted-foreground" aria-hidden="true">📅</span>
 <span className="text-sm font-medium">Payout Schedule</span>
 </div>
 <p className="text-sm text-muted-foreground">{formatPayoutSchedule()}</p>
 </CardContent>
 </Card>

 {/* Rewards Given */}
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center gap-2 mb-2">
 <span className="h-4 w-4 text-muted-foreground" aria-hidden="true">🧾</span>
 <span className="text-sm font-medium">Rewards Given</span>
 </div>
 <p className="text-lg font-bold">{data.summary?.totalRewardsGiven || 0} <span className="text-sm font-normal text-muted-foreground">PB</span></p>
 </CardContent>
 </Card>

 {/* Refunds */}
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center gap-2 mb-2">
 <span className="h-4 w-4 text-muted-foreground" aria-hidden="true">🛡️</span>
 <span className="text-sm font-medium">Refunds</span>
 </div>
 <p className="text-lg font-bold">
 {data.summary?.refunds?.count || 0}
 {(data.summary?.refunds?.amount || 0) > 0 && (
 <span className="text-sm font-normal text-destructive ml-2">
 -{Formatters.currency(data.summary.refunds.amount)}
 </span>
 )}
 </p>
 </CardContent>
 </Card>

 {/* Disputes */}
 <Card className={data.disputes?.open > 0 ?"border-destructive" :""}>
 <CardContent className="pt-6">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle className={`h-4 w-4 ${data.disputes?.open > 0 ?"text-destructive" :"text-muted-foreground"}`} />
 <span className="text-sm font-medium">Disputes</span>
 </div>
 {data.disputes?.open > 0 ? (
 <p className="text-lg font-bold text-destructive">
 {data.disputes.open} open
 <span className="text-sm font-normal text-muted-foreground ml-1">
 ({formatCurrency(data.disputes.totalAmount)})
 </span>
 </p>
 ) : (
 <p className="text-lg font-bold text-success">None</p>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Open Disputes Alert */}
 {data.disputes?.open > 0 && (
 <Card className="border-destructive/30 bg-destructive/5">
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-destructive text-base">
 <AlertTriangle className="h-5 w-5" />
 {data.disputes.open} Open Dispute{data.disputes.open > 1 ?"s" :""} — Action Required
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {data.disputes.disputes
 .filter(d => ["warning_needs_response","needs_response","warning_under_review","under_review"].includes(d.status))
 .map((dispute) => (
 <div key={dispute.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
 <div>
 <p className="font-medium">{formatCurrency(dispute.amount, dispute.currency)}</p>
 <p className="text-sm text-muted-foreground capitalize">{dispute.reason.replace(/_/g," ")}</p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(dispute.created * 1000),"MMM d, yyyy")}
 </p>
 </div>
 <Badge variant="destructive" className="capitalize">
 {dispute.status.replace(/_/g," ")}
 </Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

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
 {payout.status ==="paid" ? (
 <ArrowUpRight className="h-5 w-5 text-success" />
 ) : (
 <ArrowDownRight className="h-5 w-5 text-warning" />
 )}
 <div>
 <p className="font-medium">
 {formatCurrency(payout.amount, payout.currency)}
 </p>
 <p className="text-sm text-muted-foreground">
 {payout.status ==="paid" 
 ? `Arrived ${format(new Date(payout.arrivalDate * 1000),"MMM d, yyyy")}`
 : `Expected ${format(new Date(payout.arrivalDate * 1000),"MMM d, yyyy")}`
 }
 </p>
 {payout.description && (
 <p className="text-xs text-muted-foreground">{payout.description}</p>
 )}
 </div>
 </div>
 <div className="flex flex-col items-end gap-1">
 <Badge 
 variant={payout.status ==="paid" ?"default" :"secondary"}
 className={payout.status ==="paid" ?"bg-success/15 text-success" :""}
 >
 {payout.status ==="in_transit" ?"In Transit" : payout.status}
 </Badge>
 {payout.method && (
 <span className="text-xs text-muted-foreground capitalize">{payout.method}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

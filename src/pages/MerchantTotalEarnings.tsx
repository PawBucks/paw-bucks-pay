import { Formatters } from "@/utils/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ExternalLink, Gift, Receipt, RefreshCw, RotateCcw, TrendingUp, Users, Wallet } from "lucide-react";
import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
 
 export default function MerchantTotalEarnings() {
 const { loading, refreshing, data, fetchEarnings } = useMerchantEarnings();
 
 if (loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Dashboard" title="Total Earnings" subtitle="Complete breakdown of your revenue" />
   <div className="p-4 md:p-6 space-y-6">
     <Skeleton className="h-[200px] w-full" />
     <Skeleton className="h-[300px] w-full" />
   </div>
 </MerchantWorkspaceLayout>
 );
 }
 
 if (!data?.connected) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Dashboard" title="Total Earnings" subtitle="Complete breakdown of your revenue" />
   <div className="p-4 md:p-6">
     <Card>
       <CardContent className="py-12 text-center">
         <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
         <p className="text-lg text-muted-foreground">Connect your Stripe account to view earnings details</p>
       </CardContent>
     </Card>
   </div>
 </MerchantWorkspaceLayout>
 );
 }
 
 const summary = data.summary;
 const breakdown = summary?.breakdown;
 
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader
     section="Dashboard"
     title="Total Earnings"
     subtitle="Complete breakdown of your revenue"
     actions={
       <>
         <Button variant="outline" size="sm" onClick={() => fetchEarnings(true)} disabled={refreshing}>
           <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
           Refresh
         </Button>
         {data.dashboardUrl && (
           <Button size="sm" onClick={() => window.open(data.dashboardUrl!, "_blank")}>
             <ExternalLink className="h-4 w-4 mr-2" />
             Stripe Dashboard
           </Button>
         )}
       </>
     }
   />
   <div className="p-4 md:p-6 space-y-6">
 
 {/* Main Earnings Card */}
 <Card className="border-primary/20 bg-primary/5">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-full bg-primary/10">
 <TrendingUp className="h-6 w-6 text-primary" aria-hidden="true" />
 </div>
 <div>
 <CardTitle className="text-3xl text-primary">
 {Formatters.currency(summary.totalEarnings)}
 </CardTitle>
 <CardDescription>Net earnings after success fees</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid gap-4 md:grid-cols-3">
 <div className="p-4 rounded-lg bg-background border">
 <div className="flex items-center gap-2 mb-2">
 <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm text-muted-foreground">Transactions</span>
 </div>
 <p className="text-2xl font-bold">{summary.transactionCount}</p>
 </div>
 <div className="p-4 rounded-lg bg-background border">
 <div className="flex items-center gap-2 mb-2">
 <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm text-muted-foreground">Success Fees</span>
 </div>
 <p className="text-2xl font-bold">{Formatters.currency(summary.totalFees)}</p>
 </div>
 <div className="p-4 rounded-lg bg-background border">
 <div className="flex items-center gap-2 mb-2">
 <Gift className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm text-muted-foreground">Rewards Given</span>
 </div>
 <p className="text-2xl font-bold">{summary.totalRewardsGiven} PB</p>
 </div>
 </div>
 </CardContent>
 </Card>
 
 {/* Refunds Card */}
 {summary.refunds && summary.refunds.count > 0 && (
 <Card className="border-destructive/30 bg-destructive/5">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-destructive">
 <RotateCcw className="h-5 w-5" />
 Refunds
 </CardTitle>
 <CardDescription>Transactions that have been refunded</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid gap-4 md:grid-cols-2">
 <div className="p-4 rounded-lg bg-background border">
 <p className="text-sm text-muted-foreground mb-1">Refund Count</p>
 <p className="text-2xl font-bold text-destructive">{summary.refunds.count}</p>
 </div>
 <div className="p-4 rounded-lg bg-background border">
 <p className="text-sm text-muted-foreground mb-1">Total Refunded</p>
 <p className="text-2xl font-bold text-destructive">{Formatters.currency(summary.refunds.amount)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 )}
 
 {/* Detailed Breakdown */}
 {breakdown && (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Users className="h-5 w-5 text-primary" aria-hidden="true" />
 Revenue Breakdown
 </CardTitle>
 <CardDescription>Detailed view of earnings by source</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-6">
 {/* Direct Payments Section */}
 <div>
 <h4 className="font-semibold mb-3 flex items-center gap-2">
 <Badge>Direct Payments</Badge>
 <span className="text-muted-foreground text-sm font-normal">via Stripe Connect</span>
 </h4>
 <div className="grid gap-3 md:grid-cols-3">
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Earnings</p>
 <p className="text-lg font-semibold">{Formatters.currency(breakdown.directPaymentEarnings)}</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Fees</p>
 <p className="text-lg font-semibold">{Formatters.currency(breakdown.directPaymentFees)}</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Count</p>
 <p className="text-lg font-semibold">{breakdown.directPaymentCount}</p>
 </div>
 </div>
 </div>
 
 {/* Transaction Payments Section */}
 <div>
 <h4 className="font-semibold mb-3 flex items-center gap-2">
 <Badge variant="secondary">Platform Transactions</Badge>
 <span className="text-muted-foreground text-sm font-normal">via PawBucks</span>
 </h4>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Earnings</p>
 <p className="text-lg font-semibold">{Formatters.currency(breakdown.transactionEarnings)}</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Count</p>
 <p className="text-lg font-semibold">{breakdown.transactionCount}</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Cashback Given</p>
 <p className="text-lg font-semibold">{breakdown.transactionCashbackPawBucks} PB</p>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Rewards Given</p>
 <p className="text-lg font-semibold">{breakdown.transactionRewardsPawBucks} PB</p>
 </div>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )}
 
 {/* Info Card */}
 <Card className="bg-muted/30">
 <CardContent className="py-4">
 <p className="text-sm text-muted-foreground">
 <strong>Note:</strong> Total earnings represent your net revenue after success fees (3% on Stripe-funded portion). 
 This includes all completed transactions from Direct Payments and PawBucks platform transactions. 
 Refunded amounts are tracked separately and excluded from totals.
 </p>
 </CardContent>
 </Card>
   </div>
 </MerchantWorkspaceLayout>
 );
 }
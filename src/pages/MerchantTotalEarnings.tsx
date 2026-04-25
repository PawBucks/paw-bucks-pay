 import { useNavigate } from "react-router-dom";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Skeleton } from "@/components/ui/skeleton";
 import { 
   ArrowLeft, 
   TrendingUp, 
   RefreshCw, 
   ExternalLink, 
   Wallet, 
   Receipt,
   DollarSign,
   Users,
   Gift,
   RotateCcw
 } from "lucide-react";
 import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
 
 export default function MerchantTotalEarnings() {
   const navigate = useNavigate();
   const { loading, refreshing, data, fetchEarnings } = useMerchantEarnings();
 
   if (loading) {
     return (
       <div className="min-h-screen bg-background p-4 md:p-8">
         <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-6">
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
         <div className="max-w-4xl lg:max-w-6xl mx-auto">
 <Button variant="ghost" onClick={() => navigate("/merchant-dashboard")} className="mb-6">
             <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
           </Button>
           <Card>
             <CardContent className="py-12 text-center">
               <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
               <p className="text-lg text-muted-foreground">Connect your Stripe account to view earnings details</p>
             </CardContent>
           </Card>
         </div>
       </div>
     );
   }
 
   const summary = data.summary;
   const breakdown = summary?.breakdown;
 
   return (
     <div className="min-h-screen bg-background p-4 md:p-8">
       <div className="max-w-4xl lg:max-w-6xl mx-auto space-y-6">
         {/* Header */}
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
 <Button variant="ghost" onClick={() => navigate("/merchant-dashboard")} size="icon">
               <ArrowLeft className="h-5 w-5" />
             </Button>
             <div>
               <h1 className="text-2xl font-bold">Total Earnings</h1>
               <p className="text-muted-foreground">Complete breakdown of your revenue</p>
             </div>
           </div>
           <div className="flex gap-2">
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
           </div>
         </div>
 
         {/* Main Earnings Card */}
         <Card className="border-primary/20 bg-primary/5">
           <CardHeader>
             <div className="flex items-center gap-3">
               <div className="p-3 rounded-full bg-primary/10">
                 <TrendingUp className="h-6 w-6 text-primary" />
               </div>
               <div>
                 <CardTitle className="text-3xl text-primary">
                   ${summary.totalEarnings.toFixed(2)}
                 </CardTitle>
                 <CardDescription>Net earnings after success fees</CardDescription>
               </div>
             </div>
           </CardHeader>
           <CardContent>
             <div className="grid gap-4 md:grid-cols-3">
               <div className="p-4 rounded-lg bg-background border">
                 <div className="flex items-center gap-2 mb-2">
                   <Receipt className="h-4 w-4 text-muted-foreground" />
                   <span className="text-sm text-muted-foreground">Transactions</span>
                 </div>
                 <p className="text-2xl font-bold">{summary.transactionCount}</p>
               </div>
               <div className="p-4 rounded-lg bg-background border">
                 <div className="flex items-center gap-2 mb-2">
                   <DollarSign className="h-4 w-4 text-muted-foreground" />
                   <span className="text-sm text-muted-foreground">Success Fees</span>
                 </div>
                 <p className="text-2xl font-bold">${summary.totalFees.toFixed(2)}</p>
               </div>
               <div className="p-4 rounded-lg bg-background border">
                 <div className="flex items-center gap-2 mb-2">
                   <Gift className="h-4 w-4 text-muted-foreground" />
                   <span className="text-sm text-muted-foreground">Rewards Given</span>
                 </div>
                 <p className="text-2xl font-bold">{summary.totalRewardsGiven} PB</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         {/* Refunds Card */}
         {summary.refunds && summary.refunds.count > 0 && (
           <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                 <RotateCcw className="h-5 w-5" />
                 Refunds
               </CardTitle>
               <CardDescription>Transactions that have been refunded</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="grid gap-4 md:grid-cols-2">
                 <div className="p-4 rounded-lg bg-background border">
                   <p className="text-sm text-muted-foreground mb-1">Refund Count</p>
                   <p className="text-2xl font-bold text-red-600">{summary.refunds.count}</p>
                 </div>
                 <div className="p-4 rounded-lg bg-background border">
                   <p className="text-sm text-muted-foreground mb-1">Total Refunded</p>
                   <p className="text-2xl font-bold text-red-600">${summary.refunds.amount.toFixed(2)}</p>
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
                 <Users className="h-5 w-5 text-primary" />
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
                       <p className="text-lg font-semibold">${breakdown.directPaymentEarnings.toFixed(2)}</p>
                     </div>
                     <div className="p-3 rounded-lg border bg-muted/30">
                       <p className="text-xs text-muted-foreground uppercase tracking-wide">Fees</p>
                       <p className="text-lg font-semibold">${breakdown.directPaymentFees.toFixed(2)}</p>
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
                       <p className="text-lg font-semibold">${breakdown.transactionEarnings.toFixed(2)}</p>
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
     </div>
   );
 }
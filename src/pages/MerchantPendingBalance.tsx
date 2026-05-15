import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, Clock, CreditCard, Info, Receipt, RefreshCw, Wallet } from "lucide-react";
import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
import { format } from "date-fns";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";

export default function MerchantPendingBalance() {
 const { loading, refreshing, data, fetchEarnings, formatCurrency, formatPayoutSchedule } = useMerchantEarnings();

 if (loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Dashboard" title="Pending Balance" subtitle="Funds being processed and cleared" />
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
   <WorkspacePageHeader section="Dashboard" title="Pending Balance" subtitle="Funds being processed and cleared" />
   <div className="p-4 md:p-6">
     <Card>
       <CardContent className="py-12 text-center">
         <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
         <p className="text-lg text-muted-foreground">Connect your Stripe account to view balance details</p>
       </CardContent>
     </Card>
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 const pendingBalances = data.balance?.pending || [];
 const totalPending = pendingBalances.reduce((sum, b) => sum + b.amount, 0);
 const pendingPayouts = data.payoutHistory.filter(p => ["pending","in_transit"].includes(p.status));
 const recentCharges = data.recentCharges || [];

 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader
     section="Dashboard"
     title="Pending Balance"
     subtitle="Funds being processed and cleared"
     actions={
       <Button variant="outline" size="sm" onClick={() => fetchEarnings(true)} disabled={refreshing}>
         <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
         Refresh
       </Button>
     }
   />
   <div className="p-4 md:p-6 space-y-6">

 {/* Main Balance Card with Estimated Arrival */}
 <Card className="border-warning/30 bg-warning/5">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-full bg-warning/15">
 <Clock className="h-6 w-6 text-warning" aria-hidden="true" />
 </div>
 <div>
 <CardTitle className="text-3xl text-warning">
 {formatCurrency(totalPending)}
 </CardTitle>
 <CardDescription>Total pending clearance</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Estimated Arrival */}
 {data.estimatedNextArrival && totalPending > 0 && (
 <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
 <CalendarClock className="h-5 w-5 text-warning shrink-0" />
 <div>
 <p className="text-sm font-medium text-warning">
 Estimated next arrival: {format(new Date(data.estimatedNextArrival * 1000),"EEEE, MMM d, yyyy")}
 </p>
 <p className="text-xs text-warning/80">
 Based on your payout schedule
 </p>
 </div>
 </div>
 )}

 {/* Payout Schedule */}
 {data.payoutSchedule && (
 <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
 <Info className="h-4 w-4 text-muted-foreground shrink-0" />
 <div>
 <p className="text-sm font-medium">Payout Schedule</p>
 <p className="text-xs text-muted-foreground">{formatPayoutSchedule()}</p>
 </div>
 </div>
 )}

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
 <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
 In-Transit Payouts
 </CardTitle>
 <CardDescription>Payouts currently being transferred to your bank</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {pendingPayouts.map((payout) => (
 <div key={payout.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors">
 <div>
 <p className="font-medium">{formatCurrency(payout.amount, payout.currency)}</p>
 <p className="text-sm text-muted-foreground">
 Expected {format(new Date(payout.arrivalDate * 1000),"EEEE, MMM d, yyyy")}
 </p>
 {payout.description && (
 <p className="text-xs text-muted-foreground mt-1">{payout.description}</p>
 )}
 </div>
 <div className="flex flex-col items-end gap-1">
 <Badge className="bg-warning/15 text-warning border-transparent">
 {payout.status ==="in_transit" ?"In Transit" :"Pending"}
 </Badge>
 {payout.method && (
 <span className="text-xs text-muted-foreground capitalize">{payout.method}</span>
 )}
 </div>
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
 <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
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
 const totalFees = charge.totalFees || ((charge.stripeFee || 0) + (charge.applicationFee || 0));
 return (
 <Card key={charge.id} className="border shadow-sm">
 <CardContent className="p-4">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm text-muted-foreground">
 {format(new Date(charge.created * 1000),"MMM d, yyyy'at' h:mm a")}
 </span>
 </div>
 <Badge variant={charge.status ==="succeeded" ?"default" :"secondary"}>
 {charge.status}
 </Badge>
 </div>

 {charge.description && (
 <p className="text-sm text-muted-foreground mb-4">{charge.description}</p>
 )}

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="font-medium">Payment amount</span>
 <span className="font-semibold">
 {formatCurrency(charge.amount, charge.currency)} {charge.currency.toUpperCase()}
 </span>
 </div>

 <Separator />

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
 {data.payoutSchedule && (
 <> Your payouts are scheduled <strong>{formatPayoutSchedule().toLowerCase()}</strong>.</>
 )}
 {!data.payoutSchedule && (
 <> These typically take 2-7 business days to clear and become available for payout, depending on your account settings.</>
 )}
 </p>
 </CardContent>
 </Card>
   </div>
 </MerchantWorkspaceLayout>
 );
}

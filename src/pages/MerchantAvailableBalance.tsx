import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, DollarSign, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { useMerchantEarnings } from "@/hooks/useMerchantEarnings";
import { format } from "date-fns";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
 
 export default function MerchantAvailableBalance() {
 const { loading, refreshing, data, fetchEarnings, formatCurrency } = useMerchantEarnings();
 
 if (loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Dashboard" title="Available Balance" subtitle="Funds ready for payout to your bank account" />
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
   <WorkspacePageHeader section="Dashboard" title="Available Balance" subtitle="Funds ready for payout to your bank account" />
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
 
 const availableBalances = data.balance?.available || [];
 const totalAvailable = availableBalances.reduce((sum, b) => sum + b.amount, 0);
 const paidPayouts = data.payoutHistory.filter(p => p.status ==="paid");
 
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader
     section="Dashboard"
     title="Available Balance"
     subtitle="Funds ready for payout to your bank account"
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
 
 {/* Main Balance Card */}
 <Card className="border-success/30 bg-success/5">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-full bg-success/15">
 <DollarSign className="h-6 w-6 text-success" aria-hidden="true" />
 </div>
 <div>
 <CardTitle className="text-3xl text-success">
 {formatCurrency(totalAvailable)}
 </CardTitle>
 <CardDescription>Total available for payout</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {availableBalances.length > 0 ? (
 <div className="space-y-3">
 <p className="text-sm font-medium text-muted-foreground mb-2">Balance by Currency</p>
 {availableBalances.map((balance, index) => (
 <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-background border">
 <div className="flex items-center gap-2">
 <Badge variant="outline">{balance.currency.toUpperCase()}</Badge>
 <span className="text-sm text-muted-foreground">Available</span>
 </div>
 <span className="font-semibold">{formatCurrency(balance.amount, balance.currency)}</span>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-muted-foreground text-center py-4">No available balance</p>
 )}
 </CardContent>
 </Card>
 
 {/* Recent Completed Payouts */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <CheckCircle className="h-5 w-5 text-success" />
 Completed Payouts
 </CardTitle>
 <CardDescription>Recent transfers to your bank account</CardDescription>
 </CardHeader>
 <CardContent>
 {paidPayouts.length === 0 ? (
 <p className="text-muted-foreground text-center py-8">No completed payouts yet</p>
 ) : (
 <div className="space-y-3 max-h-[400px] overflow-y-auto">
 {paidPayouts.slice(0, 20).map((payout) => (
 <div key={payout.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors">
 <div>
 <p className="font-medium">{formatCurrency(payout.amount, payout.currency)}</p>
 <p className="text-sm text-muted-foreground">
 Arrived {format(new Date(payout.arrivalDate * 1000),"MMM d, yyyy")}
 </p>
 </div>
 <Badge className="bg-success/15 text-success border-transparent">
 {payout.status}
 </Badge>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 
 {/* Info Card */}
 <Card className="bg-muted/30">
 <CardContent className="py-4">
 <p className="text-sm text-muted-foreground">
 <strong>Note:</strong> Available balance represents funds that have cleared and are ready for automatic payout 
 to your connected bank account. Payouts are typically processed daily based on your Stripe payout schedule.
 </p>
 </CardContent>
 </Card>
   </div>
 </MerchantWorkspaceLayout>
 );
 }
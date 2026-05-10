 import { useNavigate } from"react-router-dom";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
 import { Button } from"@/components/ui/button";
 import { Badge } from"@/components/ui/badge";
 import { Skeleton } from"@/components/ui/skeleton";
 import { ArrowLeft, RefreshCw, ExternalLink, CheckCircle } from "lucide-react";
 import { useMerchantEarnings } from"@/hooks/useMerchantEarnings";
 import { format } from"date-fns";
 
 export default function MerchantAvailableBalance() {
 const navigate = useNavigate();
 const { loading, refreshing, data, fetchEarnings, formatCurrency } = useMerchantEarnings();
 
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
 <span className="h-16 w-16 mx-auto text-muted-foreground mb-4" aria-hidden="true">👛</span>
 <p className="text-lg text-muted-foreground">Connect your Stripe account to view balance details</p>
 </CardContent>
 </Card>
 </div>
 </div>
 );
 }
 
 const availableBalances = data.balance?.available || [];
 const totalAvailable = availableBalances.reduce((sum, b) => sum + b.amount, 0);
 const paidPayouts = data.payoutHistory.filter(p => p.status ==="paid");
 
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
 <h1 className="text-2xl font-bold">Available Balance</h1>
 <p className="text-muted-foreground">Funds ready for payout to your bank account</p>
 </div>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={() => fetchEarnings(true)} disabled={refreshing}>
 <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ?"animate-spin" :""}`} />
 Refresh
 </Button>
 {data.dashboardUrl && (
 <Button size="sm" onClick={() => window.open(data.dashboardUrl!,"_blank")}>
 <ExternalLink className="h-4 w-4 mr-2" />
 Stripe Dashboard
 </Button>
 )}
 </div>
 </div>
 
 {/* Main Balance Card */}
 <Card className="border-success/30 bg-success/5">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-full bg-success/15">
 <span className="h-6 w-6 text-success" aria-hidden="true">💵</span>
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
 </div>
 );
 }
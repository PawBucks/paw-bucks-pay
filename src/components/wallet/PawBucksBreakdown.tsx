import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { Coins, Clock, CheckCircle, Info, Loader2, AlertTriangle } from"lucide-react";
import { Formatters } from"@/utils/formatters";
import { format, formatDistanceToNow, differenceInDays } from"date-fns";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";

interface PendingPawBucks {
 id: string;
 amount: number;
 vest_date: string;
 description: string;
 created_at: string;
}

interface ExpiringPawBucks {
 id: string;
 amount: number;
 expires_at: string;
 description: string;
 created_at: string;
}

interface PawBucksBreakdownProps {
 userId: string;
}

export const PawBucksBreakdown = ({ userId }: PawBucksBreakdownProps) => {
 const [availableBalance, setAvailableBalance] = useState<number>(0);
 const [pendingBalance, setPendingBalance] = useState<number>(0);
 const [pendingItems, setPendingItems] = useState<PendingPawBucks[]>([]);
 const [expiringItems, setExpiringItems] = useState<ExpiringPawBucks[]>([]);
 const [loading, setLoading] = useState(true);

 const sharedAccount = useSharedAccount(userId);
 const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

 useEffect(() => {
 if (effectiveUserId && !sharedAccount.isLoading) {
 loadBreakdown();
 }
 }, [effectiveUserId, sharedAccount.isLoading]);

 const loadBreakdown = async () => {
 if (!effectiveUserId) return;
 
 try {
 const [walletResult, pendingResult, expiringResult] = await Promise.all([
 supabase
 .from("pawbucks_wallet")
 .select("balance")
 .eq("user_id", effectiveUserId)
 .single(),
 supabase
 .from("pawbucks_activity")
 .select("id, amount, vest_date, description, created_at")
 .eq("user_id", effectiveUserId)
 .eq("pawbucks_status","pending")
 .order("vest_date", { ascending: true }),
 supabase
 .from("pawbucks_activity")
 .select("id, amount, expires_at, description, created_at")
 .eq("user_id", effectiveUserId)
 .eq("pawbucks_status","available")
 .eq("type","credit")
 .not("expires_at","is", null)
 .order("expires_at", { ascending: true })
 .limit(20),
 ]);

 setAvailableBalance(walletResult.data?.balance || 0);

 if (pendingResult.data) {
 setPendingItems(pendingResult.data);
 setPendingBalance(pendingResult.data.reduce((sum, item) => sum + item.amount, 0));
 }

 if (expiringResult.data) {
 // Only show items expiring within 30 days
 const soonExpiring = expiringResult.data.filter(item => {
 const daysLeft = differenceInDays(new Date(item.expires_at), new Date());
 return daysLeft <= 30 && daysLeft >= 0;
 });
 setExpiringItems(soonExpiring);
 }
 } catch (error) {
 console.error("Error loading PawBucks breakdown:", error);
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center p-4">
 <Loader2 className="w-5 h-5 animate-spin text-primary" />
 </div>
 );
 }

 const totalExpiring = expiringItems.reduce((sum, item) => sum + item.amount, 0);

 return (
 <div className="space-y-4">
 {/* Balance Cards */}
 <div className="grid grid-cols-2 gap-3">
 <Card className="p-4 bg-success/100/10 border-success/200/20">
 <div className="flex items-center gap-2 mb-1">
 <CheckCircle className="w-4 h-4 text-success" />
 <span className="text-sm text-muted-foreground">Available</span>
 </div>
 <p className="text-2xl font-bold text-success">
 {Formatters.number(availableBalance)}
 </p>
 </Card>
 
 <Card className="p-4 bg-warning/100/10 border-warning/200/20">
 <div className="flex items-center gap-2 mb-1">
 <Clock className="w-4 h-4 text-warning" />
 <span className="text-sm text-muted-foreground">Pending</span>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger>
 <Info className="w-3 h-3 text-muted-foreground" />
 </TooltipTrigger>
 <TooltipContent className="max-w-xs">
 <p>These PawBucks are pending and will become available 30 days after approval.</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </div>
 <p className="text-2xl font-bold text-warning">
 {Formatters.number(pendingBalance)}
 </p>
 </Card>
 </div>

 {/* Expiring Soon Alert */}
 {expiringItems.length > 0 && (
 <Card className="p-4 border-warning/200/30 bg-warning/100/5">
 <h4 className="font-medium mb-3 flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-warning0" />
 Expiring Soon
 <Badge variant="outline" className="text-xs bg-warning/100/10 text-warning border-warning/200/30">
 {Formatters.number(totalExpiring)} PB
 </Badge>
 </h4>
 <div className="space-y-2">
 {expiringItems.map((item) => {
 const daysLeft = differenceInDays(new Date(item.expires_at), new Date());
 const isUrgent = daysLeft <= 3;
 return (
 <div
 key={item.id}
 className={`flex items-center justify-between p-3 rounded-lg border ${
 isUrgent 
 ?'bg-destructive/100/10 border-destructive/200/30' 
 :'bg-muted/30 border-border/50'
 }`}
 >
 <div className="flex-1">
 <p className="text-sm font-medium">{item.description ||"Earned PawBucks"}</p>
 <p className={`text-xs ${isUrgent ?'text-destructive0 font-medium' :'text-muted-foreground'}`}>
 {daysLeft === 0 
 ?'Expires today!' 
 : daysLeft === 1 
 ?'Expires tomorrow!' 
 : `Expires in ${daysLeft} days`}
 </p>
 </div>
 <div className="text-right">
 <p className={`font-semibold ${isUrgent ?'text-destructive0' :'text-warning0'}`}>
 {Formatters.number(item.amount)}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(item.expires_at),'MMM d')}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 <div className="mt-3 p-3 bg-muted/30 rounded-lg">
 <div className="flex items-start gap-2">
 <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
 <p className="text-xs text-muted-foreground">
 Earned PawBucks expire 60 days after receiving them. Use them at any partner merchant before they expire!
 </p>
 </div>
 </div>
 </Card>
 )}

 {/* Pending Items List */}
 {pendingItems.length > 0 && (
 <Card className="p-4">
 <h4 className="font-medium mb-3 flex items-center gap-2">
 <Clock className="w-4 h-4 text-warning" />
 Pending PawBucks
 </h4>
 <div className="space-y-2">
 {pendingItems.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
 >
 <div className="flex-1">
 <p className="text-sm font-medium">{item.description ||"Non-partner receipt"}</p>
 <p className="text-xs text-muted-foreground">
 Available {formatDistanceToNow(new Date(item.vest_date), { addSuffix: true })}
 </p>
 </div>
 <div className="text-right">
 <p className="font-semibold text-warning">+{Formatters.number(item.amount)}</p>
 <Badge variant="outline" className="text-xs bg-warning/100/10 text-warning border-warning/200/30">
 Vesting
 </Badge>
 </div>
 </div>
 ))}
 </div>
 
 <div className="mt-3 p-3 bg-muted/30 rounded-lg">
 <div className="flex items-start gap-2">
 <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
 <p className="text-xs text-muted-foreground">
 Non-partner PawBucks are capped at 20,000 per month to keep rewards sustainable.
 </p>
 </div>
 </div>
 </Card>
 )}
 </div>
 );
};

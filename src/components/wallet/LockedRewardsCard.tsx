import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { Lock, Unlock, Info, Loader2, Shield, Clock, CheckCircle2 } from"lucide-react";
import { Formatters } from"@/utils/formatters";
import { formatDistanceToNow } from"date-fns";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { motion, AnimatePresence } from"framer-motion";

import { Formatters } from "@/utils/formatters";
interface LockedItem {
 id: string;
 amount: number;
 description: string;
 created_at: string;
 slice_id: string | null;
 slice_status: string;
}

interface LockedRewardsCardProps {
 userId: string;
 onBalanceUpdate?: (spendable: number, locked: number) => void;
}

const PAWBUCKS_TO_USD = 0.001;

export const LockedRewardsCard = ({ userId, onBalanceUpdate }: LockedRewardsCardProps) => {
 const [spendableBalance, setSpendableBalance] = useState<number>(0);
 const [lockedBalance, setLockedBalance] = useState<number>(0);
 const [lockedItems, setLockedItems] = useState<LockedItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [showDetails, setShowDetails] = useState(false);

 const sharedAccount = useSharedAccount(userId);
 const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

 useEffect(() => {
 if (effectiveUserId && !sharedAccount.isLoading) {
 loadBalances();
 }
 }, [effectiveUserId, sharedAccount.isLoading]);

 const loadBalances = async () => {
 if (!effectiveUserId) return;
 
 try {
 // Get spendable balance from wallet
 const { data: wallet } = await supabase
 .from("pawbucks_wallet")
 .select("balance")
 .eq("user_id", effectiveUserId)
 .single();

 const spendable = wallet?.balance || 0;
 setSpendableBalance(spendable);

 // Get locked rewards (pending status with slice_id)
 const { data: lockedData } = await supabase
 .from("pawbucks_activity")
 .select(`
 id,
 amount,
 description,
 created_at,
 slice_id,
 invoice_slices(recovery_status)
 `)
 .eq("user_id", effectiveUserId)
 .eq("pawbucks_status","pending")
 .eq("type","credit")
 .not("slice_id","is", null)
 .order("created_at", { ascending: false });

 if (lockedData) {
 const items: LockedItem[] = lockedData.map((item: any) => ({
 id: item.id,
 amount: item.amount,
 description: item.description,
 created_at: item.created_at,
 slice_id: item.slice_id,
 slice_status: item.invoice_slices?.recovery_status ||"pending",
 }));
 setLockedItems(items);
 const totalLocked = items.reduce((sum, item) => sum + item.amount, 0);
 setLockedBalance(totalLocked);
 
 onBalanceUpdate?.(spendable, totalLocked);
 }
 } catch (error) {
 console.error("Error loading locked rewards:", error);
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return (
 <Card className="border-border/50">
 <CardContent className="flex items-center justify-center p-6">
 <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
 </CardContent>
 </Card>
 );
 }

 const totalBalance = spendableBalance + lockedBalance;
 const spendableUSD = Formatters.money((spendableBalance * PAWBUCKS_TO_USD));
 const lockedUSD = Formatters.money((lockedBalance * PAWBUCKS_TO_USD));

 const getStatusIcon = (status: string) => {
 switch (status) {
 case"funded":
 return <CheckCircle2 className="w-3 h-3 text-success" />;
 case"action_required":
 return <Clock className="w-3 h-3 text-warning" />;
 default:
 return <Lock className="w-3 h-3 text-muted-foreground" />;
 }
 };

 const getStatusLabel = (status: string) => {
 switch (status) {
 case"funded":
 return"Releasing soon";
 case"action_required":
 return"Action needed";
 case"notification_sent":
 return"Awaiting response";
 default:
 return"Processing";
 }
 };

 return (
 <Card className="border-border/50 overflow-hidden">
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center justify-between">
 <span className="text-lg font-semibold">PawBucks Balance</span>
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <button className="text-muted-foreground hover:text-foreground transition-colors">
 <Info className="w-4 h-4" />
 </button>
 </TooltipTrigger>
 <TooltipContent side="left" className="max-w-xs">
 <div className="space-y-2 text-sm">
 <p className="font-medium">Reward Vesting</p>
 <p>PawBucks from vet visits are locked until the insurance claim is fully processed. This ensures accurate rewards based on final payment amounts.</p>
 <p className="text-muted-foreground">Locked rewards will automatically release once your claim is settled.</p>
 </div>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 </CardTitle>
 </CardHeader>
 
 <CardContent className="space-y-4">
 {/* Spendable Balance - Primary Display */}
 <div className="text-center p-4 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
 <div className="flex items-center justify-center gap-2 mb-1">
 <Unlock className="w-5 h-5 text-primary" />
 <span className="text-sm text-muted-foreground">Spendable</span>
 </div>
 <p className="text-4xl font-bold text-primary mb-1">
 {Formatters.number(spendableBalance)}
 </p>
 <p className="text-sm text-muted-foreground">
 ≈ ${spendableUSD} USD
 </p>
 </div>

 {/* Locked Balance - Secondary Display */}
 {lockedBalance > 0 && (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="p-3 rounded-lg bg-warning/10 border border-warning/20"
 >
 <button
 onClick={() => setShowDetails(!showDetails)}
 className="w-full flex items-center justify-between text-left"
 >
 <div className="flex items-center gap-2">
 <Lock className="w-4 h-4 text-warning" />
 <span className="text-sm font-medium text-warning">
 Locked Rewards
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-warning">
 +{Formatters.number(lockedBalance)} PB
 </span>
 <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
 ${lockedUSD}
 </Badge>
 </div>
 </button>

 <AnimatePresence>
 {showDetails && lockedItems.length > 0 && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:"auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="overflow-hidden"
 >
 <div className="mt-3 pt-3 border-t border-warning/20 space-y-2">
 {lockedItems.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between text-sm p-2 rounded bg-background/50"
 >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 {getStatusIcon(item.slice_status)}
 <span className="truncate text-muted-foreground">
 {item.description ||"Vet visit rewards"}
 </span>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <span className="font-medium text-warning">
 +{Formatters.number(item.amount)}
 </span>
 <Badge variant="outline" className="text-xs">
 {getStatusLabel(item.slice_status)}
 </Badge>
 </div>
 </div>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Vesting Info */}
 <div className="mt-3 flex items-start gap-2 text-xs text-warning/70">
 <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" />
 <span>
 These rewards vest once your insurance claim is fully processed. 
 Track progress in your dashboard.
 </span>
 </div>
 </motion.div>
 )}

 {/* Total Balance Footer */}
 <div className="pt-2 border-t border-border/50 flex justify-between text-sm text-muted-foreground">
 <span>Total (including locked)</span>
 <span className="font-medium">
 {Formatters.number(totalBalance)} PB
 </span>
 </div>
 </CardContent>
 </Card>
 );
};

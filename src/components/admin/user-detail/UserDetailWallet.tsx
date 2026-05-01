import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { Coins, Wallet, TrendingUp, TrendingDown, Award } from"lucide-react";
import { PAWBUCKS_CONVERSION } from"@/lib/constants";

import { Formatters } from "@/utils/formatters";
type WalletData = {
 balance: number;
 total_spent: number;
 rewards_points: number;
};

type PawBucksWalletData = {
 balance: number;
};

type PawBucksActivity = {
 id: string;
 amount: number;
 type: string;
 source: string | null;
 description: string | null;
 pawbucks_status: string | null;
 created_at: string;
};

type BadgeData = {
 id: string;
 earned_at: string;
 badge: {
 name: string;
 emoji: string;
 category: string;
 } | null;
};

export function UserDetailWallet({ userId }: { userId: string }) {
 const [wallet, setWallet] = useState<WalletData | null>(null);
 const [pawbucksWallet, setPawbucksWallet] = useState<PawBucksWalletData | null>(null);
 const [activity, setActivity] = useState<PawBucksActivity[]>([]);
 const [badges, setBadges] = useState<BadgeData[]>([]);
 const [loading, setLoading] = useState(true);
 const [isMerchant, setIsMerchant] = useState(false);

 useEffect(() => {
 loadData();
 }, [userId]);

 const loadData = async () => {
 setLoading(true);
 try {
 // Check if user is a merchant
 const { data: merchantData } = await supabase
 .from("merchants")
 .select("id")
 .eq("user_id", userId)
 .maybeSingle();

 const isMerchantUser = !!merchantData;
 setIsMerchant(isMerchantUser);

 const [walletRes, pbWalletRes, activityRes, badgesRes] = await Promise.all([
 supabase.from("wallets").select("balance, total_spent, rewards_points").eq("user_id", userId).maybeSingle(),
 supabase.from("pawbucks_wallet").select("balance").eq("user_id", userId).maybeSingle(),
 supabase.from("pawbucks_activity").select("id, amount, type, source, description, pawbucks_status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
 supabase.from("user_guilt_badges").select("id, earned_at, badge:guilt_badge_definitions(name, emoji, category)").eq("user_id", userId).order("earned_at", { ascending: false }),
 ]);

 // Also fetch merchant PawBucks wallet if applicable
 let merchantWalletData = null;
 if (isMerchantUser && merchantData) {
 const { data } = await supabase
 .from("merchant_pawbucks_wallet")
 .select("balance")
 .eq("merchant_id", merchantData.id)
 .maybeSingle();
 merchantWalletData = data;
 }

 if (walletRes.data) setWallet(walletRes.data);
 
 // Use merchant wallet if available, fall back to pet owner wallet
 if (isMerchantUser && merchantWalletData) {
 setPawbucksWallet(merchantWalletData);
 } else if (pbWalletRes.data) {
 setPawbucksWallet(pbWalletRes.data);
 }
 
 if (activityRes.data) setActivity(activityRes.data as PawBucksActivity[]);
 if (badgesRes.data) setBadges(badgesRes.data as unknown as BadgeData[]);
 } catch (err) {
 console.error("Failed to load wallet data:", err);
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>;
 }

 return (
 <div className="space-y-4">
 {/* Summary Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <SummaryCard
 icon={<Coins className="w-5 h-5 text-primary" />}
 label="PawBucks Balance"
 value={(pawbucksWallet?.balance ?? 0).toLocaleString()}
 />
 <SummaryCard
 icon={<Wallet className="w-5 h-5 text-success" />}
 label="Cashback Balance"
 value={`${Formatters.currency(((pawbucksWallet?.balance ?? 0) * PAWBUCKS_CONVERSION.PAWBUCKS_USD_VALUE))}`}
 />
 <SummaryCard
 icon={<TrendingDown className="w-5 h-5 text-destructive" />}
 label={isMerchant ?"Total Revenue" :"Total Spent"}
 value={`${Formatters.currency((wallet?.total_spent ?? 0))}`}
 />
 <SummaryCard
 icon={<Award className="w-5 h-5 text-warning" />}
 label="Badges Earned"
 value={badges.length.toString()}
 />
 </div>

 {/* Badges */}
 {badges.length > 0 && (
 <Card>
 <CardHeader><CardTitle>Badges ({badges.length})</CardTitle></CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {badges.map(b => (
 <Badge key={b.id} variant="outline" className="text-sm py-1 px-3">
 {b.badge?.emoji} {b.badge?.name}
 <span className="ml-1 text-xs text-muted-foreground">{new Date(b.earned_at).toLocaleDateString()}</span>
 </Badge>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* PawBucks Activity */}
 <Card>
 <CardHeader>
 <CardTitle>PawBucks Activity (Last 100)</CardTitle>
 </CardHeader>
 <CardContent>
 {activity.length === 0 ? (
 <p className="text-center text-muted-foreground py-6">No PawBucks activity.</p>
 ) : (
 <div className="border rounded-lg overflow-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Source</TableHead>
 <TableHead>Description</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {activity.map(a => (
 <TableRow key={a.id}>
 <TableCell className="whitespace-nowrap text-sm">{new Date(a.created_at).toLocaleDateString()}</TableCell>
 <TableCell>
 <div className="flex items-center gap-1">
 {a.type ==="credit" || a.type ==="earn" ? (
 <TrendingUp className="w-3 h-3 text-success" />
 ) : (
 <TrendingDown className="w-3 h-3 text-destructive" />
 )}
 <span className="text-sm">{a.type}</span>
 </div>
 </TableCell>
 <TableCell className="text-sm">{a.source ||"—"}</TableCell>
 <TableCell className="text-sm max-w-[250px] truncate">{a.description ||"—"}</TableCell>
 <TableCell>
 {a.pawbucks_status && (
 <Badge variant={a.pawbucks_status ==="available" ?"default" :"secondary"} className="text-xs">
 {a.pawbucks_status}
 </Badge>
 )}
 </TableCell>
 <TableCell className={`text-right font-medium ${a.type ==="credit" || a.type ==="earn" ?"text-success" :"text-destructive"}`}>
 {a.type ==="credit" || a.type ==="earn" ?"+" :"-"}{Math.abs(a.amount).toLocaleString()}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
 return (
 <Card>
 <CardContent className="pt-4 flex items-center gap-3">
 <div className="p-2 rounded-lg bg-muted">{icon}</div>
 <div>
 <p className="text-xs text-muted-foreground">{label}</p>
 <p className="text-lg font-bold">{value}</p>
 </div>
 </CardContent>
 </Card>
 );
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import { Award, Crown, Medal, Store, Trophy } from "lucide-react";
import { cn } from"@/lib/utils";
import type { MerchantLeaderboardEntry } from"@/services/api/brandCampaigns.service";

interface MerchantLeaderboardProps {
 entries: MerchantLeaderboardEntry[];
}

const RANK_DECOR = [
 { icon: Crown, color:"text-warning", bg:"bg-warning/10 border-warning/30", label:"🥇" },
 { icon: Medal, color:"text-muted-foreground", bg:"bg-muted/40 border-border", label:"🥈" },
 { icon: Award, color:"text-accent", bg:"bg-accent/10 border-accent/30", label:"🥉" },
];

export function MerchantLeaderboard({ entries }: MerchantLeaderboardProps) {
 return (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Trophy className="h-4 w-4 text-warning" />
 Top Performing Merchants
 </CardTitle>
 <CardDescription>Driving the most check-ins for your campaigns</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 {entries.length === 0 ? (
 <div className="py-8 text-center text-sm text-muted-foreground">
 <Store className="h-8 w-8 mx-auto mb-2 opacity-40" />
 No merchant activity yet
 </div>
 ) : (
 entries.map((entry, idx) => {
 const decor = RANK_DECOR[idx];
 return (
 <div
 key={entry.merchant_id}
 className={cn(
"flex items-center gap-3 rounded-lg p-2.5 border transition-colors",
 decor ? decor.bg :"border-transparent hover:bg-muted"
 )}
 >
 <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center text-xs font-bold flex-shrink-0">
 {decor ? decor.label : `#${idx + 1}`}
 </div>
 <Avatar className="h-9 w-9 flex-shrink-0">
 {entry.logo_url && <AvatarImage src={entry.logo_url} alt={entry.business_name} />}
 <AvatarFallback className="text-xs">
 {entry.business_name.slice(0, 2).toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm truncate">{entry.business_name}</p>
 <p className="text-xs text-muted-foreground">
 {entry.unique_users.toLocaleString()} unique pet owners
 </p>
 </div>
 <div className="text-right flex-shrink-0">
 <p className="font-bold text-sm tabular-nums">{entry.checkins.toLocaleString()}</p>
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
 check-ins
 </p>
 </div>
 </div>
 );
 })
 )}
 </CardContent>
 </Card>
 );
}

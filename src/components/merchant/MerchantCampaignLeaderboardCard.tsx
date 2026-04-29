import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Trophy, Loader2, Crown, Medal, Award } from"lucide-react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { cn } from"@/lib/utils";

interface MerchantCampaignLeaderboardCardProps {
 merchantId: string;
}

interface CampaignRanking {
 campaign_id: string;
 campaign_name: string;
 brand_name: string;
 brand_logo: string | null;
 my_checkins: number;
 my_rank: number;
 total_merchants: number;
}

const RANK_DECOR = [
 { icon: Crown, color:"text-warning", bg:"bg-warning/10 border-warning/30" },
 { icon: Medal, color:"text-muted-foreground", bg:"bg-muted/10 border-border/30" },
 { icon: Award, color:"text-warning", bg:"bg-warning/10 border-warning/30" },
];

export function MerchantCampaignLeaderboardCard({ merchantId }: MerchantCampaignLeaderboardCardProps) {
 const { data, isLoading } = useQuery({
 queryKey: ["merchant-campaign-rankings", merchantId],
 queryFn: async (): Promise<CampaignRanking[]> => {
 // 1. campaigns this merchant participates in
 const { data: enrollments } = await supabase
 .from("brand_campaign_merchants")
 .select("campaign_id, brand_campaigns!inner(id, name, status, brand_accounts!inner(brand_name, logo_url))")
 .eq("merchant_id", merchantId)
 .eq("status","active");

 if (!enrollments?.length) return [];

 const rankings: CampaignRanking[] = [];

 for (const e of enrollments) {
 const campaign = (e as any).brand_campaigns;
 if (campaign.status !=="active") continue;

 // Aggregate checkins per merchant for this campaign
 const { data: activity } = await supabase
 .from("branded_pawbucks_activity")
 .select("merchant_id")
 .eq("campaign_id", e.campaign_id)
 .eq("type","earn")
 .not("merchant_id","is", null)
 .limit(2000);

 const counts = new Map<string, number>();
 for (const a of activity || []) {
 if (!(a as any).merchant_id) continue;
 counts.set((a as any).merchant_id, (counts.get((a as any).merchant_id) || 0) + 1);
 }
 const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
 const myRank = sorted.findIndex(([mid]) => mid === merchantId);
 const myCheckins = counts.get(merchantId) || 0;

 rankings.push({
 campaign_id: e.campaign_id,
 campaign_name: campaign.name,
 brand_name: campaign.brand_accounts.brand_name,
 brand_logo: campaign.brand_accounts.logo_url,
 my_checkins: myCheckins,
 my_rank: myRank >= 0 ? myRank + 1 : sorted.length + 1,
 total_merchants: Math.max(sorted.length, 1),
 });
 }

 return rankings.sort((a, b) => a.my_rank - b.my_rank);
 },
 refetchInterval: 60000,
 });

 if (isLoading) {
 return (
 <Card>
 <CardContent className="py-8 flex justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </CardContent>
 </Card>
 );
 }

 if (!data || data.length === 0) return null;

 return (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Trophy className="h-4 w-4 text-warning" />
 Brand Campaign Rankings
 </CardTitle>
 <CardDescription>Your position in active brand campaigns</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 {data.map((r) => {
 const decor = RANK_DECOR[r.my_rank - 1];
 return (
 <div
 key={r.campaign_id}
 className={cn(
"flex items-center gap-3 rounded-lg p-3 border",
 decor ? decor.bg :"border-border bg-muted/30"
 )}
 >
 <div className={cn(
"w-9 h-9 rounded-full bg-background flex items-center justify-center font-bold text-sm flex-shrink-0",
 decor?.color
 )}>
 #{r.my_rank}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm truncate">{r.campaign_name}</p>
 <p className="text-xs text-muted-foreground truncate">
 by {r.brand_name} · {r.my_checkins} check-ins · of {r.total_merchants} merchants
 </p>
 </div>
 </div>
 );
 })}
 </CardContent>
 </Card>
 );
}

import { memo, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Skeleton } from"@/components/ui/skeleton";
import { Gift, ArrowRight, Star } from"lucide-react";

interface LoyaltyMerchant {
 id: string;
 name: string;
 emoji: string | null;
 reward_description: string;
 punches_required: number;
 merchant_id: string;
 business_name: string;
}

function useMerchantsWithLoyaltyPrograms() {
 return useQuery({
 queryKey: ["merchants-with-loyalty-programs"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("merchant_loyalty_programs")
 .select("id, name, emoji, reward_description, punches_required, merchant_id, merchants!inner(business_name)")
 .eq("is_active", true)
 .limit(6);

 if (error) throw error;
 return (data || []).map((program: any) => ({
 id: program.id,
 name: program.name,
 emoji: program.emoji,
 reward_description: program.reward_description,
 punches_required: program.punches_required,
 merchant_id: program.merchant_id,
 business_name: program.merchants.business_name,
 })) as LoyaltyMerchant[];
 },
 staleTime: 120000,
 });
}

interface LoyaltyProgramDiscoveryProps {
 userId: string;
}

const LoyaltyProgramDiscoveryComponent = ({ userId }: LoyaltyProgramDiscoveryProps) => {
 const navigate = useNavigate();
 const { data: programs, isLoading } = useMerchantsWithLoyaltyPrograms();

 const handleViewMerchant = useCallback((merchantId: string) => {
 navigate(`/merchant/${merchantId}`);
 }, [navigate]);

 if (isLoading) {
 return (
 <GradientCard>
 <div className="flex items-center gap-2 mb-4">
 <Skeleton className="w-5 h-5 rounded" />
 <Skeleton className="h-5 w-48" />
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 {[1, 2].map((i) => (
 <Skeleton key={i} className="h-24 rounded-lg" />
 ))}
 </div>
 </GradientCard>
 );
 }

 if (!programs || programs.length === 0) return null;

 return (
 <GradientCard>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Gift className="w-5 h-5 text-primary" />
 <h3 className="font-semibold text-base sm:text-lg">Merchants with Loyalty Rewards</h3>
 </div>
 <Badge variant="secondary" className="text-xs">
 <Star className="w-3 h-3 mr-1" />
 Earn Free Services
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mb-4">
 These merchants offer punch-card rewards. You're automatically enrolled when you make your first purchase — just pay and start collecting punches!
 </p>
 <div className="grid gap-3 sm:grid-cols-2">
 {programs.slice(0, 4).map((program) => (
 <button
 key={program.id}
 onClick={() => handleViewMerchant(program.merchant_id)}
 className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-accent/5 hover:border-accent/30 transition-all text-left group"
 >
 <span className="text-2xl flex-shrink-0 mt-0.5">
 {program.emoji ||"🎁"}
 </span>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm text-foreground group-hover:text-accent transition-colors truncate">
 {program.business_name}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
 {program.reward_description}
 </p>
 <p className="text-xs text-primary/80 mt-1 font-medium">
 {program.punches_required} visits to earn reward
 </p>
 </div>
 <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
 </button>
 ))}
 </div>
 {programs.length > 4 && (
 <Button
 variant="ghost"
 size="sm"
 className="w-full mt-3 text-muted-foreground hover:text-accent"
 onClick={() => navigate("/discover")}
 >
 View all {programs.length} merchants with loyalty programs
 <ArrowRight className="w-4 h-4 ml-1" />
 </Button>
 )}
 </GradientCard>
 );
};

export const LoyaltyProgramDiscovery = memo(LoyaltyProgramDiscoveryComponent);
LoyaltyProgramDiscovery.displayName ="LoyaltyProgramDiscovery";

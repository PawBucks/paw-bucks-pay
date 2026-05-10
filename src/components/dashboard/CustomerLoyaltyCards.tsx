import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { Stamp, Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from"react-router-dom";

type PunchCardWithProgram = {
 id: string;
 program_id: string;
 user_id: string;
 merchant_id: string;
 current_punches: number;
 total_punches_earned: number;
 cards_completed: number;
 merchant_loyalty_programs: {
 name: string;
 emoji: string;
 punches_required: number;
 reward_description: string;
 qualifying_description: string | null;
 is_active: boolean;
 };
 merchants: {
 business_name: string;
 logo_url: string | null;
 };
};

type AvailableReward = {
 id: string;
 status: string;
 merchant_loyalty_programs: {
 name: string;
 emoji: string;
 reward_description: string;
 };
 merchants: {
 business_name: string;
 };
};

interface CustomerLoyaltyCardsProps {
 userId: string;
 compact?: boolean;
}

export function CustomerLoyaltyCards({ userId, compact = false }: CustomerLoyaltyCardsProps) {
 const [punchCards, setPunchCards] = useState<PunchCardWithProgram[]>([]);
 const [availableRewards, setAvailableRewards] = useState<AvailableReward[]>([]);
 const [loading, setLoading] = useState(true);
 const navigate = useNavigate();

 useEffect(() => {
 const load = async () => {
 try {
 const [cardsRes, rewardsRes] = await Promise.all([
 supabase
 .from("customer_punch_cards")
 .select("*, merchant_loyalty_programs(*), merchants(business_name, logo_url)")
 .eq("user_id", userId)
 .order("updated_at", { ascending: false }),
 supabase
 .from("loyalty_reward_redemptions")
 .select("*, merchant_loyalty_programs(name, emoji, reward_description), merchants(business_name)")
 .eq("user_id", userId)
 .eq("status","available"),
 ]);

 if (cardsRes.error) throw cardsRes.error;
 setPunchCards((cardsRes.data || []) as unknown as PunchCardWithProgram[]);
 setAvailableRewards((rewardsRes.data || []) as unknown as AvailableReward[]);
 } catch (error) {
 console.error("Error loading loyalty cards:", error);
 } finally {
 setLoading(false);
 }
 };
 load();
 }, [userId]);

 if (loading) {
 return (
 <Card>
 <CardContent className="py-6 flex items-center justify-center">
 <Loader2 className="w-5 h-5 animate-spin text-primary" />
 </CardContent>
 </Card>
 );
 }

 if (punchCards.length === 0 && availableRewards.length === 0) {
 return null; // Don't show anything if no loyalty activity
 }

 // In compact mode, show a summary widget for the dashboard
 if (compact) {
 const totalRewards = availableRewards.length;
 const closestCard = punchCards.reduce<PunchCardWithProgram | null>((best, card) => {
 if (!card.merchant_loyalty_programs?.is_active) return best;
 const remaining = card.merchant_loyalty_programs.punches_required - card.current_punches;
 if (!best) return card;
 const bestRemaining = best.merchant_loyalty_programs.punches_required - best.current_punches;
 return remaining < bestRemaining ? card : best;
 }, null);

 return (
 <Card className="overflow-hidden">
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <CardTitle className="text-base flex items-center gap-2">
 <Stamp className="w-4 h-4 text-primary" />
 Loyalty Cards
 </CardTitle>
 <Button variant="ghost" size="sm" onClick={() => navigate("/loyalty-cards")}>
 View All <ChevronRight className="w-4 h-4 ml-1" />
 </Button>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 {totalRewards > 0 && (
 <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-3">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🎁</span>
 <div>
 <p className="text-sm font-semibold">
 {totalRewards} reward{totalRewards > 1 ?"s" :""} ready!
 </p>
 <p className="text-xs text-muted-foreground">
 Redeem on your next visit
 </p>
 </div>
 </div>
 )}
 {closestCard && closestCard.merchant_loyalty_programs && (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="flex items-center gap-2">
 <span>{closestCard.merchant_loyalty_programs.emoji}</span>
 <span className="font-medium">{closestCard.merchants?.business_name}</span>
 </span>
 <span className="text-muted-foreground">
 {closestCard.current_punches}/{closestCard.merchant_loyalty_programs.punches_required}
 </span>
 </div>
 <Progress
 value={(closestCard.current_punches / closestCard.merchant_loyalty_programs.punches_required) * 100}
 className="h-2"
 />
 <p className="text-xs text-muted-foreground">
 {closestCard.merchant_loyalty_programs.punches_required - closestCard.current_punches} more to earn: {closestCard.merchant_loyalty_programs.reward_description}
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 );
 }

 // Full view
 return (
 <div className="space-y-6">
 {/* Available Rewards */}
 {availableRewards.length > 0 && (
 <div className="space-y-3">
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <span className="w-5 h-5 text-primary" aria-hidden="true">🏆</span>
 Your Rewards
 </h3>
 <div className="grid gap-3 sm:grid-cols-2">
 {availableRewards.map((reward) => (
 <Card key={reward.id} className="bg-primary/5 border-primary/20">
 <CardContent className="py-4 flex items-center gap-3">
 <span className="text-2xl">{reward.merchant_loyalty_programs?.emoji}</span>
 <div className="flex-1">
 <p className="font-semibold text-sm">
 {reward.merchant_loyalty_programs?.reward_description}
 </p>
 <p className="text-xs text-muted-foreground">
 {reward.merchants?.business_name}
 </p>
 </div>
 <Badge>Ready</Badge>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 )}

 {/* Active Punch Cards */}
 <div className="space-y-3">
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <Stamp className="w-5 h-5 text-primary" />
 Your Punch Cards
 </h3>
 <div className="grid gap-4 sm:grid-cols-2">
 {punchCards.map((card) => {
 const program = card.merchant_loyalty_programs;
 if (!program) return null;
 const progress = (card.current_punches / program.punches_required) * 100;

 return (
 <Card key={card.id}>
 <CardContent className="py-4 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-2xl">{program.emoji}</span>
 <div>
 <p className="font-semibold text-sm">{program.name}</p>
 <p className="text-xs text-muted-foreground">
 {card.merchants?.business_name}
 </p>
 </div>
 </div>
 {!program.is_active && (
 <Badge variant="secondary" className="text-xs">Paused</Badge>
 )}
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Progress</span>
 <span className="font-medium">
 {card.current_punches} / {program.punches_required}
 </span>
 </div>
 <Progress value={progress} className="h-2.5" />
 </div>

 {/* Visual punch circles */}
 <div className="flex flex-wrap gap-1.5">
 {Array.from({ length: program.punches_required }).map((_, i) => (
 <div
 key={i}
 className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
 i < card.current_punches
 ?"bg-primary text-primary-foreground"
 :"border-2 border-muted-foreground/20"
 }`}
 >
 {i < card.current_punches ? (
 <Stamp className="w-3 h-3" />
 ) : null}
 </div>
 ))}
 <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
 <span className="w-3 h-3 text-accent-foreground" aria-hidden="true">🎁</span>
 </div>
 </div>

 <p className="text-xs text-muted-foreground">
 🎯 {program.punches_required - card.current_punches} more to earn: {program.reward_description}
 </p>

 {card.cards_completed > 0 && (
 <p className="text-xs text-primary font-medium">
 🏆 {card.cards_completed} reward{card.cards_completed > 1 ?"s" :""} earned total
 </p>
 )}
 </CardContent>
 </Card>
 );
 })}
 </div>
 </div>
 </div>
 );
}

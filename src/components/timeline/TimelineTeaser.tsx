import { useState, useEffect } from"react";
import { motion } from"framer-motion";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { format } from"date-fns";
import { ChevronRight, BookOpen, Coins, Camera } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";

interface TimelineMoment {
 id: string;
 pet_id: string;
 title: string;
 narrative: string;
 emoji: string;
 photo_url: string | null;
 pawbucks_earned: number;
 moment_date: string;
}

interface PetInfo {
 id: string;
 name: string;
}

interface TimelineTeaserProps {
 userId: string;
 pets: PetInfo[];
}

export const TimelineTeaser = ({ userId, pets }: TimelineTeaserProps) => {
 const navigate = useNavigate();
 const [latestMoment, setLatestMoment] = useState<TimelineMoment | null>(null);
 const [momentCount, setMomentCount] = useState(0);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!userId || pets.length === 0) {
 setLoading(false);
 return;
 }

 const fetchLatest = async () => {
 try {
 const petIds = pets.map(p => p.id);
 
 // Fetch latest moment and count in parallel
 const [momentResult, countResult] = await Promise.all([
 supabase
 .from("pet_timeline_moments")
 .select("*")
 .in("pet_id", petIds)
 .order("moment_date", { ascending: false })
 .limit(1)
 .maybeSingle(),
 supabase
 .from("pet_timeline_moments")
 .select("id", { count:"exact", head: true })
 .in("pet_id", petIds)
 ]);

 if (momentResult.data) {
 setLatestMoment(momentResult.data);
 }
 setMomentCount(countResult.count || 0);
 } catch (error) {
 console.error("[TimelineTeaser] Error:", error);
 } finally {
 setLoading(false);
 }
 };

 fetchLatest();

 // Subscribe to new moments
 const channel = supabase
 .channel("timeline-teaser-updates")
 .on(
"postgres_changes",
 {
 event:"INSERT",
 schema:"public",
 table:"pet_timeline_moments",
 filter: `user_id=eq.${userId}`,
 },
 (payload) => {
 setLatestMoment(payload.new as TimelineMoment);
 setMomentCount(c => c + 1);
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [userId, pets]);

 const getPetName = (petId: string): string => {
 const pet = pets.find(p => p.id === petId);
 return pet?.name ||"Your Pet";
 };

 if (loading) {
 return null;
 }

 // If no moments yet, show an enticing empty state
 if (!latestMoment) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5 }}
 >
 <Card className="overflow-hidden border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 hover:border-primary transition-all cursor-pointer group">
 <CardContent className="p-4">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Sparkles className="w-7 h-7 text-primary" />
 </div>
 <div className="flex-1">
 <h3 className="font-semibold text-base mb-1">
 ✨ Your Pet's Story, Unlocked
 </h3>
 <p className="text-sm text-muted-foreground">
 Every paw print, vet visit, and snack run adds to their timeline. See how every dollar spent becomes a memory.
 </p>
 </div>
 <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
 </div>
 </CardContent>
 </Card>
 </motion.div>
 );
 }

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5 }}
 >
 <Card 
 className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group"
 onClick={() => navigate("/pet-timeline")}
 >
 <CardContent className="p-4">
 <div className="flex items-start gap-4">
 {/* Latest moment photo or icon */}
 {latestMoment.photo_url ? (
 <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
 <img 
 src={latestMoment.photo_url} 
 alt="Latest moment"
 className="w-full h-full object-cover"
 />
 </div>
 ) : (
 <div className="w-16 h-16 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
 {latestMoment.emoji}
 </div>
 )}
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="w-4 h-4 text-primary" />
 <span className="text-xs font-medium text-primary uppercase tracking-wide">
 Latest Adventure
 </span>
 {momentCount > 1 && (
 <Badge variant="secondary" className="text-xs">
 +{momentCount - 1} more
 </Badge>
 )}
 </div>
 
 <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
 <span className="text-lg">{latestMoment.emoji}</span>
 {latestMoment.title}
 </h3>
 
 <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
 {latestMoment.narrative}
 </p>
 
 {latestMoment.pawbucks_earned > 0 && (
 <Badge className="bg-gradient-to-r from-primary to-accent text-white text-xs gap-1">
 <Coins className="w-3 h-3" />
 +{latestMoment.pawbucks_earned.toLocaleString()} PawBucks
 </Badge>
 )}
 </div>
 
 <div className="flex flex-col items-end gap-2">
 <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
 <span className="text-xs text-muted-foreground whitespace-nowrap">
 Tap to view
 </span>
 </div>
 </div>
 
 {/* Decorative footer */}
 <div className="mt-3 pt-3 border-t border-primary/10 flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <BookOpen className="w-3.5 h-3.5" />
 <span>
 {getPetName(latestMoment.pet_id)}'s timeline has {momentCount} {momentCount === 1 ?'moment' :'moments'}
 </span>
 </div>
 <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 group-hover:bg-primary/10">
 View All
 <ChevronRight className="w-3 h-3" />
 </Button>
 </div>
 </CardContent>
 </Card>
 </motion.div>
 );
};

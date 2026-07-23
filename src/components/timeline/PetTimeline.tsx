import { useState, useEffect } from"react";
import { motion, AnimatePresence } from"framer-motion";
import { supabase } from"@/integrations/supabase/client";
import { format, isToday, isYesterday, isThisWeek } from"date-fns";
import { ChevronRight } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Badge } from"@/components/ui/badge";
import { AspectRatio } from"@/components/ui/aspect-ratio";
import { Skeleton } from"@/components/ui/skeleton";
import { PhotoLightbox } from"@/components/PhotoLightbox";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
interface TimelineMoment {
 id: string;
 pet_id: string;
 title: string;
 narrative: string;
 emoji: string;
 photo_url: string | null;
 merchant_name: string | null;
 merchant_category: string | null;
 amount: number | null;
 pawbucks_earned: number;
 moment_type: string;
 mood: string;
 moment_date: string;
 created_at: string;
 source?:'transaction' |'medical_visit' |'medical_record';
}

interface PetInfo {
 id: string;
 name: string;
 type: string;
 photo_url?: string;
}

interface PetTimelineProps {
 userId: string;
 pets: PetInfo[];
 limit?: number;
 showHeader?: boolean;
 compact?: boolean;
 onViewAll?: () => void;
}

const moodColors: Record<string, string> = {
 happy:"from-warning/20 to-warning/20",
 proud:"from-accent/20 to-accent/20",
 cozy:"from-info/20 to-info/20",
 adventurous:"from-success/20 to-success/20",
 brave:"from-destructive/20 to-destructive/20",
 playful:"from-accent/20 to-accent/20",
};

const moodBorderColors: Record<string, string> = {
 happy:"border-warning/30",
 proud:"border-accent/30",
 cozy:"border-info/30",
 adventurous:"border-success/30",
 brave:"border-destructive/30",
 playful:"border-accent/30",
};

function formatMomentDate(dateString: string): string {
 const date = new Date(dateString);
 if (isToday(date)) return"Today";
 if (isYesterday(date)) return"Yesterday";
 if (isThisWeek(date)) return format(date,"EEEE");
 return format(date,"MMM d");
}

const MomentCard = ({ 
 moment, 
 petName, 
 index,
 compact,
 onPhotoClick 
}: { 
 moment: TimelineMoment; 
 petName: string;
 index: number;
 compact?: boolean;
 onPhotoClick?: (url: string) => void;
}) => {
 const bgGradient = moodColors[moment.mood] || moodColors.happy;
 const borderColor = moodBorderColors[moment.mood] || moodBorderColors.happy;
 const photoUrl = moment.photo_url;

 return (
 <motion.div
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.1, duration: 0.4 }}
 className="relative w-full max-w-full min-w-0 overflow-hidden"
 >
 {/* Timeline connector */}
 {!compact && (
 <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 to-transparent" />
 )}
 
  <div className={`flex w-full max-w-full min-w-0 gap-2 overflow-hidden sm:gap-3 ${compact ?'' :'pl-0 sm:pl-2'}`}>
 {/* Timeline dot */}
 {!compact && (
  <div className="relative z-10 mt-3 sm:mt-4">
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base shadow-lg sm:text-lg">
 {moment.emoji}
 </div>
 </div>
 )}
 
   <Card className={`w-full max-w-full flex-1 min-w-0 overflow-hidden border-2 ${borderColor} bg-gradient-to-br ${bgGradient} backdrop-blur-sm transition-all duration-300 hover:shadow-lg`}>
   <CardContent className={compact ?"p-3" :"p-3 sm:p-4"}>
   <div className={`flex w-full max-w-full min-w-0 gap-2 overflow-hidden sm:gap-3 ${compact ?'' :'flex-col sm:flex-row'}`}>
 {/* Photo */}
  {photoUrl && (
 <motion.div 
 whileHover={{ scale: 1.05 }}
   className={`${compact ?'w-16 h-16' :'h-32 w-full sm:h-20 sm:w-20'} max-w-full rounded-lg overflow-hidden flex-shrink-0 cursor-pointer shadow-md`}
  onClick={() => onPhotoClick?.(photoUrl)}
 >
 <img 
  src={photoUrl} 
 alt={moment.title}
 className="w-full h-full object-cover"
 />
 </motion.div>
 )}
 
  <div className="flex-1 min-w-0 max-w-full overflow-hidden break-words">
  <div className="flex min-w-0 items-start justify-between gap-2 mb-1">
  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
 {compact && <span className="text-lg">{moment.emoji}</span>}
   <h4 className={`min-w-0 flex-1 font-semibold ${compact ?'truncate text-sm' :'line-clamp-2 text-sm sm:truncate sm:text-base'}`}>
 {moment.title}
 </h4>
 </div>
  <Badge variant="outline" className="flex-shrink-0 whitespace-nowrap text-[10px] sm:text-xs">
 {formatMomentDate(moment.moment_date)}
 </Badge>
 </div>
 
   <p className={`max-w-full break-words text-muted-foreground ${compact ?'text-xs line-clamp-2' :'text-sm'} mb-2`}>
 {moment.narrative}
 </p>
 
  <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 overflow-hidden sm:gap-3">
 {moment.amount && (
  <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
 {Formatters.currency(moment.amount)}
 </span>
 )}
 {moment.pawbucks_earned > 0 && (
  <Badge className="max-w-full min-w-0 overflow-hidden bg-gradient-to-r from-primary to-accent text-white text-xs gap-1">
 <PawBucksLogo className="w-3 h-3" />
  <span className="truncate">+{moment.pawbucks_earned.toLocaleString()} PawBucks</span>
 </Badge>
 )}
 {moment.merchant_name && !compact && (
  <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
 @ {moment.merchant_name}
 </span>
 )}
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </motion.div>
 );
};

const TimelineSkeleton = ({ count = 3 }: { count?: number }) => (
 <div className="space-y-4">
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="flex gap-3 pl-2">
 <Skeleton className="w-8 h-8 rounded-full" />
 <div className="flex-1 space-y-2">
 <Skeleton className="h-20 w-full rounded-lg" />
 </div>
 </div>
 ))}
 </div>
);

const EmptyTimeline = ({ petName }: { petName?: string }) => (
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-center py-8 px-4"
 >
 <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
 <Sparkles className="w-8 h-8 text-primary" />
 </div>
 <h3 className="font-semibold text-lg mb-2">
 {petName ? `${petName}'s Story Awaits` :"Your Pet's Story Awaits"}
 </h3>
 <p className="text-sm text-muted-foreground max-w-xs mx-auto">
 Every paw print, vet visit, and snack run adds to their timeline. Make your first purchase to start the adventure!
 </p>
 </motion.div>
);

export const PetTimeline = ({ 
 userId, 
 pets, 
 limit = 10, 
 showHeader = true,
 compact = false,
 onViewAll 
}: PetTimelineProps) => {
 const [moments, setMoments] = useState<TimelineMoment[]>([]);
 const [loading, setLoading] = useState(true);
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [lightboxPhoto, setLightboxPhoto] = useState<string>("");

 useEffect(() => {
 if (!userId || pets.length === 0) {
 setLoading(false);
 return;
 }

 const fetchMoments = async () => {
 try {
 const petIds = pets.map(p => p.id);
 
 // Fetch timeline moments from transactions
 const { data: transactionMoments, error: tmError } = await supabase
 .from("pet_timeline_moments")
 .select("*")
 .in("pet_id", petIds)
 .order("moment_date", { ascending: false })
 .limit(limit);

 if (tmError) console.error("[PetTimeline] Error fetching transaction moments:", tmError);

 // Fetch medical visits and convert to timeline format
 const { data: medicalVisits, error: mvError } = await supabase
 .from("pet_medical_visits")
 .select("id, pet_id, vet_name, doctor_name, visit_date, notes, created_at")
 .in("pet_id", petIds)
 .order("visit_date", { ascending: false })
 .limit(limit);

 if (mvError) console.error("[PetTimeline] Error fetching medical visits:", mvError);

 // Convert medical visits to timeline moments format
 const visitMoments: TimelineMoment[] = (medicalVisits || []).map((visit) => {
 const pet = pets.find(p => p.id === visit.pet_id);
 const petName = pet?.name ||"Pet";
 return {
 id: `visit-${visit.id}`,
 pet_id: visit.pet_id,
 title: `🏥 Vet Visit at ${visit.vet_name ||"Veterinary Clinic"}`,
 narrative: `${petName} had a checkup${visit.doctor_name ? ` with ${visit.doctor_name}` :""} at ${visit.vet_name ||"the vet"}. Way to stay healthy! 💪`,
 emoji:"🏥",
 photo_url: null,
 merchant_name: visit.vet_name,
 merchant_category:"Vet",
 amount: null,
 pawbucks_earned: 0,
 moment_type:"medical_visit",
 mood:"brave",
 moment_date: visit.visit_date,
 created_at: visit.created_at,
 source:'medical_visit' as const,
 };
 });

 // Combine and sort all moments by date
 const allMoments = [
 ...(transactionMoments || []).map(m => ({ ...m, source:'transaction' as const })),
 ...visitMoments,
 ].sort((a, b) => new Date(b.moment_date).getTime() - new Date(a.moment_date).getTime())
 .slice(0, limit);

 setMoments(allMoments);
 } catch (error) {
 console.error("[PetTimeline] Error fetching moments:", error);
 } finally {
 setLoading(false);
 }
 };

 fetchMoments();

 // Subscribe to realtime updates for transaction moments
 const channel = supabase
 .channel("pet-timeline-updates")
 .on(
"postgres_changes",
 {
 event:"INSERT",
 schema:"public",
 table:"pet_timeline_moments",
 filter: `user_id=eq.${userId}`,
 },
 (payload) => {
 console.log("[PetTimeline] New moment:", payload.new);
 setMoments((prev) => [payload.new as TimelineMoment, ...prev].slice(0, limit));
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [userId, pets, limit]);

 const getPetName = (petId: string): string => {
 const pet = pets.find(p => p.id === petId);
 return pet?.name ||"Your Pet";
 };

 const handlePhotoClick = (url: string) => {
 setLightboxPhoto(url);
 setLightboxOpen(true);
 };

 if (loading) {
 return (
 <Card className="overflow-hidden">
 {showHeader && (
 <CardHeader className="pb-3">
 <Skeleton className="h-6 w-48" />
 </CardHeader>
 )}
 <CardContent>
 <TimelineSkeleton count={compact ? 2 : 3} />
 </CardContent>
 </Card>
 );
 }

 return (
 <>
  <Card className="w-full max-w-full min-w-0 overflow-hidden border-2 border-primary/10 bg-gradient-to-br from-background via-background to-primary/5">
 {showHeader && (
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
 <Sparkles className="w-5 h-5 text-white" />
 </div>
 <div>
 <CardTitle className="text-lg">✨ Your Pet's Story, Unlocked</CardTitle>
 <p className="text-xs text-muted-foreground">
 Every dollar spent becomes a memory
 </p>
 </div>
 </div>
 {onViewAll && moments.length > 0 && (
 <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1">
 View All
 <ChevronRight className="w-4 h-4" />
 </Button>
 )}
 </div>
 </CardHeader>
 )}
 
  <CardContent className={showHeader ?"p-3 pt-2 sm:p-6 sm:pt-2" :"p-2 sm:p-4 md:p-6"}>
 {moments.length === 0 ? (
 <EmptyTimeline petName={pets[0]?.name} />
 ) : (
   <ScrollArea className={compact ?"max-h-[300px] w-full max-w-full min-w-0 overflow-hidden" :"max-h-[calc(100dvh-280px)] w-full max-w-full min-w-0 overflow-hidden sm:max-h-[500px]"}>
  <div className="box-border w-full max-w-full min-w-0 space-y-4 overflow-hidden pr-0 sm:pr-2">
 <AnimatePresence>
 {moments.map((moment, index) => (
 <MomentCard
 key={moment.id}
 moment={moment}
 petName={getPetName(moment.pet_id)}
 index={index}
 compact={compact}
 onPhotoClick={handlePhotoClick}
 />
 ))}
 </AnimatePresence>
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>

 <PhotoLightbox
 photos={lightboxPhoto ? [lightboxPhoto] : []}
 open={lightboxOpen}
 onOpenChange={setLightboxOpen}
 />
 </>
 );
};

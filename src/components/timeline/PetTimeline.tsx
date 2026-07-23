import { useState, useEffect } from"react";
import { motion, AnimatePresence } from"framer-motion";
import { supabase } from"@/integrations/supabase/client";
import { format, isToday, isYesterday, isThisWeek } from"date-fns";
import { Bone, ChevronRight, HeartPulse, MapPin, PawPrint, Smile } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Badge } from"@/components/ui/badge";
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

const moodAccentClasses: Record<string, string> = {
 happy:"border-warning/40 bg-warning/10 text-warning",
 proud:"border-accent/40 bg-accent/10 text-accent",
 cozy:"border-info/40 bg-info/10 text-info",
 adventurous:"border-success/40 bg-success/10 text-success",
 brave:"border-destructive/40 bg-destructive/10 text-destructive",
 playful:"border-accent/40 bg-accent/10 text-accent",
};

const getMomentIcon = (moment: TimelineMoment) => {
 if (moment.source === "medical_visit" || moment.source === "medical_record" || moment.moment_type === "medical_visit") return HeartPulse;
 if (moment.moment_type === "food" || moment.merchant_category?.toLowerCase().includes("food")) return Bone;
 if (moment.source === "transaction") return PawPrint;
 return Smile;
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
 const accentClass = moodAccentClasses[moment.mood] || moodAccentClasses.happy;
 const photoUrl = moment.photo_url;
 const Icon = getMomentIcon(moment);

 return (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
 className="relative w-full max-w-full min-w-0 overflow-visible"
 >
 {/* Timeline connector */}
 {!compact && (
  <div className="absolute bottom-[-1.5rem] left-5 top-12 w-px bg-border" />
 )}
 
   <div className={`flex w-full max-w-full min-w-0 gap-3 ${compact ?'overflow-hidden' :'items-start overflow-visible'}`}>
 {/* Timeline dot */}
 {!compact && (
   <div className="relative z-10 mt-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm">
   <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${accentClass}`}>
  <Icon className="h-4 w-4" aria-hidden="true" />
 </div>
 </div>
 )}
 
    <Card className={`w-full flex-1 min-w-0 overflow-hidden border bg-card shadow-sm ${compact ?'max-w-full' :'max-w-[calc(100%-3.25rem)] rounded-2xl'}`}>
    <CardContent className={compact ?"p-3" :"p-4 sm:p-5"}>
    <div className={`flex w-full max-w-full min-w-0 gap-3 overflow-hidden ${compact ?'' :'flex-col'}`}>
 {/* Photo */}
  {photoUrl && (
 <motion.div 
  whileHover={compact ? { scale: 1.02 } : undefined}
    className={`${compact ?'h-16 w-16' :'aspect-[16/9] w-full'} max-w-full overflow-hidden rounded-xl flex-shrink-0 cursor-pointer bg-muted`}
  onClick={() => onPhotoClick?.(photoUrl)}
 >
 <img 
  src={photoUrl} 
 alt={moment.title}
  className="h-full w-full object-cover"
 />
 </motion.div>
 )}
 
  <div className="flex-1 min-w-0 max-w-full overflow-hidden break-words">
   <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
 {compact && <span className="text-lg">{moment.emoji}</span>}
    <h4 className={`min-w-0 flex-1 font-semibold tracking-normal ${compact ?'truncate text-sm' :'break-words text-base leading-snug sm:text-lg'}`}>
 {moment.title}
 </h4>
 </div>
   <Badge variant="outline" className="flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-medium sm:text-xs">
 {formatMomentDate(moment.moment_date)}
 </Badge>
 </div>
 
    <p className={`mb-3 max-w-full whitespace-pre-wrap break-words leading-relaxed text-muted-foreground ${compact ?'line-clamp-2 text-xs' :'text-base'}`}>
 {moment.narrative}
 </p>
 
   <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 overflow-hidden text-sm sm:gap-3">
 {moment.amount && (
   <span className="min-w-0 max-w-full truncate text-muted-foreground">
 {Formatters.currency(moment.amount)}
 </span>
 )}
 {moment.pawbucks_earned > 0 && (
   <Badge className="max-w-full min-w-0 gap-1 overflow-hidden rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
  <PawBucksLogo className="h-3 w-3" />
  <span className="truncate">+{moment.pawbucks_earned.toLocaleString()} PawBucks</span>
 </Badge>
 )}
 {moment.merchant_name && !compact && (
   <span className="flex min-w-0 max-w-full items-center gap-1 truncate text-muted-foreground">
  <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
  <span className="truncate">{moment.merchant_name}</span>
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
 className="px-4 py-10 text-center"
 >
 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
 <Sparkles className="h-8 w-8 text-primary" />
 </div>
 <h3 className="font-semibold text-lg mb-2">
 {petName ? `${petName}'s Story Awaits` :"Your Pet's Story Awaits"}
 </h3>
 <p className="mx-auto max-w-xs text-sm text-muted-foreground">
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
  <Card className="w-full max-w-full min-w-0 overflow-visible border-0 bg-transparent shadow-none">
 {showHeader && (
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <Sparkles className="h-5 w-5 text-primary" />
 </div>
 <div>
 <CardTitle className="text-lg">Your Pet's Story</CardTitle>
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
 
  <CardContent className={showHeader ?"p-0 pt-2" :"p-0"}>
 {moments.length === 0 ? (
 <EmptyTimeline petName={pets[0]?.name} />
 ) : compact ? (
  <ScrollArea className="max-h-[300px] w-full max-w-full min-w-0 overflow-hidden">
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
 ) : (
  <div className="box-border w-full max-w-full min-w-0 space-y-5 overflow-visible pb-6">
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

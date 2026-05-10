import { useState, useCallback, useMemo, memo } from"react";
import { motion } from"framer-motion";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { FileHeart, Pencil, Trash2, IdCard } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from"@/components/ui/alert-dialog";
import { petsService } from"@/services/api/pets.service";
import { toast } from"@/hooks/use-toast";
import { useNavigate } from"react-router-dom";
import { EditPetProfileDialog } from"./EditPetProfileDialog";
import { usePetPersonality } from"@/hooks/usePersonalityBadges";
import { transformPersonalityName } from"@/components/personality-quiz/personalityNameUtils";

type PetProfile = {
 id: string;
 name: string;
 type:"dog" |"cat" |"other";
 breed?: string;
 birthday?: string;
 photo_url?: string;
 color_markings?: string;
 size?: string;
 gender?: string;
 age_estimate?: string;
 microchip_number?: string;
 collar_description?: string;
 identifying_features?: string;
 personality_type?: string | null;
 personality_quiz_completed?: boolean | null;
};

type PetProfileCardProps = {
 pet: PetProfile;
 onUpdate?: () => void;
 index?: number;
};

const petTypeColors = {
 dog:"bg-info/10 text-info border-info/20",
 cat:"bg-accent/10 text-accent border-accent/20",
 other:"bg-muted/10 text-foreground border-border0/20",
} as const;

const PetProfileCardComponent = ({ pet, onUpdate, index = 0 }: PetProfileCardProps) => {
 const navigate = useNavigate();
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [deleting, setDeleting] = useState(false);
 
 // Fetch personality data
 const { data: personalityData } = usePetPersonality(pet.id);
 
 // Transform personality name to match pet type (e.g.,"Guard Dog" →"Guard Cat")
 const displayPersonalityName = useMemo(
 () => personalityData?.name ? transformPersonalityName(personalityData.name, pet.type) : null,
 [personalityData?.name, pet.type]
 );

 // Memoize age calculation
 const age = useMemo(() => {
 if (!pet.birthday) return null;
 return Math.floor(
 (new Date().getTime() - new Date(pet.birthday).getTime()) /
 (365.25 * 24 * 60 * 60 * 1000)
 );
 }, [pet.birthday]);

 // Memoize pet type label
 const petTypeLabel = useMemo(() => 
 pet.type.charAt(0).toUpperCase() + pet.type.slice(1), 
 [pet.type]
 );

 // Memoize handlers
 const handleEditClick = useCallback(() => setEditDialogOpen(true), []);
 const handleHealthClick = useCallback(() => navigate(`/pet-health/${pet.id}`), [navigate, pet.id]);
 const handleIdClick = useCallback(() => navigate(`/pet-id/${pet.id}`), [navigate, pet.id]);
 const handleQuizClick = useCallback(() => navigate(`/pet-personality-quiz?petId=${pet.id}`), [navigate, pet.id]);
 const handleEditSuccess = useCallback(() => onUpdate?.(), [onUpdate]);
 const handleDialogChange = useCallback((open: boolean) => setEditDialogOpen(open), []);

 const handleDelete = useCallback(async () => {
 setDeleting(true);
 const { error } = await petsService.delete(pet.id);
 setDeleting(false);
 if (error) {
 toast({ title:"Error", description:"Failed to delete pet profile.", variant:"destructive" });
 } else {
 toast({ title:"Pet removed", description: `${pet.name} has been removed from your profile.` });
 onUpdate?.();
 }
 }, [pet.id, pet.name, onUpdate]);

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ 
 delay: index * 0.1, 
 duration: 0.4,
 ease:"easeOut"
 }}
 >
 <GradientCard gradient className="p-4">
 <div className="flex items-center gap-4">
 {/* Pet Photo */}
 {pet.photo_url ? (
 <img
 src={pet.photo_url}
 alt={pet.name}
 width={64}
 height={64}
 className="w-16 h-16 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
 loading="lazy"
 />
 ) : (
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
 <span className="w-8 h-8 text-muted-foreground" aria-hidden="true">🐾</span>
 </div>
 )}

 {/* Pet Info - Stacked Vertically */}
 <div className="flex-1 min-w-0 space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <Badge
 variant="outline"
 className={`${petTypeColors[pet.type]} text-xs`}
 >
 {petTypeLabel}
 </Badge>
 {personalityData && displayPersonalityName ? (
 <Badge
 variant="secondary"
 className="text-xs font-medium"
 style={{
 backgroundColor: `${personalityData.color_primary}20`,
 color: personalityData.color_primary,
 }}
 >
 {personalityData.emoji} {displayPersonalityName}
 </Badge>
 ) : (
 <Button
 variant="ghost"
 size="sm"
 onClick={handleQuizClick}
 className="text-xs h-5 px-2 text-primary hover:text-primary/80"
 >
 <Sparkles className="w-3 h-3 mr-1" />
 Take Quiz
 </Button>
 )}
 </div>
 <h3 className="text-lg font-bold leading-tight">{pet.name}</h3>
 {pet.breed && (
 <p className="text-sm text-muted-foreground">{pet.breed}</p>
 )}
 {age !== null && (
 <p className="text-sm text-muted-foreground flex items-center gap-1">
 <span className="w-3 h-3" aria-hidden="true">📅</span>
 {age} {age === 1 ?"year" :"years"} old
 </p>
 )}
 </div>

 {/* Action Buttons */}
 <div className="flex flex-col gap-2 flex-shrink-0">
 <Button
 variant="outline"
 size="icon"
 className="h-9 w-9"
 onClick={handleEditClick}
 >
 <Pencil className="w-4 h-4" />
 </Button>
 <Button
 variant="outline"
 size="icon"
 className="h-9 w-9"
 onClick={handleHealthClick}
 title="Health records"
 >
 <FileHeart className="w-4 h-4" />
 </Button>
 <Button
 variant="outline"
 size="icon"
 className="h-9 w-9 border-primary/40 text-primary"
 onClick={handleIdClick}
 title="Digital Pet ID"
 >
 <IdCard className="w-4 h-4" />
 </Button>
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="outline"
 size="icon"
 className="h-9 w-9 text-destructive hover:text-destructive"
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete {pet.name}?</AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently remove {pet.name}'s profile, including all medical records and associated data. This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={handleDelete}
 disabled={deleting}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 {deleting ?"Deleting…" :"Delete"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 </div>
 </GradientCard>
 
 <EditPetProfileDialog
 pet={pet}
 open={editDialogOpen}
 onOpenChange={handleDialogChange}
 onSuccess={handleEditSuccess}
 />
 </motion.div>
 );
};

export const PetProfileCard = memo(PetProfileCardComponent);
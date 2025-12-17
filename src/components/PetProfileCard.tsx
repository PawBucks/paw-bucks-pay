import { useState, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, PawPrint, FileHeart, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditPetProfileDialog } from "./EditPetProfileDialog";

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
};

type PetProfileCardProps = {
  pet: PetProfile;
  onUpdate?: () => void;
  index?: number;
};

const petTypeColors = {
  dog: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  cat: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  other: "bg-gray-500/10 text-gray-700 border-gray-500/20",
} as const;

const PetProfileCardComponent = ({ pet, onUpdate, index = 0 }: PetProfileCardProps) => {
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
  const handleEditSuccess = useCallback(() => onUpdate?.(), [onUpdate]);
  const handleDialogChange = useCallback((open: boolean) => setEditDialogOpen(open), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.1, 
        duration: 0.4,
        ease: "easeOut"
      }}
    >
      <GradientCard gradient className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          {/* Pet Photo - Larger on desktop */}
          <div className="flex items-center gap-4 md:gap-0">
            {pet.photo_url ? (
              <img
                src={pet.photo_url}
                alt={pet.name}
                width={96}
                height={96}
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-primary/20 flex-shrink-0 shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 shadow-md">
                <PawPrint className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
              </div>
            )}
            
            {/* Mobile: Info next to photo */}
            <div className="flex-1 min-w-0 md:hidden">
              <Badge
                variant="outline"
                className={`${petTypeColors[pet.type]} text-xs mb-1`}
              >
                {petTypeLabel}
              </Badge>
              <h3 className="text-lg font-bold leading-tight truncate">{pet.name}</h3>
              {pet.breed && (
                <p className="text-sm text-muted-foreground truncate">{pet.breed}</p>
              )}
            </div>
          </div>

          {/* Desktop: Pet Info - More spacious */}
          <div className="hidden md:flex flex-1 min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`${petTypeColors[pet.type]} text-sm px-3 py-1`}
              >
                {petTypeLabel}
              </Badge>
              {age !== null && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {age} {age === 1 ? "year" : "years"} old
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold leading-tight">{pet.name}</h3>
            {pet.breed && (
              <p className="text-base text-muted-foreground">{pet.breed}</p>
            )}
          </div>

          {/* Mobile: Age below */}
          {age !== null && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 md:hidden -mt-2">
              <Calendar className="w-4 h-4" />
              {age} {age === 1 ? "year" : "years"} old
            </p>
          )}

          {/* Action Buttons - Horizontal on desktop */}
          <div className="flex gap-2 md:flex-col md:gap-3 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none md:w-auto gap-2"
              onClick={handleEditClick}
            >
              <Pencil className="w-4 h-4" />
              <span className="md:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none md:w-auto gap-2"
              onClick={handleHealthClick}
            >
              <FileHeart className="w-4 h-4" />
              <span className="md:inline">Health</span>
            </Button>
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
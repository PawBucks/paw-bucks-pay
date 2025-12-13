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
    <GradientCard gradient className="flex items-start gap-4 p-4">
      {pet.photo_url ? (
        <img
          src={pet.photo_url}
          alt={pet.name}
          width={80}
          height={80}
          className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <PawPrint className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold mb-2 truncate">{pet.name}</h3>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${petTypeColors[pet.type]} flex-shrink-0`}
                >
                  {petTypeLabel}
                </Badge>
                {pet.breed && (
                  <span className="text-sm text-muted-foreground truncate">{pet.breed}</span>
                )}
              </div>
              {age !== null && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  {age} {age === 1 ? "year" : "years"} old
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditClick}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHealthClick}
            >
              <FileHeart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      <EditPetProfileDialog
        pet={pet}
        open={editDialogOpen}
        onOpenChange={handleDialogChange}
        onSuccess={handleEditSuccess}
      />
      </GradientCard>
    </motion.div>
  );
};

export const PetProfileCard = memo(PetProfileCardComponent);
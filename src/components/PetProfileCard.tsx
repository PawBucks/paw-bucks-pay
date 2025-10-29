import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, PawPrint, FileHeart } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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
};

export const PetProfileCard = ({ pet }: PetProfileCardProps) => {
  const navigate = useNavigate();
  const petTypeColors = {
    dog: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    cat: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    other: "bg-gray-500/10 text-gray-700 border-gray-500/20",
  };

  const age = pet.birthday
    ? Math.floor(
        (new Date().getTime() - new Date(pet.birthday).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <GradientCard gradient className="flex items-center gap-4">
      {pet.photo_url ? (
        <img
          src={pet.photo_url}
          alt={pet.name}
          className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
        />
      ) : (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <PawPrint className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1">
        <h3 className="text-xl font-bold mb-1">{pet.name}</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge
            variant="outline"
            className={petTypeColors[pet.type]}
          >
            {pet.type.charAt(0).toUpperCase() + pet.type.slice(1)}
          </Badge>
          {pet.breed && (
            <span className="text-sm text-muted-foreground">{pet.breed}</span>
          )}
          {age !== null && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {age} {age === 1 ? "year" : "years"} old
            </span>
          )}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/pet-health/${pet.id}`)}
        className="flex-shrink-0"
      >
        <FileHeart className="w-4 h-4 mr-2" />
        Health Records
      </Button>
    </GradientCard>
  );
};
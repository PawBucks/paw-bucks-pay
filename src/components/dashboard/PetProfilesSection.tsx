import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { PetProfileCard } from "@/components/PetProfileCard";
import { Plus } from "lucide-react";

type Pet = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
};

type PetProfilesSectionProps = {
  pets: Pet[];
};

export const PetProfilesSection = memo(({ pets, onUpdate }: PetProfilesSectionProps & { onUpdate?: () => void }) => {
  const navigate = useNavigate();

  return (
    <GradientCard className="md:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">My Pets</h3>
        <Button onClick={() => navigate("/create-pet-profile")} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Pet
        </Button>
      </div>
      {pets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {pets.map((pet, index) => (
            <PetProfileCard key={pet.id} pet={pet} onUpdate={onUpdate} index={index} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            You haven't added any pets yet
          </p>
          <Button onClick={() => navigate("/create-pet-profile")}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Pet
          </Button>
        </div>
      )}
    </GradientCard>
  );
});

PetProfilesSection.displayName = "PetProfilesSection";

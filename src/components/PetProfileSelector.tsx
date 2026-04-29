import { useQuery } from"@tanstack/react-query";
import { petsService } from"@/services/api/pets.service";
import { Button } from"@/components/ui/button";
import { Card, CardContent } from"@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import { Badge } from"@/components/ui/badge";
import { Dog, Cat, Bird, Rabbit, PawPrint, Sparkles, ChevronRight } from"lucide-react";
import { Tables } from"@/integrations/supabase/types";

type PetProfile = Tables<"pet_profiles">;

interface PetProfileSelectorProps {
 userId: string;
 onSelect: (pet: PetProfile) => void;
 onSkip: () => void;
}

const petTypeIcons: Record<string, React.ReactNode> = {
 dog: <Dog className="w-5 h-5" />,
 cat: <Cat className="w-5 h-5" />,
 bird: <Bird className="w-5 h-5" />,
 rabbit: <Rabbit className="w-5 h-5" />,
 other: <PawPrint className="w-5 h-5" />,
};

export const PetProfileSelector = ({ userId, onSelect, onSkip }: PetProfileSelectorProps) => {
 const { data: petProfiles, isLoading } = useQuery({
 queryKey: ["pet-profiles", userId],
 queryFn: async () => {
 const result = await petsService.getByUserId(userId);
 if (result.error) throw result.error;
 return result.data;
 },
 enabled: !!userId,
 });

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 );
 }

 if (!petProfiles || petProfiles.length === 0) {
 return (
 <div className="text-center py-6 space-y-4">
 <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
 <PawPrint className="w-8 h-8 text-muted-foreground" />
 </div>
 <div>
 <p className="font-medium">No pet profiles found</p>
 <p className="text-sm text-muted-foreground">
 You'll need to enter your pet's details manually.
 </p>
 </div>
 <Button onClick={onSkip} variant="outline" className="mt-4">
 Continue Manually
 </Button>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-primary">
 <Sparkles className="w-5 h-5" />
 <span className="font-semibold">One-Click Flyer</span>
 </div>
 
 <p className="text-sm text-muted-foreground">
 Select a pet profile to auto-fill the flyer with their photo and details.
 </p>
 
 <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-1">
 {petProfiles.map((pet) => (
 <Card 
 key={pet.id} 
 className="cursor-pointer hover:border-primary transition-colors group"
 onClick={() => onSelect(pet)}
 >
 <CardContent className="p-3 flex items-center gap-3">
 <Avatar className="h-14 w-14 border-2 border-muted">
 <AvatarImage src={pet.photo_url || undefined} alt={pet.name} />
 <AvatarFallback className="bg-primary/10">
 {petTypeIcons[pet.type] || <PawPrint className="w-6 h-6" />}
 </AvatarFallback>
 </Avatar>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-semibold truncate">{pet.name}</span>
 <Badge variant="secondary" className="text-xs capitalize">
 {pet.type}
 </Badge>
 </div>
 {pet.breed && (
 <p className="text-sm text-muted-foreground truncate">{pet.breed}</p>
 )}
 </div>
 
 <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
 </CardContent>
 </Card>
 ))}
 </div>
 
 <Button 
 variant="ghost" 
 onClick={onSkip} 
 className="w-full text-muted-foreground"
 >
 Or enter details manually
 </Button>
 </div>
 );
};

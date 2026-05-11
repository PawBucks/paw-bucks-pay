import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { Weight } from "lucide-react";

type Pet = {
 id: string;
 name: string;
 species?: string | null;
 breed: string | null;
 age?: number | null;
 weight?: number | null;
 gender: string | null;
 photo_url: string | null;
 created_at: string;
 medical_conditions?: string | null;
 allergies?: string | null;
 microchip_number?: string | null;
};

type InsurancePolicy = {
 id: string;
 provider_name?: string | null;
 policy_number?: string | null;
 status?: string | null;
 coverage_type: string | null;
 effective_date?: string | null;
 expiration_date?: string | null;
 pet_id: string;
};

export function UserDetailPets({ userId }: { userId: string }) {
 const [pets, setPets] = useState<Pet[]>([]);
 const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 loadData();
 }, [userId]);

 const loadData = async () => {
 setLoading(true);
 try {
 const petsRes = await supabase.from("pet_profiles").select("id, name, breed, gender, photo_url, created_at, microchip_number").eq("user_id", userId).order("created_at", { ascending: false });
 const policiesRes = await (supabase.from("pet_insurance_policies") as any).select("id, provider_name, policy_number, coverage_type, effective_date, expiration_date, pet_id, status").eq("owner_id", userId);

 if (petsRes.data) setPets(petsRes.data as unknown as Pet[]);
 if (policiesRes.data) setPolicies(policiesRes.data as unknown as InsurancePolicy[]);
 } catch (err) {
 console.error("Failed to load pets:", err);
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return <Card><CardContent className="py-8"><Skeleton className="h-40 w-full" /></CardContent></Card>;
 }

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <PawBucksLogo className="w-5 h-5" /> Pet Profiles ({pets.length})
 </CardTitle>
 </CardHeader>
 <CardContent>
 {pets.length === 0 ? (
 <p className="text-center text-muted-foreground py-6">No pets registered.</p>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {pets.map(pet => (
 <Card key={pet.id} className="border shadow-sm">
 <CardContent className="pt-4 space-y-3">
 <div className="flex items-center gap-3">
 {pet.photo_url ? (
 <img src={pet.photo_url} alt={pet.name} className="w-12 h-12 rounded-full object-cover" />
 ) : (
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
 <PawBucksLogo className="w-6 h-6 text-primary" />
 </div>
 )}
 <div>
 <p className="font-semibold">{pet.name}</p>
 <p className="text-sm text-muted-foreground">
 {pet.species ||""}{pet.breed ? ` · ${pet.breed}` :""}
 </p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2 text-sm">
 {pet.age != null && (
 <div className="flex items-center gap-1 text-muted-foreground">
 <span className="w-3 h-3" aria-hidden="true">📅</span> {pet.age} years
 </div>
 )}
 {pet.weight != null && (
 <div className="flex items-center gap-1 text-muted-foreground">
 <Weight className="w-3 h-3" /> {pet.weight} lbs
 </div>
 )}
 {pet.gender && (
 <div className="text-muted-foreground">{pet.gender}</div>
 )}
 {pet.microchip_number && (
 <div className="text-muted-foreground text-xs">Chip: {pet.microchip_number}</div>
 )}
 </div>
 {(pet.medical_conditions || pet.allergies) && (
 <div className="border-t pt-2 space-y-1">
 {pet.medical_conditions && (
 <div className="flex items-start gap-1 text-sm">
 <span className="w-3 h-3 mt-0.5 text-destructive" aria-hidden="true">❤️</span>
 <span>{pet.medical_conditions}</span>
 </div>
 )}
 {pet.allergies && (
 <div className="text-sm text-muted-foreground">Allergies: {pet.allergies}</div>
 )}
 </div>
 )}
 <p className="text-xs text-muted-foreground">Added {new Date(pet.created_at).toLocaleDateString()}</p>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {policies.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle>Insurance Policies ({policies.length})</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {policies.map(policy => (
 <div key={policy.id} className="flex items-center justify-between border rounded-lg p-3">
 <div>
 <p className="font-medium">{policy.provider_name ||"Unknown Provider"}</p>
 <p className="text-sm text-muted-foreground">#{policy.policy_number ||"N/A"} {policy.coverage_type && `· ${policy.coverage_type}`}</p>
 {policy.effective_date && (
 <p className="text-xs text-muted-foreground">
 {new Date(policy.effective_date).toLocaleDateString()} — {policy.expiration_date ? new Date(policy.expiration_date).toLocaleDateString() :"Ongoing"}
 </p>
 )}
 </div>
 <Badge variant={policy.status ==="active" ?"default" :"secondary"}>{policy.status ||"unknown"}</Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}

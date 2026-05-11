import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { petsService } from"@/services/api/pets.service";
import type { Database } from"@/integrations/supabase/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { toast } from"sonner";
import { Upload, Loader2 } from "lucide-react";

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
};

type EditPetProfileDialogProps = {
 pet: PetProfile;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSuccess: () => void;
};

export const EditPetProfileDialog = ({ pet, open, onOpenChange, onSuccess }: EditPetProfileDialogProps) => {
 const [isLoading, setIsLoading] = useState(false);
 const [photoFile, setPhotoFile] = useState<File | null>(null);
 const [photoPreview, setPhotoPreview] = useState<string>(pet.photo_url ||"");
 
 const [formData, setFormData] = useState({
 name: pet.name,
 type: pet.type,
 breed: pet.breed ||"",
 birthday: pet.birthday ||"",
 color_markings: pet.color_markings ||"",
 size: pet.size ||"",
 gender: pet.gender ||"",
 age_estimate: pet.age_estimate ||"",
 microchip_number: pet.microchip_number ||"",
 collar_description: pet.collar_description ||"",
 identifying_features: pet.identifying_features ||"",
 });

 useEffect(() => {
 // Reset form when pet changes
 setFormData({
 name: pet.name,
 type: pet.type,
 breed: pet.breed ||"",
 birthday: pet.birthday ||"",
 color_markings: pet.color_markings ||"",
 size: pet.size ||"",
 gender: pet.gender ||"",
 age_estimate: pet.age_estimate ||"",
 microchip_number: pet.microchip_number ||"",
 collar_description: pet.collar_description ||"",
 identifying_features: pet.identifying_features ||"",
 });
 setPhotoPreview(pet.photo_url ||"");
 setPhotoFile(null);
 }, [pet]);

 const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 setPhotoFile(file);
 const reader = new FileReader();
 reader.onloadend = () => {
 setPhotoPreview(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 setIsLoading(true);

 try {
 let photoUrl = pet.photo_url;

 // Upload new photo if provided
 if (photoFile) {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("User not authenticated");

 const fileExt = photoFile.name.split(".").pop();
 const fileName = `${user.id}/${Date.now()}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from("pet-photos")
 .upload(fileName, photoFile);

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from("pet-photos")
 .getPublicUrl(fileName);
 
 photoUrl = publicUrl;
 }

 // Update pet profile with all fields using service layer
 const { data: updatedPet, error: updateError } = await petsService.update(pet.id, {
 name: formData.name,
 type: formData.type as Database["public"]["Enums"]["pet_type"],
 breed: formData.breed || null,
 birthday: formData.birthday || null,
 photo_url: photoUrl || null,
 color_markings: formData.color_markings || null,
 size: formData.size || null,
 gender: formData.gender || null,
 age_estimate: formData.age_estimate || null,
 microchip_number: formData.microchip_number || null,
 collar_description: formData.collar_description || null,
 identifying_features: formData.identifying_features || null,
 });

 if (updateError) throw updateError;
 
 if (!updatedPet) {
 throw new Error("Failed to save pet profile - no data returned");
 }

 toast.success("Pet profile updated successfully!");
 onSuccess();
 onOpenChange(false);
 } catch (error: any) {
 console.error("Error updating pet profile:", error);
 toast.error(error.message ||"Failed to update pet profile");
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Edit Pet Profile</DialogTitle>
 <DialogDescription>Update your pet's information</DialogDescription>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Photo Upload */}
 <div className="space-y-2">
 <Label>Pet Photo</Label>
 <div className="flex flex-col items-center gap-4">
 {photoPreview ? (
 <img
 src={photoPreview}
 alt="Pet preview"
 width={128}
 height={128}
 className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
 />
 ) : (
 <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
 <PawBucksLogo className="w-8 h-8 text-muted-foreground" />
 </div>
 )}
 <Input
 type="file"
 accept="image/*"
 onChange={handlePhotoChange}
 className="cursor-pointer max-w-xs"
 />
 </div>
 </div>

 {/* Pet Information Section */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Pet Information</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="name">Pet Name *</Label>
 <Input
 id="name"
 value={formData.name}
 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
 placeholder="Max, Bella, Luna..."
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="type">Pet Type *</Label>
 <Select 
 value={formData.type} 
 onValueChange={(value:"dog" |"cat" |"other") => setFormData(prev => ({ ...prev, type: value }))}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select pet type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="dog">Dog</SelectItem>
 <SelectItem value="cat">Cat</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="breed">Breed</Label>
 <Input
 id="breed"
 value={formData.breed}
 onChange={(e) => setFormData(prev => ({ ...prev, breed: e.target.value }))}
 placeholder="Golden Retriever, Persian, etc."
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="color_markings">Color/Markings</Label>
 <Input
 id="color_markings"
 value={formData.color_markings}
 onChange={(e) => setFormData(prev => ({ ...prev, color_markings: e.target.value }))}
 placeholder="e.g., Golden with white chest"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="size">Size</Label>
 <Select 
 value={formData.size} 
 onValueChange={(value) => setFormData(prev => ({ ...prev, size: value }))}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select size" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="small">Small</SelectItem>
 <SelectItem value="medium">Medium</SelectItem>
 <SelectItem value="large">Large</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="gender">Gender</Label>
 <Select 
 value={formData.gender} 
 onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select gender" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="male">Male</SelectItem>
 <SelectItem value="female">Female</SelectItem>
 <SelectItem value="unknown">Unknown</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="birthday">Birthday</Label>
 <Input
 id="birthday"
 type="date"
 value={formData.birthday}
 onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
 max={new Date().toISOString().split("T")[0]}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="age_estimate">Age Estimate</Label>
 <Input
 id="age_estimate"
 value={formData.age_estimate}
 onChange={(e) => setFormData(prev => ({ ...prev, age_estimate: e.target.value }))}
 placeholder="e.g., 3 years old"
 />
 </div>
 </div>
 </div>

 {/* Identification Section */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Identification</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="microchip_number">Microchip Number</Label>
 <Input
 id="microchip_number"
 value={formData.microchip_number}
 onChange={(e) => setFormData(prev => ({ ...prev, microchip_number: e.target.value }))}
 placeholder="If registered"
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="collar_description">Collar Description</Label>
 <Input
 id="collar_description"
 value={formData.collar_description}
 onChange={(e) => setFormData(prev => ({ ...prev, collar_description: e.target.value }))}
 placeholder="e.g., Red collar with bone tag"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="identifying_features">Unique Identifying Features</Label>
 <Textarea
 id="identifying_features"
 value={formData.identifying_features}
 onChange={(e) => setFormData(prev => ({ ...prev, identifying_features: e.target.value }))}
 placeholder="e.g., Scar on left ear, limps slightly"
 rows={2}
 />
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 className="flex-1"
 disabled={isLoading}
 >
 Cancel
 </Button>
 <Button type="submit" className="flex-1" disabled={isLoading}>
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Updating...
 </>
 ) : (
"Save Changes"
 )}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 );
};
import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { petsService } from"@/services/api/pets.service";
import { invalidatePetCache } from"@/lib/userAccessCache";
import type { Database } from"@/integrations/supabase/types";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { toast } from"sonner";
import { Upload, Loader2 } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { PawBucksLogo } from "@/components/PawBucksLogo";

const CreatePetProfile = () => {
 const navigate = useNavigate();
 const { user, loading: authLoading } = useAuth();
 const [isLoading, setIsLoading] = useState(false);
 const [photoFile, setPhotoFile] = useState<File | null>(null);
 const [photoPreview, setPhotoPreview] = useState<string>("");
 
 // Form state
 const [formData, setFormData] = useState({
 name:"",
 type:"dog" as"dog" |"cat" |"other",
 breed:"",
 birthday:"",
 color_markings:"",
 size:"",
 gender:"",
 age_estimate:"",
 microchip_number:"",
 collar_description:"",
 identifying_features:"",
 });

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

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
 if (!user) return;
 
 if (!formData.name.trim()) {
 toast.error("Please enter your pet's name");
 return;
 }
 
 setIsLoading(true);

 try {
 let photoUrl ="";

 // Upload photo if provided
 if (photoFile) {
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

 // Create pet profile with all fields using service layer
 const { data: newPet, error: profileError } = await petsService.create({
 user_id: user.id,
 name: formData.name.trim(),
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

 if (profileError) throw profileError;
 
 if (!newPet) {
 throw new Error("Failed to create pet profile - no data returned");
 }

 toast.success(`${formData.name}'s profile created! Now let's discover their personality! 🐾`);
 
 // Clear the pet onboarding cache so ProtectedRoute knows we have a pet now
 invalidatePetCache(user!.id);
 
 // Navigate to personality quiz with the new pet's ID
 navigate(`/pet-personality-quiz?petId=${newPet.id}`);
 } catch (error: any) {
 console.error("Error creating pet profile:", error);
 toast.error(error.message ||"Failed to create pet profile");
 } finally {
 setIsLoading(false);
 }
 };

 if (authLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[var(--gradient-hero)]">
 <Header />
 <div className="flex items-center justify-center p-4 py-8">
 <Card className="w-full max-w-2xl">
 <CardHeader className="text-center">
 <div className="flex justify-center mb-4">
 <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
 <PawBucksLogo className="w-8 h-8 text-primary-foreground" />
 </div>
 </div>
 <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
 <Sparkles className="w-6 h-6 text-primary" />
 Add Your Pet
 </CardTitle>
 <CardDescription>
 Tell us about your furry friend! This info can be used to quickly create lost pet flyers if needed.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Photo Upload */}
 <div className="space-y-2">
 <Label>Pet Photo</Label>
 <div className="flex flex-col items-center gap-4">
 {photoPreview ? (
 <img
 src={photoPreview}
 alt="Pet preview"
 className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
 />
 ) : (
 <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
 <Upload className="w-8 h-8 text-muted-foreground" />
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
 placeholder="e.g., Max, Bella, Luna"
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
 placeholder="e.g., Golden Retriever, Persian"
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
 placeholder="e.g., 3 years old, puppy"
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
 placeholder="e.g., Scar on left ear, limps slightly, distinctive markings"
 rows={2}
 />
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <Button type="submit" className="flex-1" disabled={isLoading}>
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Creating...
 </>
 ) : (
"Create Profile"
 )}
 </Button>
 </div>
 </form>
 </CardContent>
 </Card>
 </div>
 </div>
 );
};

export default CreatePetProfile;
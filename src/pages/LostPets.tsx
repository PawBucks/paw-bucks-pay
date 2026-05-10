import { useState, useCallback } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { Header } from"@/components/Header";
import { BottomNav } from"@/components/BottomNav";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from"@/components/ui/alert-dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { useToast } from"@/hooks/use-toast";
import { LoadingSpinner } from"@/components/LoadingSpinner";
import { SEO } from"@/components/SEO";
import { seoMeta } from"@/lib/seoMeta";
import { PlusCircle, Search, Phone, Dog, Cat, Bird, Rabbit, Upload, AlertTriangle, CheckCircle2, PartyPopper, Eye, X, Images, ArrowLeft } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { LostPetShareDialog } from"@/components/LostPetShareDialog";
import { PetProfileSelector } from"@/components/PetProfileSelector";
import { format } from"date-fns";
import { Tables } from"@/integrations/supabase/types";

type PetProfile = Tables<"pet_profiles">;

interface LostPetPost {
 id: string;
 user_id: string;
 pet_name: string;
 pet_type: string;
 breed: string | null;
 color_markings: string;
 size: string | null;
 age_estimate: string | null;
 gender: string | null;
 microchip_number: string | null;
 collar_description: string | null;
 identifying_features: string | null;
 photo_url: string | null;
 photo_urls: string[] | null;
 last_seen_location: string;
 last_seen_date: string;
 last_seen_time: string | null;
 last_seen_area_description: string | null;
 contact_name: string;
 contact_phone: string;
 contact_email: string | null;
 reward_amount: number | null;
 additional_notes: string | null;
 status: string;
 is_active: boolean;
 created_at: string;
}

const petTypeIcons: Record<string, React.ReactNode> = {
 dog: <span className="w-5 h-5" aria-hidden="true">🐕</span>,
 cat: <span className="w-5 h-5" aria-hidden="true">🐈</span>,
 bird: <Bird className="w-5 h-5" />,
 rabbit: <Rabbit className="w-5 h-5" />,
};

const statusColors: Record<string, string> = {
 lost:"bg-destructive text-destructive-foreground",
 found:"bg-secondary text-secondary-foreground",
 reunited:"bg-success text-white",
};

const statusIcons: Record<string, React.ReactNode> = {
 lost: <AlertTriangle className="w-4 h-4" />,
 found: <span className="w-4 h-4" aria-hidden="true">⏰</span>,
 reunited: <CheckCircle2 className="w-4 h-4" />,
};

const LostPets = () => {
  const { user, signOut } = useAuth();
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const navigate = useNavigate();
 const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");
 const [showPetSelector, setShowPetSelector] = useState(true);
 const [selectedPetProfile, setSelectedPetProfile] = useState<PetProfile | null>(null);
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [isUploading, setIsUploading] = useState(false);

 // Form state
 const [formData, setFormData] = useState({
 pet_name:"",
 pet_type:"dog",
 breed:"",
 color_markings:"",
 size:"",
 age_estimate:"",
 gender:"",
 microchip_number:"",
 collar_description:"",
 identifying_features:"",
 photo_url:"",
 photo_urls: [] as string[],
 last_seen_location:"",
 last_seen_date: format(new Date(),"yyyy-MM-dd"),
 last_seen_time:"",
 last_seen_area_description:"",
 contact_name:"",
 contact_phone:"",
 contact_email:"",
 reward_amount:"",
 additional_notes:"",
 });

 const MAX_PHOTOS = 5;
 // Fetch all active lost pet posts
 const { data: posts, isLoading } = useQuery({
 queryKey: ["lost-pet-posts", statusFilter],
 queryFn: async () => {
 let query = supabase
 .from("lost_pet_posts")
 .select("*")
 .eq("is_active", true)
 .order("created_at", { ascending: false });
 
 if (statusFilter !=="all") {
 query = query.eq("status", statusFilter);
 }
 
 const { data, error } = await query;
 if (error) throw error;
 return data as LostPetPost[];
 },
 });

 // Create new post mutation
 const createPostMutation = useMutation({
 mutationFn: async (data: typeof formData) => {
 if (!user) throw new Error("Must be logged in to create a post");
 
 const { error } = await supabase.from("lost_pet_posts").insert({
 user_id: user.id,
 pet_name: data.pet_name,
 pet_type: data.pet_type,
 breed: data.breed || null,
 color_markings: data.color_markings,
 size: data.size || null,
 age_estimate: data.age_estimate || null,
 gender: data.gender || null,
 microchip_number: data.microchip_number || null,
 collar_description: data.collar_description || null,
 identifying_features: data.identifying_features || null,
 photo_url: data.photo_urls[0] || data.photo_url || null,
 photo_urls: data.photo_urls.length > 0 ? data.photo_urls : null,
 last_seen_location: data.last_seen_location,
 last_seen_date: data.last_seen_date,
 last_seen_time: data.last_seen_time || null,
 last_seen_area_description: data.last_seen_area_description || null,
 contact_name: data.contact_name,
 contact_phone: data.contact_phone,
 contact_email: data.contact_email || null,
 reward_amount: data.reward_amount ? parseFloat(data.reward_amount) : null,
 additional_notes: data.additional_notes || null,
 });
 
 if (error) throw error;
 },
 onSuccess: () => {
 toast({ title:"Lost pet flyer created successfully!" });
 queryClient.invalidateQueries({ queryKey: ["lost-pet-posts"] });
 setIsCreateDialogOpen(false);
 resetForm();
 },
 onError: (error: Error) => {
 toast({ 
 title:"Failed to create flyer", 
 description: error.message,
 variant:"destructive" 
 });
 },
 });

 // Update status mutation
 const updateStatusMutation = useMutation({
 mutationFn: async ({ postId, newStatus }: { postId: string; newStatus: string }) => {
 const { error } = await supabase
 .from("lost_pet_posts")
 .update({ status: newStatus })
 .eq("id", postId);
 if (error) throw error;
 },
 onSuccess: (_, { newStatus }) => {
 toast({ 
 title: newStatus ==="reunited" 
 ?"Great news! Pet marked as reunited!" 
 : `Status updated to ${newStatus}` 
 });
 queryClient.invalidateQueries({ queryKey: ["lost-pet-posts"] });
 },
 onError: (error: Error) => {
 toast({
 title:"Failed to update status",
 description: error.message,
 variant:"destructive",
 });
 },
 });

 const resetForm = () => {
 setFormData({
 pet_name:"",
 pet_type:"dog",
 breed:"",
 color_markings:"",
 size:"",
 age_estimate:"",
 gender:"",
 microchip_number:"",
 collar_description:"",
 identifying_features:"",
 photo_url:"",
 photo_urls: [],
 last_seen_location:"",
 last_seen_date: format(new Date(),"yyyy-MM-dd"),
 last_seen_time:"",
 last_seen_area_description:"",
 contact_name:"",
 contact_phone:"",
 contact_email:"",
 reward_amount:"",
 additional_notes:"",
 });
 setSelectedPetProfile(null);
 setShowPetSelector(true);
 };

 const handlePetProfileSelect = (pet: PetProfile) => {
 // Auto-fill form with pet profile data including new identification fields
 setFormData(prev => ({
 ...prev,
 pet_name: pet.name,
 pet_type: pet.type,
 breed: pet.breed ||"",
 color_markings: pet.color_markings ||"",
 size: pet.size ||"",
 gender: pet.gender ||"",
 age_estimate: pet.age_estimate ||"",
 microchip_number: pet.microchip_number ||"",
 collar_description: pet.collar_description ||"",
 identifying_features: pet.identifying_features ||"",
 // If the pet has a photo, add it to photo_urls
 photo_urls: pet.photo_url ? [pet.photo_url] : [],
 photo_url: pet.photo_url ||"",
 }));
 setSelectedPetProfile(pet);
 setShowPetSelector(false);
 toast({ 
 title: `${pet.name}'s details loaded!`,
 description:"Fill in the remaining details about where they were last seen."
 });
 };

 const handleSkipPetSelector = () => {
 setShowPetSelector(false);
 };

 const handleBackToPetSelector = () => {
 setShowPetSelector(true);
 setSelectedPetProfile(null);
 };

 const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0 || !user) return;

 const currentCount = formData.photo_urls.length;
 const remainingSlots = MAX_PHOTOS - currentCount;
 
 if (remainingSlots <= 0) {
 toast({ 
 title: `Maximum ${MAX_PHOTOS} photos allowed`, 
 variant:"destructive" 
 });
 return;
 }

 const filesToUpload = Array.from(files).slice(0, remainingSlots);
 setIsUploading(true);
 
 try {
 const uploadPromises = filesToUpload.map(async (file) => {
 const fileExt = file.name.split('.').pop();
 const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from('lost-pet-photos')
 .upload(fileName, file);
 
 if (uploadError) throw uploadError;
 
 const { data: { publicUrl } } = supabase.storage
 .from('lost-pet-photos')
 .getPublicUrl(fileName);
 
 return publicUrl;
 });

 const uploadedUrls = await Promise.all(uploadPromises);
 
 setFormData(prev => ({ 
 ...prev, 
 photo_urls: [...prev.photo_urls, ...uploadedUrls],
 photo_url: prev.photo_urls.length === 0 ? uploadedUrls[0] : prev.photo_url
 }));
 toast({ title: `${uploadedUrls.length} photo(s) uploaded successfully!` });
 } catch (error: any) {
 toast({ 
 title:"Failed to upload photo(s)", 
 description: error.message,
 variant:"destructive" 
 });
 } finally {
 setIsUploading(false);
 // Reset input so same file can be selected again
 e.target.value ='';
 }
 }, [user, toast, formData.photo_urls.length]);

 const handleRemovePhoto = (indexToRemove: number) => {
 setFormData(prev => ({
 ...prev,
 photo_urls: prev.photo_urls.filter((_, index) => index !== indexToRemove),
 photo_url: indexToRemove === 0 && prev.photo_urls.length > 1 
 ? prev.photo_urls[1] 
 : prev.photo_url
 }));
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 
 if (!formData.pet_name || !formData.color_markings || !formData.last_seen_location || 
 !formData.last_seen_date || !formData.contact_name || !formData.contact_phone) {
 toast({ 
 title:"Missing required fields", 
 description:"Please fill in all required fields",
 variant:"destructive" 
 });
 return;
 }
 
 createPostMutation.mutate(formData);
 };

 // Filter posts by search term
 const filteredPosts = posts?.filter(post => {
 if (!searchTerm) return true;
 const search = searchTerm.toLowerCase();
 return (
 post.pet_name.toLowerCase().includes(search) ||
 post.pet_type.toLowerCase().includes(search) ||
 post.breed?.toLowerCase().includes(search) ||
 post.color_markings.toLowerCase().includes(search) ||
 post.last_seen_location.toLowerCase().includes(search)
 );
 });

 return (
 <>
 <SEO
 title={seoMeta.lostPets.title}
 description={seoMeta.lostPets.description}
 keywords={[...seoMeta.lostPets.keywords]}
 canonical={seoMeta.lostPets.canonical}
 />
 <div className="min-h-screen bg-background">
 <Header 
 isAuthenticated={!!user} 
          onLogout={async () => {
            await signOut();
          }}
 userId={user?.id}
 />
 
 <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
 {/* Hero Section */}
 <div className="text-center mb-8">
 <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
 Lost Pet Flyers
 </h1>
 <p className="text-muted-foreground max-w-2xl mx-auto">
 Help reunite lost pets with their families. Browse active flyers or create your own.
 </p>
 </div>

 {/* Search and Filters */}
 <div className="flex flex-col md:flex-row gap-4 mb-6">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by pet name, type, breed, or location..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full md:w-40">
 <SelectValue placeholder="Filter by status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="lost">Lost</SelectItem>
 <SelectItem value="found">Found</SelectItem>
 <SelectItem value="reunited">Reunited</SelectItem>
 </SelectContent>
 </Select>

 {user && (
 <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
 setIsCreateDialogOpen(open);
 if (!open) {
 resetForm();
 }
 }}>
 <DialogTrigger asChild>
 <Button className="gap-2">
 <PlusCircle className="w-4 h-4" />
 Create Flyer
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 {showPetSelector ? (
 <>
 <Sparkles className="w-5 h-5 text-primary" />
 Quick Create Lost Pet Flyer
 </>
 ) : (
 <>
 {selectedPetProfile && (
 <Button 
 variant="ghost" 
 size="sm" 
 onClick={handleBackToPetSelector}
 className="mr-2 h-8 w-8 p-0"
 >
 <ArrowLeft className="w-4 h-4" />
 </Button>
 )}
 <AlertTriangle className="w-5 h-5 text-destructive" />
 Report Lost Pet
 {selectedPetProfile && (
 <Badge variant="secondary" className="ml-2">
 {selectedPetProfile.name}
 </Badge>
 )}
 </>
 )}
 </DialogTitle>
 </DialogHeader>
 
 {/* Pet Profile Selector Step */}
 {showPetSelector && user ? (
 <PetProfileSelector 
 userId={user.id}
 onSelect={handlePetProfileSelect}
 onSkip={handleSkipPetSelector}
 />
 ) : (
 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Pet Information */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Pet Information</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="pet_name">Pet Name *</Label>
 <Input
 id="pet_name"
 value={formData.pet_name}
 onChange={(e) => setFormData(prev => ({ ...prev, pet_name: e.target.value }))}
 placeholder="e.g., Max"
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="pet_type">Pet Type *</Label>
 <Select 
 value={formData.pet_type} 
 onValueChange={(value) => setFormData(prev => ({ ...prev, pet_type: value }))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="dog">Dog</SelectItem>
 <SelectItem value="cat">Cat</SelectItem>
 <SelectItem value="bird">Bird</SelectItem>
 <SelectItem value="rabbit">Rabbit</SelectItem>
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
 placeholder="e.g., Golden Retriever"
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="color_markings">Color/Markings *</Label>
 <Input
 id="color_markings"
 value={formData.color_markings}
 onChange={(e) => setFormData(prev => ({ ...prev, color_markings: e.target.value }))}
 placeholder="e.g., Golden with white chest"
 required
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

 {/* Identification */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Identification</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="microchip_number">Microchip Number</Label>
 <Input
 id="microchip_number"
 value={formData.microchip_number}
 onChange={(e) => setFormData(prev => ({ ...prev, microchip_number: e.target.value }))}
 placeholder="If known"
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

 {/* Photo Upload */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
 <Images className="w-5 h-5" />
 Photos (up to {MAX_PHOTOS})
 </h3>
 
 <div className="space-y-3">
 <Label>Pet Photos (Highly Recommended)</Label>
 
 {/* Photo Grid */}
 <div className="grid grid-cols-5 gap-2">
 {formData.photo_urls.map((url, index) => (
 <div key={index} className="relative group">
 <img 
 src={url} 
 alt={`Pet photo ${index + 1}`} 
 className="w-full aspect-square object-cover rounded-lg border"
 />
 <button
 type="button"
 onClick={() => handleRemovePhoto(index)}
 className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <X className="w-3 h-3" />
 </button>
 {index === 0 && (
 <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">
 Main
 </span>
 )}
 </div>
 ))}
 
 {/* Add Photo Button */}
 {formData.photo_urls.length < MAX_PHOTOS && (
 <Label 
 htmlFor="photo-upload" 
 className="w-full aspect-square bg-muted rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors border-2 border-dashed border-muted-foreground/30"
 >
 {isUploading ? (
 <LoadingSpinner />
 ) : (
 <>
 <Upload className="w-6 h-6 text-muted-foreground" />
 <span className="text-xs text-muted-foreground mt-1">Add</span>
 </>
 )}
 </Label>
 )}
 </div>
 
 <Input
 type="file"
 accept="image/*"
 multiple
 onChange={handlePhotoUpload}
 disabled={isUploading || formData.photo_urls.length >= MAX_PHOTOS}
 className="hidden"
 id="photo-upload"
 />
 
 <p className="text-xs text-muted-foreground">
 {formData.photo_urls.length}/{MAX_PHOTOS} photos added. 
 The first photo will be used as the main image.
 </p>
 </div>
 </div>

 {/* Last Seen Information */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Last Seen</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="last_seen_location">Location *</Label>
 <Input
 id="last_seen_location"
 value={formData.last_seen_location}
 onChange={(e) => setFormData(prev => ({ ...prev, last_seen_location: e.target.value }))}
 placeholder="e.g., 123 Main St, Downtown"
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="last_seen_date">Date *</Label>
 <Input
 id="last_seen_date"
 type="date"
 value={formData.last_seen_date}
 onChange={(e) => setFormData(prev => ({ ...prev, last_seen_date: e.target.value }))}
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="last_seen_time">Time (Approximate)</Label>
 <Input
 id="last_seen_time"
 type="time"
 value={formData.last_seen_time}
 onChange={(e) => setFormData(prev => ({ ...prev, last_seen_time: e.target.value }))}
 />
 </div>
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="last_seen_area_description">Area Description</Label>
 <Textarea
 id="last_seen_area_description"
 value={formData.last_seen_area_description}
 onChange={(e) => setFormData(prev => ({ ...prev, last_seen_area_description: e.target.value }))}
 placeholder="e.g., Near the park, by the coffee shop"
 rows={2}
 />
 </div>
 </div>

 {/* Contact Information */}
 <div className="space-y-4">
 <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="contact_name">Your Name *</Label>
 <Input
 id="contact_name"
 value={formData.contact_name}
 onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
 placeholder="Your name"
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="contact_phone">Phone Number *</Label>
 <Input
 id="contact_phone"
 type="tel"
 value={formData.contact_phone}
 onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
 placeholder="Your phone number"
 required
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="contact_email">Email (Optional)</Label>
 <Input
 id="contact_email"
 type="email"
 value={formData.contact_email}
 onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
 placeholder="Your email"
 />
 </div>
 
 <div className="space-y-2">
 <Label htmlFor="reward_amount">Reward Amount (Optional)</Label>
 <Input
 id="reward_amount"
 type="number"
 min="0"
 step="0.01"
 value={formData.reward_amount}
 onChange={(e) => setFormData(prev => ({ ...prev, reward_amount: e.target.value }))}
 placeholder="e.g., 100"
 />
 </div>
 </div>
 </div>

 {/* Additional Notes */}
 <div className="space-y-2">
 <Label htmlFor="additional_notes">Additional Notes</Label>
 <Textarea
 id="additional_notes"
 value={formData.additional_notes}
 onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
 placeholder="Any other information that might help find your pet"
 rows={3}
 />
 </div>

 <Button 
 type="submit" 
 className="w-full" 
 disabled={createPostMutation.isPending}
 >
 {createPostMutation.isPending ?"Creating..." :"Create Lost Pet Flyer"}
 </Button>
 </form>
 )}
 </DialogContent>
 </Dialog>
 )}
 {!user && (
 <Button onClick={() => window.location.href ="/auth"} variant="outline">
 Sign in to create a flyer
 </Button>
 )}
 </div>

 {/* Posts Grid */}
 {isLoading ? (
 <div className="flex justify-center py-12">
 <LoadingSpinner />
 </div>
 ) : filteredPosts?.length === 0 ? (
 <div className="text-center py-12">
 <span className="w-16 h-16 text-muted-foreground mx-auto mb-4" aria-hidden="true">🐕</span>
 <h2 className="text-xl font-semibold mb-2">No lost pet flyers found</h2>
 <p className="text-muted-foreground">
 {searchTerm || statusFilter !=="all" 
 ?"Try adjusting your search or filters"
 :"Be the first to create a flyer if you've lost a pet"
 }
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredPosts?.map((post) => (
 <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
 {/* Photo */}
 <div className="relative h-48 bg-muted">
 {(post.photo_urls?.length > 0 || post.photo_url) ? (
 <>
 <img 
 src={post.photo_urls?.[0] || post.photo_url!} 
 alt={post.pet_name}
 className="w-full h-full object-cover"
 />
 {/* Photo count indicator */}
 {post.photo_urls && post.photo_urls.length > 1 && (
 <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
 <Images className="w-3 h-3" />
 {post.photo_urls.length}
 </div>
 )}
 </>
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 {petTypeIcons[post.pet_type] || <span className="w-16 h-16 text-muted-foreground" aria-hidden="true">🐕</span>}
 </div>
 )}
 
 {/* Status Badge */}
 <Badge className={`absolute top-3 left-3 gap-1 ${statusColors[post.status]}`}>
 {statusIcons[post.status]}
 {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
 </Badge>
 
 {/* Reward Badge */}
 {post.reward_amount && (
 <Badge className="absolute top-3 right-3 bg-success text-white gap-1">
 <span className="w-3 h-3" aria-hidden="true">💵</span>
 ${post.reward_amount} Reward
 </Badge>
 )}
 </div>
 
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-xl">
 {petTypeIcons[post.pet_type]}
 {post.pet_name}
 </CardTitle>
 <p className="text-sm text-muted-foreground">
 {post.breed && `${post.breed} • `}
 {post.color_markings}
 {post.size && ` • ${post.size}`}
 </p>
 </CardHeader>
 
 <CardContent className="space-y-3">
 {/* Last Seen */}
 <div className="flex items-start gap-2 text-sm">
 <span className="text-base text-destructive shrink-0 mt-0.5">📍</span>
 <div>
 <p className="font-medium">Last seen: {post.last_seen_location}</p>
 <p className="text-muted-foreground">
 {format(new Date(post.last_seen_date),"MMMM d, yyyy")}
 {post.last_seen_time && ` at ${post.last_seen_time}`}
 </p>
 </div>
 </div>
 
 {/* Identifying Features */}
 {post.identifying_features && (
 <p className="text-sm text-muted-foreground line-clamp-2">
 {post.identifying_features}
 </p>
 )}
 
 {/* Contact Info */}
 <div className="pt-3 border-t space-y-2">
 <div className="flex items-center gap-2 text-sm">
 <span className="w-4 h-4 text-primary" aria-hidden="true">📞</span>
 <a href={`tel:${post.contact_phone}`} className="hover:underline">
 {post.contact_phone}
 </a>
 </div>
 {post.contact_email && (
 <div className="flex items-center gap-2 text-sm">
 <span className="w-4 h-4 text-primary" aria-hidden="true">📧</span>
 <a href={`mailto:${post.contact_email}`} className="hover:underline truncate">
 {post.contact_email}
 </a>
 </div>
 )}
 </div>
 
 {/* Actions */}
 <div className="flex flex-col gap-2 pt-2 border-t">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span className="w-3 h-3" aria-hidden="true">📅</span>
 Posted {format(new Date(post.created_at),"MMM d, yyyy")}
 </div>
 <div className="flex items-center gap-1">
 <Button
 variant="ghost"
 size="sm"
 className="gap-1.5 h-8"
 onClick={() => navigate(`/lost-pets/${post.id}`)}
 >
 <Eye className="w-3.5 h-3.5" />
 View
 </Button>
 <LostPetShareDialog post={post}>
 <Button variant="outline" size="sm" className="gap-1.5 h-8">
 <span className="w-3.5 h-3.5" aria-hidden="true">🔗</span>
 Share
 </Button>
 </LostPetShareDialog>
 </div>
 </div>
 
 {/* Owner: Mark as Found button */}
 {user?.id === post.user_id && post.status ==="lost" && (
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="outline"
 size="sm"
 className="w-full gap-1.5 border-success text-success hover:bg-success/10 hover:text-success"
 >
 <PartyPopper className="w-3.5 h-3.5" />
 Mark as Found / Reunited
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2">
 <PartyPopper className="w-5 h-5 text-success" />
 Great News!
 </AlertDialogTitle>
 <AlertDialogDescription>
 Has {post.pet_name} been found and reunited with you? This will update
 the flyer status to show that {post.pet_name} is no longer missing.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={() => updateStatusMutation.mutate({ postId: post.id, newStatus:"reunited" })}
 className="bg-success hover:bg-success"
 >
 Yes, {post.pet_name} is home!
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 )}
 
 {/* Show reunited badge for owner */}
 {user?.id === post.user_id && post.status ==="reunited" && (
 <div className="flex items-center justify-center gap-1.5 p-2 bg-success/10 rounded text-xs text-success">
 <CheckCircle2 className="w-3.5 h-3.5" />
 {post.pet_name} has been reunited!
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </main>
 
 <BottomNav />
 </div>
 </>
 );
};

export default LostPets;

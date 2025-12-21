import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SEO } from "@/components/SEO";
import { 
  PlusCircle, 
  Search, 
  MapPin, 
  Calendar, 
  Phone, 
  Mail, 
  DollarSign,
  Dog,
  Cat,
  Bird,
  Rabbit,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { format } from "date-fns";

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
  dog: <Dog className="w-5 h-5" />,
  cat: <Cat className="w-5 h-5" />,
  bird: <Bird className="w-5 h-5" />,
  rabbit: <Rabbit className="w-5 h-5" />,
};

const statusColors: Record<string, string> = {
  lost: "bg-destructive text-destructive-foreground",
  found: "bg-secondary text-secondary-foreground",
  reunited: "bg-green-500 text-white",
};

const statusIcons: Record<string, React.ReactNode> = {
  lost: <AlertTriangle className="w-4 h-4" />,
  found: <Clock className="w-4 h-4" />,
  reunited: <CheckCircle2 className="w-4 h-4" />,
};

const LostPets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    pet_name: "",
    pet_type: "dog",
    breed: "",
    color_markings: "",
    size: "",
    age_estimate: "",
    gender: "",
    microchip_number: "",
    collar_description: "",
    identifying_features: "",
    photo_url: "",
    last_seen_location: "",
    last_seen_date: format(new Date(), "yyyy-MM-dd"),
    last_seen_time: "",
    last_seen_area_description: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    reward_amount: "",
    additional_notes: "",
  });

  // Fetch all active lost pet posts
  const { data: posts, isLoading } = useQuery({
    queryKey: ["lost-pet-posts", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("lost_pet_posts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
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
        photo_url: data.photo_url || null,
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
      toast({ title: "Lost pet flyer created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["lost-pet-posts"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create flyer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      pet_name: "",
      pet_type: "dog",
      breed: "",
      color_markings: "",
      size: "",
      age_estimate: "",
      gender: "",
      microchip_number: "",
      collar_description: "",
      identifying_features: "",
      photo_url: "",
      last_seen_location: "",
      last_seen_date: format(new Date(), "yyyy-MM-dd"),
      last_seen_time: "",
      last_seen_area_description: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      reward_amount: "",
      additional_notes: "",
    });
  };

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('lost-pet-photos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('lost-pet-photos')
        .getPublicUrl(fileName);
      
      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
      toast({ title: "Photo uploaded successfully!" });
    } catch (error: any) {
      toast({ 
        title: "Failed to upload photo", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  }, [user, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pet_name || !formData.color_markings || !formData.last_seen_location || 
        !formData.last_seen_date || !formData.contact_name || !formData.contact_phone) {
      toast({ 
        title: "Missing required fields", 
        description: "Please fill in all required fields",
        variant: "destructive" 
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
        title="Lost Pets | Help Find Missing Pets"
        description="View and create digital flyers for lost pets. Help reunite pets with their families."
      />
      <div className="min-h-screen bg-background">
        <Header />
        
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
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Create Flyer
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      Report Lost Pet
                    </DialogTitle>
                  </DialogHeader>
                  
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
                      <h3 className="font-semibold text-lg border-b pb-2">Photo</h3>
                      
                      <div className="space-y-2">
                        <Label>Pet Photo (Highly Recommended)</Label>
                        <div className="flex items-center gap-4">
                          {formData.photo_url ? (
                            <img 
                              src={formData.photo_url} 
                              alt="Pet" 
                              className="w-24 h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                              <Dog className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              disabled={isUploading}
                              className="hidden"
                              id="photo-upload"
                            />
                            <Label htmlFor="photo-upload" className="cursor-pointer">
                              <Button type="button" variant="outline" disabled={isUploading} asChild>
                                <span className="gap-2">
                                  {isUploading ? (
                                    <LoadingSpinner />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                  {formData.photo_url ? "Change Photo" : "Upload Photo"}
                                </span>
                              </Button>
                            </Label>
                          </div>
                        </div>
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
                      {createPostMutation.isPending ? "Creating..." : "Create Lost Pet Flyer"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            
            {!user && (
              <Button onClick={() => window.location.href = "/auth"} variant="outline">
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
              <Dog className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No lost pet flyers found</h2>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Be the first to create a flyer if you've lost a pet"
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts?.map((post) => (
                <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Photo */}
                  <div className="relative h-48 bg-muted">
                    {post.photo_url ? (
                      <img 
                        src={post.photo_url} 
                        alt={post.pet_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {petTypeIcons[post.pet_type] || <Dog className="w-16 h-16 text-muted-foreground" />}
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <Badge className={`absolute top-3 left-3 gap-1 ${statusColors[post.status]}`}>
                      {statusIcons[post.status]}
                      {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </Badge>
                    
                    {/* Reward Badge */}
                    {post.reward_amount && (
                      <Badge className="absolute top-3 right-3 bg-green-500 text-white gap-1">
                        <DollarSign className="w-3 h-3" />
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
                      <MapPin className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Last seen: {post.last_seen_location}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(post.last_seen_date), "MMMM d, yyyy")}
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
                        <Phone className="w-4 h-4 text-primary" />
                        <a href={`tel:${post.contact_phone}`} className="hover:underline">
                          {post.contact_phone}
                        </a>
                      </div>
                      {post.contact_email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-primary" />
                          <a href={`mailto:${post.contact_email}`} className="hover:underline truncate">
                            {post.contact_email}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    {/* Posted Date */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                      <Calendar className="w-3 h-3" />
                      Posted {format(new Date(post.created_at), "MMM d, yyyy")}
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

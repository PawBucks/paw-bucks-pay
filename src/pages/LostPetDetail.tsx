import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SEO } from "@/components/SEO";
import { LostPetShareDialog } from "@/components/LostPetShareDialog";
import { format } from "date-fns";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Phone,
  Mail,
  DollarSign,
  Dog,
  Cat,
  Bird,
  Rabbit,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Share2,
  PartyPopper,
} from "lucide-react";

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
  dog: <Dog className="w-6 h-6" />,
  cat: <Cat className="w-6 h-6" />,
  bird: <Bird className="w-6 h-6" />,
  rabbit: <Rabbit className="w-6 h-6" />,
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

const LostPetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["lost-pet-post", id],
    queryFn: async () => {
      if (!id) throw new Error("No post ID provided");
      const { data, error } = await supabase
        .from("lost_pet_posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Post not found");
      return data as LostPetPost;
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!id) throw new Error("No post ID");
      const { error } = await supabase
        .from("lost_pet_posts")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      toast({ 
        title: newStatus === "reunited" 
          ? "Great news! Pet marked as reunited!" 
          : `Status updated to ${newStatus}` 
      });
      queryClient.invalidateQueries({ queryKey: ["lost-pet-post", id] });
      queryClient.invalidateQueries({ queryKey: ["lost-pet-posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isOwner = user?.id === post?.user_id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <Dog className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This lost pet flyer may have been removed or doesn't exist.
          </p>
          <Button onClick={() => navigate("/lost-pets")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lost Pets
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${post.status === "lost" ? "LOST" : post.status.toUpperCase()}: ${post.pet_name} | Lost Pet Flyer`}
        description={`Help find ${post.pet_name}! ${post.breed ? `${post.breed}, ` : ""}${post.color_markings}. Last seen: ${post.last_seen_location}`}
      />
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/lost-pets")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lost Pets
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo & Status */}
              <Card className="overflow-hidden">
                <div className="relative">
                  {post.photo_url ? (
                    <img
                      src={post.photo_url}
                      alt={post.pet_name}
                      className="w-full h-64 md:h-96 object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 md:h-96 bg-muted flex items-center justify-center">
                      {petTypeIcons[post.pet_type] || (
                        <Dog className="w-24 h-24 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <Badge
                    className={`absolute top-4 left-4 gap-1 text-base px-3 py-1 ${statusColors[post.status]}`}
                  >
                    {statusIcons[post.status]}
                    {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                  </Badge>
                  {post.reward_amount && (
                    <Badge className="absolute top-4 right-4 bg-green-500 text-white gap-1 text-base px-3 py-1">
                      <DollarSign className="w-4 h-4" />
                      ${post.reward_amount} Reward
                    </Badge>
                  )}
                </div>

                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-2xl md:text-3xl">
                    {petTypeIcons[post.pet_type]}
                    {post.pet_name}
                  </CardTitle>
                  <p className="text-muted-foreground">
                    {post.breed && `${post.breed} • `}
                    {post.color_markings}
                    {post.size && ` • ${post.size.charAt(0).toUpperCase() + post.size.slice(1)}`}
                    {post.gender && ` • ${post.gender.charAt(0).toUpperCase() + post.gender.slice(1)}`}
                    {post.age_estimate && ` • ${post.age_estimate}`}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Last Seen */}
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-lg">
                          Last seen: {post.last_seen_location}
                        </p>
                        <p className="text-muted-foreground">
                          {format(new Date(post.last_seen_date), "EEEE, MMMM d, yyyy")}
                          {post.last_seen_time && ` at ${post.last_seen_time}`}
                        </p>
                        {post.last_seen_area_description && (
                          <p className="mt-1 text-sm">
                            {post.last_seen_area_description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Identifying Features */}
                  {(post.identifying_features || post.collar_description || post.microchip_number) && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Identifying Features</h3>
                      {post.identifying_features && (
                        <p className="text-muted-foreground">{post.identifying_features}</p>
                      )}
                      {post.collar_description && (
                        <p className="text-sm">
                          <span className="font-medium">Collar:</span> {post.collar_description}
                        </p>
                      )}
                      {post.microchip_number && (
                        <p className="text-sm">
                          <span className="font-medium">Microchip:</span> {post.microchip_number}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Additional Notes */}
                  {post.additional_notes && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Additional Notes</h3>
                      <p className="text-muted-foreground">{post.additional_notes}</p>
                    </div>
                  )}

                  {/* Posted Date */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
                    <Calendar className="w-4 h-4" />
                    Posted {format(new Date(post.created_at), "MMMM d, yyyy")}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Contact Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="font-medium">{post.contact_name}</p>
                  <a
                    href={`tel:${post.contact_phone}`}
                    className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Phone className="w-5 h-5 text-primary" />
                    <span className="font-medium">{post.contact_phone}</span>
                  </a>
                  {post.contact_email && (
                    <a
                      href={`mailto:${post.contact_email}`}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <Mail className="w-5 h-5 text-primary" />
                      <span className="truncate">{post.contact_email}</span>
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <LostPetShareDialog post={post}>
                    <Button className="w-full gap-2" size="lg">
                      <Share2 className="w-5 h-5" />
                      Share Flyer
                    </Button>
                  </LostPetShareDialog>

                  {/* Owner Actions */}
                  {isOwner && post.status === "lost" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                          size="lg"
                        >
                          <PartyPopper className="w-5 h-5" />
                          Mark as Found / Reunited
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <PartyPopper className="w-5 h-5 text-green-500" />
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
                            onClick={() => updateStatusMutation.mutate("reunited")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Yes, {post.pet_name} is home!
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {isOwner && post.status === "reunited" && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        {post.pet_name} has been reunited!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reward Card */}
              {post.reward_amount && (
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      ${post.reward_amount} Reward
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      For safe return of {post.pet_name}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>

        <BottomNav />
      </div>
    </>
  );
};

export default LostPetDetail;

import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Avatar, AvatarFallback } from"@/components/ui/avatar";
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
import { toast } from"sonner";
import { format } from"date-fns";
import { Star, Trash2, Loader2, X } from"lucide-react";

type ReviewPhoto = {
 id: string;
 photo_url: string;
};

type Review = {
 id: string;
 user_id: string;
 rating: number;
 review_text: string | null;
 created_at: string;
 user_name?: string;
 photos: ReviewPhoto[];
};

type ReviewCardProps = {
 review: Review;
 currentUserId?: string;
 onDelete: () => void;
};

export const ReviewCard = ({ review, currentUserId, onDelete }: ReviewCardProps) => {
 const [isDeleting, setIsDeleting] = useState(false);
 const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

 const isOwnReview = currentUserId === review.user_id;

 const handleDelete = async () => {
 setIsDeleting(true);
 try {
 // Delete photos from storage first
 for (const photo of review.photos) {
 // Extract file path from URL
 const urlParts = photo.photo_url.split("/review-photos/");
 if (urlParts[1]) {
 await supabase.storage.from("review-photos").remove([urlParts[1]]);
 }
 }

 // Delete review (cascade will delete photo records)
 const { error } = await supabase
 .from("merchant_reviews")
 .delete()
 .eq("id", review.id);

 if (error) throw error;

 toast.success("Review deleted");
 onDelete();
 } catch (error: any) {
 console.error("Error deleting review:", error);
 toast.error("Failed to delete review");
 } finally {
 setIsDeleting(false);
 }
 };

 return (
 <>
 <Card>
 <CardContent className="p-5">
 <div className="flex items-start gap-4">
 {/* Avatar */}
 <Avatar className="w-10 h-10">
 <AvatarFallback className="bg-primary/10 text-primary">
 {review.user_name?.charAt(0).toUpperCase() ||"U"}
 </AvatarFallback>
 </Avatar>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="font-medium">{review.user_name ||"Anonymous"}</p>
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-0.5">
 {[1, 2, 3, 4, 5].map((star) => (
 <Star
 key={star}
 className={`w-4 h-4 ${
 star <= review.rating
 ?"fill-gold text-gold"
 :"text-muted-foreground/30"
 }`}
 />
 ))}
 </div>
 <span className="text-sm text-muted-foreground">
 {format(new Date(review.created_at),"MMM d, yyyy")}
 </span>
 </div>
 </div>

 {/* Delete Button */}
 {isOwnReview && (
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 className="text-muted-foreground hover:text-destructive"
 disabled={isDeleting}
 >
 {isDeleting ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Review?</AlertDialogTitle>
 <AlertDialogDescription>
 This will permanently delete your review and photos. This action
 cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction
 onClick={handleDelete}
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 >
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 )}
 </div>

 {/* Review Text */}
 {review.review_text && (
 <p className="mt-3 text-muted-foreground whitespace-pre-line">
 {review.review_text}
 </p>
 )}

 {/* Photos */}
 {review.photos.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-3">
 {review.photos.map((photo) => (
 <button
 key={photo.id}
 onClick={() => setSelectedPhoto(photo.photo_url)}
 className="w-20 h-20 rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
 >
 <img
 src={photo.photo_url}
 alt="Review photo"
 className="w-full h-full object-cover"
 />
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Photo Lightbox */}
 {selectedPhoto && (
 <div
 className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
 onClick={() => setSelectedPhoto(null)}
 >
 <button
 onClick={() => setSelectedPhoto(null)}
 className="absolute top-4 right-4 text-white hover:text-white/80"
 >
 <X className="w-8 h-8" />
 </button>
 <img
 src={selectedPhoto}
 alt="Review photo"
 className="max-w-full max-h-[90vh] object-contain rounded-lg"
 onClick={(e) => e.stopPropagation()}
 />
 </div>
 )}
 </>
 );
};

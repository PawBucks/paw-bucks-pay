import { useState, useRef } from"react";
import { supabase } from"@/integrations/supabase/client";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { toast } from"sonner";
import { Star, Camera, X, Loader2 } from"lucide-react";

type WriteReviewDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 merchantId: string;
 userId: string;
 onSuccess: () => void;
};

export const WriteReviewDialog = ({
 open,
 onOpenChange,
 merchantId,
 userId,
 onSuccess,
}: WriteReviewDialogProps) => {
 const [rating, setRating] = useState(0);
 const [hoverRating, setHoverRating] = useState(0);
 const [reviewText, setReviewText] = useState("");
 const [photos, setPhotos] = useState<File[]>([]);
 const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 if (files.length + photos.length > 5) {
 toast.error("Maximum 5 photos allowed");
 return;
 }

 const validFiles = files.filter((file) => {
 if (!file.type.startsWith("image/")) {
 toast.error(`${file.name} is not an image`);
 return false;
 }
 if (file.size > 5 * 1024 * 1024) {
 toast.error(`${file.name} is too large (max 5MB)`);
 return false;
 }
 return true;
 });

 setPhotos((prev) => [...prev, ...validFiles]);

 // Create preview URLs
 validFiles.forEach((file) => {
 const reader = new FileReader();
 reader.onload = (e) => {
 setPhotoPreviewUrls((prev) => [...prev, e.target?.result as string]);
 };
 reader.readAsDataURL(file);
 });
 };

 const removePhoto = (index: number) => {
 setPhotos((prev) => prev.filter((_, i) => i !== index));
 setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
 };

 const handleSubmit = async () => {
 if (rating === 0) {
 toast.error("Please select a rating");
 return;
 }

 setIsSubmitting(true);

 try {
 // Create review
 const { data: review, error: reviewError } = await supabase
 .from("merchant_reviews")
 .insert({
 merchant_id: merchantId,
 user_id: userId,
 rating,
 review_text: reviewText.trim() || null,
 })
 .select()
 .single();

 if (reviewError) throw reviewError;

 // Upload photos
 for (const photo of photos) {
 const fileExt = photo.name.split(".").pop();
 const fileName = `${userId}/${review.id}/${crypto.randomUUID()}.${fileExt}`;

 const { error: uploadError } = await supabase.storage
 .from("review-photos")
 .upload(fileName, photo);

 if (uploadError) {
 console.error("Photo upload error:", uploadError);
 continue;
 }

 // Get public URL
 const { data: urlData } = supabase.storage
 .from("review-photos")
 .getPublicUrl(fileName);

 // Save photo record
 await supabase.from("review_photos").insert({
 review_id: review.id,
 photo_url: urlData.publicUrl,
 });
 }

 toast.success("Review submitted successfully!");
 onSuccess();
 handleClose();
 } catch (error: any) {
 console.error("Error submitting review:", error);
 toast.error(error.message ||"Failed to submit review");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 setRating(0);
 setHoverRating(0);
 setReviewText("");
 setPhotos([]);
 setPhotoPreviewUrls([]);
 onOpenChange(false);
 };

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle>Write a Review</DialogTitle>
 <DialogDescription>
 Share your experience with other pet owners
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-6">
 {/* Star Rating */}
 <div className="space-y-2">
 <label className="text-sm font-medium">Your Rating *</label>
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4, 5].map((star) => (
 <button
 key={star}
 type="button"
 onClick={() => setRating(star)}
 onMouseEnter={() => setHoverRating(star)}
 onMouseLeave={() => setHoverRating(0)}
 className="p-1 hover:scale-110 transition-transform"
 >
 <Star
 className={`w-8 h-8 transition-colors ${
 star <= (hoverRating || rating)
 ?"fill-gold text-gold"
 :"text-muted-foreground/30"
 }`}
 />
 </button>
 ))}
 <span className="ml-2 text-sm text-muted-foreground">
 {rating > 0 && (
 <>
 {rating === 1 &&"Poor"}
 {rating === 2 &&"Fair"}
 {rating === 3 &&"Good"}
 {rating === 4 &&"Very Good"}
 {rating === 5 &&"Excellent"}
 </>
 )}
 </span>
 </div>
 </div>

 {/* Review Text */}
 <div className="space-y-2">
 <label className="text-sm font-medium">Your Review (optional)</label>
 <Textarea
 value={reviewText}
 onChange={(e) => setReviewText(e.target.value)}
 placeholder="Tell others about your experience..."
 rows={4}
 maxLength={1000}
 />
 <p className="text-xs text-muted-foreground text-right">
 {reviewText.length}/1000
 </p>
 </div>

 {/* Photo Upload */}
 <div className="space-y-2">
 <label className="text-sm font-medium">Add Photos (optional)</label>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handlePhotoSelect}
 className="hidden"
 />

 {photoPreviewUrls.length > 0 && (
 <div className="flex flex-wrap gap-2 mb-3">
 {photoPreviewUrls.map((url, index) => (
 <div key={index} className="relative">
 <img
 src={url}
 alt={`Preview ${index + 1}`}
 className="w-20 h-20 object-cover rounded-lg border"
 />
 <button
 type="button"
 onClick={() => removePhoto(index)}
 className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 )}

 {photos.length < 5 && (
 <Button
 type="button"
 variant="outline"
 onClick={() => fileInputRef.current?.click()}
 className="w-full"
 >
 <Camera className="w-4 h-4 mr-2" />
 Add Photos ({photos.length}/5)
 </Button>
 )}
 <p className="text-xs text-muted-foreground">
 Maximum 5 photos, 5MB each
 </p>
 </div>

 {/* Actions */}
 <div className="flex gap-3 pt-4">
 <Button
 variant="outline"
 onClick={handleClose}
 disabled={isSubmitting}
 className="flex-1"
 >
 Cancel
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={isSubmitting || rating === 0}
 className="flex-1"
 >
 {isSubmitting ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Submitting...
 </>
 ) : (
"Submit Review"
 )}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};

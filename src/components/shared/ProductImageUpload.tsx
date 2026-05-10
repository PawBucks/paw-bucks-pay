import { useState, useRef } from"react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from"@/components/ui/button";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";
import { cn } from"@/lib/utils";

interface ProductImageUploadProps {
 /** Array of current image URLs */
 imageUrls: string[];
 /** Called with updated array of URLs after upload or remove */
 onChange: (urls: string[]) => void;
 /** Folder prefix in the bucket, e.g."admin" or merchant ID */
 folder: string;
 /** Maximum number of images allowed (default 5) */
 maxImages?: number;
 className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg","image/png","image/webp"];

export function ProductImageUpload({
 imageUrls,
 onChange,
 folder,
 maxImages = 5,
 className,
}: ProductImageUploadProps) {
 const [uploading, setUploading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const cameraInputRef = useRef<HTMLInputElement>(null);

 const canAddMore = imageUrls.length < maxImages;

 const handleFile = async (file: File) => {
 if (!ALLOWED_TYPES.includes(file.type)) {
 toast.error("Only JPG, PNG, and WebP images are allowed.");
 return;
 }
 if (file.size > MAX_FILE_SIZE) {
 toast.error("Image must be under 5MB.");
 return;
 }
 if (!canAddMore) {
 toast.error(`Maximum ${maxImages} images allowed.`);
 return;
 }

 setUploading(true);

 try {
 const ext = file.name.split(".").pop() ||"jpg";
 const fileName = `${crypto.randomUUID()}.${ext}`;
 const filePath = `${folder}/${fileName}`;

 const { error: uploadError } = await supabase.storage
 .from("product-images")
 .upload(filePath, file, { upsert: true });

 if (uploadError) throw uploadError;

 const { data } = supabase.storage
 .from("product-images")
 .getPublicUrl(filePath);

 onChange([...imageUrls, data.publicUrl]);
 toast.success("Image uploaded!");
 } catch (error) {
 console.error("Upload error:", error);
 toast.error("Failed to upload image");
 } finally {
 setUploading(false);
 }
 };

 const handleRemove = (index: number) => {
 const updated = imageUrls.filter((_, i) => i !== index);
 onChange(updated);
 if (fileInputRef.current) fileInputRef.current.value ="";
 if (cameraInputRef.current) cameraInputRef.current.value ="";
 };

 return (
 <div className={cn("space-y-3", className)}>
 {/* Hidden inputs */}
 <input
 ref={fileInputRef}
 type="file"
 accept={ALLOWED_TYPES.join(",")}
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleFile(file);
 e.target.value ="";
 }}
 className="hidden"
 />
 <input
 ref={cameraInputRef}
 type="file"
 accept="image/*"
 capture="environment"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleFile(file);
 e.target.value ="";
 }}
 className="hidden"
 />

 {/* Image grid */}
 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
 {imageUrls.map((url, index) => (
 <div
 key={`${url}-${index}`}
 className="relative group rounded-lg overflow-hidden border border-border bg-muted/30 aspect-square"
 >
 <img
 src={url}
 alt={`Product image ${index + 1}`}
 className="w-full h-full object-cover"
 />
 <Button
 type="button"
 variant="destructive"
 size="icon"
 className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
 onClick={() => handleRemove(index)}
 >
 <X className="h-3 w-3" />
 </Button>
 {index === 0 && (
 <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
 Main
 </span>
 )}
 </div>
 ))}

 {/* Add more button */}
 {canAddMore && !uploading && (
 <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-1 hover:border-muted-foreground/50 transition-colors">
 <div className="flex gap-1">
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 onClick={() => fileInputRef.current?.click()}
 >
 <Upload className="h-4 w-4" />
 </Button>
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 onClick={() => cameraInputRef.current?.click()}
 >
 <span className="h-4 w-4" aria-hidden="true">📸</span>
 </Button>
 </div>
 <span className="text-[10px] text-muted-foreground">
 {imageUrls.length}/{maxImages}
 </span>
 </div>
 )}

 {/* Uploading indicator */}
 {uploading && (
 <div className="aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-primary" />
 </div>
 )}
 </div>

 {imageUrls.length === 0 && !uploading && (
 <div className="flex items-center gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => fileInputRef.current?.click()}
 >
 <Upload className="h-4 w-4 mr-1.5" />
 Upload
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => cameraInputRef.current?.click()}
 >
 <span className="h-4 w-4 mr-1.5" aria-hidden="true">📸</span>
 Camera
 </Button>
 </div>
 )}

 <p className="text-xs text-muted-foreground">
 JPG, PNG, or WebP up to 5MB · {imageUrls.length}/{maxImages} images
 </p>
 </div>
 );
}

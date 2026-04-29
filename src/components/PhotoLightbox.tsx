import { useState, useEffect } from"react";
import { Dialog, DialogContent } from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { ChevronLeft, ChevronRight, X, ZoomIn } from"lucide-react";

interface PhotoLightboxProps {
 photos: string[];
 initialIndex?: number;
 open: boolean;
 onOpenChange: (open: boolean) => void;
}

export const PhotoLightbox = ({ 
 photos, 
 initialIndex = 0, 
 open, 
 onOpenChange 
}: PhotoLightboxProps) => {
 const [currentIndex, setCurrentIndex] = useState(initialIndex);

 useEffect(() => {
 setCurrentIndex(initialIndex);
 }, [initialIndex, open]);

 const handlePrev = () => {
 setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
 };

 const handleNext = () => {
 setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key ==="ArrowLeft") handlePrev();
 if (e.key ==="ArrowRight") handleNext();
 if (e.key ==="Escape") onOpenChange(false);
 };

 if (!photos.length) return null;

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent 
 className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none"
 onKeyDown={handleKeyDown}
 >
 {/* Close button */}
 <Button
 variant="ghost"
 size="icon"
 className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
 onClick={() => onOpenChange(false)}
 >
 <X className="w-6 h-6" />
 </Button>

 {/* Main image */}
 <div className="flex items-center justify-center min-h-[50vh] max-h-[90vh] p-4">
 <img
 src={photos[currentIndex]}
 alt={`Photo ${currentIndex + 1}`}
 className="max-w-full max-h-[85vh] object-contain rounded-lg"
 />
 </div>

 {/* Navigation arrows */}
 {photos.length > 1 && (
 <>
 <Button
 variant="ghost"
 size="icon"
 className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
 onClick={handlePrev}
 >
 <ChevronLeft className="w-8 h-8" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
 onClick={handleNext}
 >
 <ChevronRight className="w-8 h-8" />
 </Button>
 </>
 )}

 {/* Photo counter */}
 {photos.length > 1 && (
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
 {currentIndex + 1} / {photos.length}
 </div>
 )}

 {/* Thumbnail strip */}
 {photos.length > 1 && (
 <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/60 rounded-lg">
 {photos.map((photo, index) => (
 <button
 key={index}
 onClick={() => setCurrentIndex(index)}
 className={`w-12 h-12 rounded overflow-hidden border-2 transition-all ${
 index === currentIndex 
 ?"border-white scale-110" 
 :"border-transparent opacity-60 hover:opacity-100"
 }`}
 >
 <img
 src={photo}
 alt={`Thumbnail ${index + 1}`}
 className="w-full h-full object-cover"
 />
 </button>
 ))}
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
};

// Clickable photo thumbnail that opens lightbox
interface PhotoThumbnailProps {
 src: string;
 alt?: string;
 className?: string;
 onClick?: () => void;
}

export const PhotoThumbnail = ({ src, alt ="Photo", className ="", onClick }: PhotoThumbnailProps) => (
 <button
 onClick={onClick}
 className={`relative group overflow-hidden rounded-lg cursor-pointer ${className}`}
 >
 <img src={src} alt={alt} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
 <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 </button>
);
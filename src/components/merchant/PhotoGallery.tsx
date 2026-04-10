import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  merchantId: string;
};

export function PhotoGallery({ merchantId }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: photos = [] } = useQuery({
    queryKey: ["merchant-photos", merchantId],
    queryFn: async () => {
      const { data: reviews } = await supabase
        .from("merchant_reviews")
        .select("id")
        .eq("merchant_id", merchantId);

      if (!reviews?.length) return [];

      const reviewIds = reviews.map(r => r.id);
      const { data: photoData } = await supabase
        .from("review_photos")
        .select("id, photo_url")
        .in("review_id", reviewIds)
        .limit(20);

      return photoData || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  if (photos.length === 0) return null;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Photos & Reviews</h3>
          <span className="text-xs text-muted-foreground">({photos.length})</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(idx)}
              className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-2 border-border hover:border-primary/50 transition-all hover:scale-105"
            >
              <img
                src={photo.photo_url}
                alt="Review photo"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 text-white/80 hover:text-white z-10"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 text-white/80 hover:text-white z-10"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}

          <img
            src={photos[lightboxIndex].photo_url}
            alt="Review photo"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-6 text-white/60 text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}

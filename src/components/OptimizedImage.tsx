import { useState, ImgHTMLAttributes, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { optimizeImage } from '@/lib/performance';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  aspectRatio?: string;
  priority?: boolean;
}

/**
 * Optimized image component with lazy loading, fallbacks, and performance enhancements
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  className, 
  fallback = '/placeholder.svg',
  aspectRatio,
  priority = false,
  width,
  ...props 
}: OptimizedImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(
    priority ? (src || fallback) : fallback
  );
  const [isLoading, setIsLoading] = useState(!priority);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!priority && src) {
      // Lazy load non-priority images
      const img = new Image();
      img.src = optimizeImage(src, width as number);
      img.onload = () => {
        setImageSrc(optimizeImage(src, width as number));
        setIsLoading(false);
      };
      img.onerror = () => {
        setImageSrc(fallback);
        setIsLoading(false);
        setHasError(true);
      };
    }
  }, [src, fallback, priority, width]);

  const handleError = () => {
    setImageSrc(fallback);
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div 
      className={cn("relative overflow-hidden bg-muted", className)} 
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {isLoading && !priority && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoading(false)}
        onError={handleError}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        {...props}
      />
    </div>
  );
};

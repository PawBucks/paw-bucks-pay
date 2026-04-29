import { useState, ImgHTMLAttributes, useEffect, useRef } from'react';
import { cn } from'@/lib/utils';
import { optimizeImage, generateSrcSet, getOptimalQuality } from'@/lib/performance';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>,'src'> {
 src?: string;
 fallback?: string;
 aspectRatio?: string;
 priority?: boolean;
 sizes?: string;
 blurDataURL?: string;
}

/**
 * Enhanced optimized image component with progressive loading and responsive srcset
 */
export const OptimizedImage = ({ 
 src, 
 alt ='', 
 className, 
 fallback ='/placeholder.svg',
 aspectRatio,
 priority = false,
 width,
 height,
 sizes,
 blurDataURL,
 ...props 
}: OptimizedImageProps) => {
 const [imageSrc, setImageSrc] = useState<string>(
 priority ? (src || fallback) : (blurDataURL || fallback)
 );
 const [isLoading, setIsLoading] = useState(!priority);
 const [hasError, setHasError] = useState(false);
 const imgRef = useRef<HTMLImageElement>(null);

 useEffect(() => {
 if (!priority && src && imgRef.current) {
 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting) {
 const img = new Image();
 const quality = getOptimalQuality();
 const optimizedSrc = optimizeImage(src, width as number, quality);
 
 img.src = optimizedSrc;
 
 img.onload = () => {
 setImageSrc(optimizedSrc);
 setIsLoading(false);
 };
 
 img.onerror = () => {
 setImageSrc(fallback);
 setIsLoading(false);
 setHasError(true);
 };
 
 observer.unobserve(entry.target);
 }
 });
 },
 {
 rootMargin:'50px 0px',
 threshold: 0.01
 }
 );

 observer.observe(imgRef.current);

 return () => observer.disconnect();
 }
 }, [src, fallback, priority, width]);

 const handleError = () => {
 if (!hasError) {
 setImageSrc(fallback);
 setIsLoading(false);
 setHasError(true);
 }
 };

 // Generate srcset for responsive images
 const srcSet = src && !hasError ? generateSrcSet(src) : undefined;

 return (
 <div 
 className={cn("relative overflow-hidden bg-muted", className)} 
 style={aspectRatio ? { aspectRatio } : undefined}
 >
 {isLoading && !priority && (
 <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted animate-pulse" />
 )}
 <img
 ref={imgRef}
 src={imageSrc}
 srcSet={priority ? srcSet : undefined}
 sizes={sizes}
 alt={alt}
 loading={priority ?"eager" :"lazy"}
 decoding="async"
 fetchPriority={priority ?"high" :"auto"}
 onLoad={() => setIsLoading(false)}
 onError={handleError}
 width={width}
 height={height}
 className={cn(
"w-full h-full object-cover transition-all duration-500",
 isLoading ?"opacity-0 scale-105" :"opacity-100 scale-100",
 hasError &&"object-contain"
 )}
 {...props}
 />
 {isLoading && blurDataURL && (
 <div
 className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
 style={{ backgroundImage: `url(${blurDataURL})` }}
 />
 )}
 </div>
 );
};

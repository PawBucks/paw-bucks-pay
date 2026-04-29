import { memo, useState, useCallback, ImgHTMLAttributes } from'react';
import { cn } from'@/lib/utils';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>,'loading'> {
 /** Fallback element when image fails to load */
 fallback?: React.ReactNode;
 /** Whether to use eager loading (above the fold) */
 priority?: boolean;
}

/**
 * Performance-optimized image component with:
 * - Native lazy loading by default
 * - Async decoding for non-blocking rendering
 * - Error fallback support
 * - Smooth fade-in on load
 */
const OptimizedImageComponent = ({
 src,
 alt,
 className,
 fallback,
 priority = false,
 ...props
}: OptimizedImageProps) => {
 const [loaded, setLoaded] = useState(false);
 const [error, setError] = useState(false);

 const handleLoad = useCallback(() => setLoaded(true), []);
 const handleError = useCallback(() => setError(true), []);

 if (error && fallback) {
 return <>{fallback}</>;
 }

 return (
 <img
 src={src}
 alt={alt ||''}
 loading={priority ?'eager' :'lazy'}
 decoding={priority ?'sync' :'async'}
 fetchPriority={priority ?'high' : undefined}
 onLoad={handleLoad}
 onError={handleError}
 className={cn(
'transition-opacity duration-300',
 loaded ?'opacity-100' :'opacity-0',
 className
 )}
 {...props}
 />
 );
};

export const OptimizedImage = memo(OptimizedImageComponent);

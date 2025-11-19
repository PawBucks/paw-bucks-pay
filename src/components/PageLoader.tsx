import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  className?: string;
  message?: string;
  fullScreen?: boolean;
}

/**
 * Enhanced loading component with smooth animations and PWA optimization
 */
export const PageLoader = ({ className, message, fullScreen = true }: PageLoaderProps) => {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-background",
        fullScreen && "min-h-screen",
        !fullScreen && "min-h-[400px]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-primary" aria-hidden="true" />
        <div className="absolute inset-0 w-12 h-12 rounded-full bg-primary/20 animate-ping" aria-hidden="true" />
      </div>
      {message && (
        <p className="text-muted-foreground animate-pulse font-medium">{message}</p>
      )}
    </div>
  );
};

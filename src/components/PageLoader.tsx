import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  className?: string;
  message?: string;
  fullScreen?: boolean;
}

/**
 * Optimized loading component - minimal DOM, instant render
 */
const PageLoaderComponent = ({ className, message, fullScreen = true }: PageLoaderProps) => {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-[var(--gradient-hero)]",
        fullScreen && "min-h-screen",
        !fullScreen && "min-h-[200px]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
      {message && (
        <p className="text-muted-foreground text-sm">{message}</p>
      )}
    </div>
  );
};

export const PageLoader = memo(PageLoaderComponent);

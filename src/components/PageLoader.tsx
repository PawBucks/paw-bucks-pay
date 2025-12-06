import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

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
        "flex flex-col items-center justify-center gap-6 bg-[var(--gradient-hero)] touch-manipulation",
        fullScreen && "min-h-screen",
        !fullScreen && "min-h-[400px]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <div className="relative animate-bounce-in">
        <img 
          src={logo} 
          alt="PawBucks" 
          className="w-20 h-20 object-contain"
          width={80}
          height={80}
        />
      </div>
      <div className="relative">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <div className="absolute inset-0 w-8 h-8 rounded-full bg-primary/20 animate-ping" aria-hidden="true" />
      </div>
      {message && (
        <p className="text-muted-foreground animate-pulse font-medium text-sm">{message}</p>
      )}
    </div>
  );
};

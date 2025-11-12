import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  className?: string;
  message?: string;
}

// Consistent page loading component
export const PageLoader = ({ className, message }: PageLoaderProps) => {
  return (
    <div className={cn("min-h-screen flex flex-col items-center justify-center gap-4", className)}>
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      {message && (
        <p className="text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
};

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

/**
 * Reusable loading spinner component with consistent styling
 */
export const LoadingSpinner = ({ size = 'md', className, text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} aria-hidden="true" />
        <div className={cn("absolute inset-0 animate-ping opacity-20 text-primary", sizeClasses[size])}>
          <Loader2 className="w-full h-full" />
        </div>
      </div>
      {text && <p className="text-muted-foreground font-medium text-sm animate-pulse">{text}</p>}
    </div>
  );
};

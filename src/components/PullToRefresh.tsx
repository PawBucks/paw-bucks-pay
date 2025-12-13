import React, { ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: ReactNode;
  isRefreshing: boolean;
  pullDistance: number;
  progress: number;
  className?: string;
}

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(
  ({ children, isRefreshing, pullDistance, progress, className }, ref) => {
    const showIndicator = pullDistance > 10 || isRefreshing;
    const indicatorOpacity = isRefreshing ? 1 : Math.min(progress, 1);
    const rotation = isRefreshing ? 0 : progress * 360;

    return (
      <div ref={ref} className={cn("relative overflow-auto", className)}>
        {/* Pull indicator */}
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none z-50 transition-transform duration-200"
          style={{
            transform: `translateY(${showIndicator ? pullDistance - 40 : -40}px)`,
            opacity: indicatorOpacity,
          }}
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-full p-2 shadow-lg border border-border/50">
            <Loader2
              className={cn(
                "h-5 w-5 text-primary transition-transform",
                isRefreshing && "animate-spin"
              )}
              style={{
                transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>

        {/* Content with pull offset */}
        <div
          className="transition-transform duration-200"
          style={{
            transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

PullToRefresh.displayName = 'PullToRefresh';

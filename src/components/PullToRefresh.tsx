import React, { ReactNode, forwardRef } from'react';
import { Loader2 } from'lucide-react';
import { cn } from'@/lib/utils';

interface PullToRefreshProps {
 children: ReactNode;
 isRefreshing: boolean;
 pullDistance: number;
 progress: number;
 className?: string;
}

/**
 * PullToRefresh wrapper component.
 * 
 * IMPORTANT: This component should NOT create its own scroll context.
 * The scroll should happen at the document level to prevent mobile
 * scrolling issues (getting stuck at bottom).
 * 
 * The ref is optional and primarily used for the visual indicator positioning.
 */
export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(
 ({ children, isRefreshing, pullDistance, progress, className }, ref) => {
 const showIndicator = pullDistance > 10 || isRefreshing;
 const indicatorOpacity = isRefreshing ? 1 : Math.min(progress, 1);
 const rotation = isRefreshing ? 0 : progress * 360;

 return (
 <div 
 ref={ref} 
 className={cn("relative", className)}
 // Ensure no overflow properties that could create a scroll container
 style={{ overflow:'visible' }}
 >
 {/* Pull indicator - fixed to viewport top for better visibility */}
 <div
 className="fixed left-0 right-0 flex justify-center pointer-events-none z-50 transition-transform duration-200"
 style={{
 top:'env(safe-area-inset-top, 0px)',
 transform: `translateY(${showIndicator ? Math.max(pullDistance - 40, 0) : -60}px)`,
 opacity: indicatorOpacity,
 }}
 >
 <div className="bg-background/95 backdrop-blur-sm rounded-full p-2 shadow-lg border border-border/50">
 <Loader2
 className={cn(
"h-5 w-5 text-primary transition-transform",
 isRefreshing &&"animate-spin"
 )}
 style={{
 transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
 }}
 />
 </div>
 </div>

 {/* Content - transform for visual pull effect only */}
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

PullToRefresh.displayName ='PullToRefresh';

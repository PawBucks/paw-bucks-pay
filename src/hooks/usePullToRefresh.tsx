import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

/**
 * Pull-to-refresh hook that uses document-level touch events
 * to prevent mobile scrolling issues (getting stuck at bottom).
 * 
 * Key fixes:
 * 1. Uses document-level events to avoid container scroll conflicts
 * 2. Only activates when at absolute top (scrollY === 0)
 * 3. Carefully manages preventDefault to not block normal scrolling
 */
export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current scroll position from document level
  const getScrollTop = useCallback(() => {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Only activate at absolute top of document
    const scrollTop = getScrollTop();
    if (scrollTop > 0) {
      isPulling.current = false;
      return;
    }
    
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || !isPulling.current || startY.current === 0) return;
    
    const scrollTop = getScrollTop();
    
    // If user scrolled away from top, cancel pull-to-refresh
    if (scrollTop > 5) {
      isPulling.current = false;
      startY.current = 0;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    
    // Only activate pull-to-refresh when pulling DOWN from top
    if (distance > 10 && scrollTop <= 0) {
      // Prevent default ONLY when we're actively pulling down at top
      // This prevents the browser's native refresh but allows normal scroll
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5));
    } else if (distance <= 0) {
      // User is trying to scroll up normally - allow it
      isPulling.current = false;
      startY.current = 0;
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, threshold, getScrollTop]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    
    if (pullDistance >= threshold && isPulling.current) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    isPulling.current = false;
    startY.current = 0;
    setPullDistance(0);
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    // Use document-level events to avoid container scroll conflicts
    // This is critical for preventing the "stuck at bottom" issue
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    progress: Math.min(pullDistance / threshold, 1),
  };
};

import { useEffect, useCallback } from'react';
import { prefetchCriticalRoutes } from'@/lib/prefetch';

/**
 * Lightweight performance hook - deferred prefetching only
 * Removed redundant PerformanceObservers that added overhead without actionable benefit
 */
export const usePerformance = () => {
 // Prefetch critical routes on idle - single source of truth
 useEffect(() => {
 if ('requestIdleCallback' in window) {
 const id = requestIdleCallback(() => {
 prefetchCriticalRoutes();
 }, { timeout: 3000 });
 return () => cancelIdleCallback(id);
 } else {
 const timer = setTimeout(() => {
 prefetchCriticalRoutes();
 }, 2000);
 return () => clearTimeout(timer);
 }
 }, []);
};

// Prefetch helper for dynamic imports
export const prefetchComponent = (importFn: () => Promise<any>) => {
 if ('requestIdleCallback' in window) {
 requestIdleCallback(() => {
 importFn().catch(() => { /* Ignore prefetch errors */ });
 }, { timeout: 3000 });
 } else {
 setTimeout(() => {
 importFn().catch(() => { /* Ignore prefetch errors */ });
 }, 100);
 }
};

// Hook for intersection-based prefetching
export const usePrefetchOnVisible = (
 importFn: () => Promise<any>,
 options?: IntersectionObserverInit
) => {
 const prefetch = useCallback(() => {
 importFn().catch(() => { /* Ignore prefetch errors */ });
 }, [importFn]);

 const setRef = useCallback((element: HTMLElement | null) => {
 if (!element || !('IntersectionObserver' in window)) {
 return;
 }

 const observer = new IntersectionObserver(
 (entries) => {
 if (entries[0].isIntersecting) {
 prefetch();
 observer.disconnect();
 }
 },
 { rootMargin:'200px', ...options }
 );

 observer.observe(element);
 }, [prefetch, options]);

 return setRef;
};

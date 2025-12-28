import { useEffect, useCallback } from 'react';
import { preloadCriticalRoutes, deferNonCriticalAssets } from '@/lib/pwa-utils';
import { prefetchCriticalRoutes } from '@/lib/prefetch';

/**
 * Enhanced performance monitoring and optimizations
 */
export const usePerformance = () => {
  useEffect(() => {
    // Report Core Web Vitals if available
    if ('PerformanceObserver' in window) {
      try {
        // Monitor Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry && (lastEntry as any).renderTime > 2500) {
            console.warn('[Performance] LCP exceeded 2.5s:', lastEntry);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // Monitor First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).processingStart - (entry as any).startTime > 100) {
              console.warn('[Performance] High FID detected:', entry);
            }
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });

        // Monitor Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          if (clsValue > 0.1) {
            console.warn('[Performance] High CLS detected:', clsValue);
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        // Monitor long tasks (performance degradation)
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('[Performance] Long task detected:', {
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
          longTaskObserver.disconnect();
        };
      } catch (error) {
        // PerformanceObserver not fully supported
        console.debug('[Performance] Observer not supported:', error);
      }
    }
  }, []);

  // Preload critical routes after initial render
  useEffect(() => {
    const initPreload = async () => {
      try {
        await preloadCriticalRoutes();
      } catch (error) {
        console.warn('[Performance] Failed to preload critical routes:', error);
      }
    };

    // Defer preloading until after initial render
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        initPreload();
        deferNonCriticalAssets();
        prefetchCriticalRoutes();
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        initPreload();
        deferNonCriticalAssets();
        prefetchCriticalRoutes();
      }, 2000);
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
      { rootMargin: '200px', ...options }
    );

    observer.observe(element);
  }, [prefetch, options]);

  return setRef;
};

// Memory pressure detection
export const useMemoryPressure = (onHighPressure: () => void) => {
  useEffect(() => {
    if ('memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usedRatio > 0.9) {
          onHighPressure();
        }
      };

      const interval = setInterval(checkMemory, 30000);
      return () => clearInterval(interval);
    }
  }, [onHighPressure]);
};

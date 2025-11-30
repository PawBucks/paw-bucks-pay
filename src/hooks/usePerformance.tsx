import { useEffect } from 'react';
import { preloadCriticalRoutes, deferNonCriticalAssets } from '@/lib/pwa-utils';
import { prefetchCriticalRoutes } from '@/lib/prefetch';

/**
 * Enhanced performance monitoring and optimizations
 */
export const usePerformance = () => {
  useEffect(() => {
    // Report Web Vitals if available
    if ('web-vital' in window) {
      // Performance monitoring would go here
    }

    // Preload critical routes for better navigation
    const initPreload = async () => {
      try {
        await preloadCriticalRoutes();
      } catch (error) {
        console.warn('Failed to preload critical routes:', error);
      }
    };

    // Defer preloading until after initial render
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        initPreload();
        deferNonCriticalAssets();
        prefetchCriticalRoutes(); // Add route prefetching
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        initPreload();
        deferNonCriticalAssets();
        prefetchCriticalRoutes(); // Add route prefetching
      }, 2000);
    }

    // Monitor long tasks (performance degradation)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('Long task detected:', entry);
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        
        return () => observer.disconnect();
      } catch (error) {
        // PerformanceObserver not fully supported
      }
    }
  }, []);
};

// Prefetch helper for dynamic imports
export const prefetchComponent = (importFn: () => Promise<any>) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      importFn();
    });
  } else {
    setTimeout(() => {
      importFn();
    }, 1);
  }
};

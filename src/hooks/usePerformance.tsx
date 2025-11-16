import { useEffect } from 'react';

/**
 * Hook to monitor and optimize performance
 */
export const usePerformance = () => {
  useEffect(() => {
    // Report Web Vitals if available
    if ('web-vital' in window) {
      // Performance monitoring would go here
    }

    // Prefetch critical resources
    const prefetchCritical = () => {
      // Prefetch commonly accessed pages
      const criticalRoutes = ['/dashboard', '/discover', '/profile'];
      
      criticalRoutes.forEach(route => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    };

    // Defer prefetching until after initial render
    requestIdleCallback(prefetchCritical, { timeout: 2000 });
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

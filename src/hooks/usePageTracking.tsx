import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Track page views and navigation for analytics and performance monitoring
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view
    const pageView = {
      path: location.pathname,
      search: location.search,
      timestamp: new Date().toISOString(),
    };

    // Log page navigation (can be extended to send to analytics service)
    if (process.env.NODE_ENV === 'production') {
      console.log('Page view:', pageView);
      // TODO: Send to analytics service (e.g., Google Analytics, Mixpanel)
    }

    // Track performance metrics
    if ('PerformanceObserver' in window) {
      try {
        const perfObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              console.log('Navigation timing:', {
                dns: navEntry.domainLookupEnd - navEntry.domainLookupStart,
                tcp: navEntry.connectEnd - navEntry.connectStart,
                ttfb: navEntry.responseStart - navEntry.requestStart,
                load: navEntry.loadEventEnd - navEntry.loadEventStart,
              });
            }
          }
        });
        perfObserver.observe({ entryTypes: ['navigation'] });
        
        return () => perfObserver.disconnect();
      } catch (error) {
        // PerformanceObserver not fully supported
      }
    }
  }, [location]);
};

/**
 * Prefetch utilities for improving perceived performance
 */

type PrefetchOptions = {
  timeout?: number;
};

/**
 * Prefetch a route by creating a hidden link and triggering a hover/click
 */
export const prefetchRoute = (path: string, options: PrefetchOptions = {}) => {
  const { timeout = 0 } = options;

  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = path;
        document.head.appendChild(link);
      },
      { timeout: timeout || 2000 }
    );
  } else {
    setTimeout(() => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = path;
      document.head.appendChild(link);
    }, timeout);
  }
};

/**
 * Prefetch critical routes on initial load
 */
export const prefetchCriticalRoutes = () => {
  const criticalRoutes = ['/dashboard', '/auth', '/discover', '/wallet'];
  
  criticalRoutes.forEach((route, index) => {
    prefetchRoute(route, { timeout: index * 500 });
  });
};

/**
 * Create a link component that prefetches on hover
 */
export const createPrefetchOnHover = (path: string) => {
  let prefetched = false;
  
  return {
    onMouseEnter: () => {
      if (!prefetched) {
        prefetchRoute(path);
        prefetched = true;
      }
    },
    onTouchStart: () => {
      if (!prefetched) {
        prefetchRoute(path);
        prefetched = true;
      }
    },
  };
};

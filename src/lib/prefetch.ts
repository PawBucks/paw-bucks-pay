/**
 * Prefetch utilities for improving perceived performance
 */

type PrefetchOptions = {
 timeout?: number;
 priority?:'high' |'low';
};

const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route by creating a hidden link and triggering a hover/click
 */
export const prefetchRoute = (path: string, options: PrefetchOptions = {}) => {
 const { timeout = 0, priority ='low' } = options;

 // Skip if already prefetched
 if (prefetchedRoutes.has(path)) return;
 prefetchedRoutes.add(path);

 const createLink = () => {
 const link = document.createElement('link');
 link.rel ='prefetch';
 link.as ='document';
 link.href = path;
 if (priority ==='high') {
 link.setAttribute('fetchpriority','high');
 }
 document.head.appendChild(link);
 };

 if ('requestIdleCallback' in window) {
 requestIdleCallback(
 () => createLink(),
 { timeout: timeout || 2000 }
 );
 } else {
 setTimeout(createLink, timeout);
 }
};

/**
 * Prefetch critical routes on initial load
 */
export const prefetchCriticalRoutes = () => {
 const criticalRoutes = [
 { path:'/dashboard', priority:'high' as const },
 { path:'/auth', priority:'high' as const },
 { path:'/discover', priority:'low' as const },
 { path:'/wallet', priority:'low' as const },
 ];
 
 criticalRoutes.forEach((route, index) => {
 prefetchRoute(route.path, { timeout: index * 500, priority: route.priority });
 });
};

/**
 * Prefetch a module (for lazy-loaded components)
 */
export const prefetchModule = (importFn: () => Promise<any>) => {
 if ('requestIdleCallback' in window) {
 requestIdleCallback(() => {
 importFn().catch(() => {/* Ignore prefetch errors */});
 }, { timeout: 2000 });
 } else {
 setTimeout(() => {
 importFn().catch(() => {/* Ignore prefetch errors */});
 }, 1000);
 }
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

/**
 * Preload critical images for better perceived performance
 */
export const preloadImage = (src: string): Promise<void> => {
 return new Promise((resolve, reject) => {
 const img = new Image();
 img.onload = () => resolve();
 img.onerror = reject;
 img.src = src;
 });
};

/**
 * Batch preload multiple images
 */
export const preloadImages = (srcs: string[]): Promise<void[]> => {
 return Promise.all(srcs.map(preloadImage));
};
/**
 * PWA utilities for enhanced offline support and performance
 */

// Check if app is running as PWA
export const isPWA = (): boolean => {
 return window.matchMedia('(display-mode: standalone)').matches ||
 (window.navigator as any).standalone === true;
};

// Preload critical routes for offline support
export const preloadCriticalRoutes = async () => {
 if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
 const criticalRoutes = ['/dashboard','/discover','/wallet','/profile'];
 
 for (const route of criticalRoutes) {
 try {
 await fetch(route, { 
 method:'GET',
 cache:'no-cache'
 });
 } catch (error) {
 console.warn(`Failed to preload route: ${route}`, error);
 }
 }
 }
};

// Register for background sync
export const registerBackgroundSync = async (tag: string) => {
 if ('serviceWorker' in navigator &&'sync' in ServiceWorkerRegistration.prototype) {
 try {
 const registration = await navigator.serviceWorker.ready;
 await (registration as any).sync.register(tag);
 } catch (error) {
 console.warn('Background sync registration failed:', error);
 }
 }
};

// Check if device is online
export const isOnline = (): boolean => {
 return navigator.onLine;
};

// Monitor network status
export const onNetworkChange = (callback: (isOnline: boolean) => void) => {
 const handleOnline = () => callback(true);
 const handleOffline = () => callback(false);
 
 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);
 
 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
};

// Defer non-critical assets
export const deferNonCriticalAssets = () => {
 if ('requestIdleCallback' in window) {
 requestIdleCallback(() => {
 // Preload non-critical images
 const images = document.querySelectorAll('img[data-defer]');
 images.forEach(img => {
 const src = img.getAttribute('data-defer');
 if (src) {
 img.setAttribute('src', src);
 img.removeAttribute('data-defer');
 }
 });
 }, { timeout: 2000 });
 }
};

// Auto-update when new service worker is available
export const checkForUpdates = async (callback: () => void) => {
 if ('serviceWorker' in navigator) {
 const registration = await navigator.serviceWorker.getRegistration();
 if (registration) {
 registration.addEventListener('updatefound', () => {
 const newWorker = registration.installing;
 if (newWorker) {
 newWorker.addEventListener('statechange', () => {
 if (newWorker.state ==='installed' && navigator.serviceWorker.controller) {
 // Auto-reload to activate new version
 console.log('[PWA] New version detected, auto-updating...');
 window.location.reload();
 }
 });
 }
 });
 }
 }
};

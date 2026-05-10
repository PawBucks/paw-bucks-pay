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
 hardReload();
 }
 });
 }
 });

      // Actively poll for updates so users don't sit on stale builds.
      const triggerUpdate = () => {
        // Guard: update() throws InvalidStateError if no worker installed yet.
        if (!registration.installing && !registration.waiting && !registration.active) return;
        registration.update().catch(() => {
          // Benign — typically "newestWorker is null" on first load.
        });
      };

      // Check immediately, then every 30 seconds.
      triggerUpdate();
      const interval = window.setInterval(triggerUpdate, 30_000);

      // Check whenever the tab regains focus / visibility (covers users who
      // leave the tab open for hours/days).
      const onVisible = () => {
        if (document.visibilityState === 'visible') triggerUpdate();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', triggerUpdate);
      window.addEventListener('online', triggerUpdate);

      // When a new SW takes control, force a reload so all open tabs sync.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('[PWA] Controller changed, reloading for fresh version...');
        hardReload();
      });

      return () => {
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', triggerUpdate);
        window.removeEventListener('online', triggerUpdate);
      };
 }
 }
};

// Force a cache-busting reload so the browser refetches HTML + assets.
const hardReload = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

// Fallback for non-PWA / no-SW environments: poll index.html and detect a new
// build by hashing its contents. If the hash changes, hard-reload.
export const startBuildVersionPolling = () => {
  if (typeof window === 'undefined') return;

  let lastHash: string | null = null;
  let stopped = false;

  const hashString = async (s: string) => {
    if (window.crypto?.subtle) {
      const buf = new TextEncoder().encode(s);
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Cheap fallback hash
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return String(h);
  };

  const check = async () => {
    if (stopped || document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/index.html', { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      const hash = await hashString(text);
      if (lastHash && lastHash !== hash) {
        console.log('[PWA] New build detected via index.html hash, reloading...');
        stopped = true;
        hardReload();
        return;
      }
      lastHash = hash;
    } catch (err) {
      // Network failures are fine; try again later.
    }
  };

  check();
  const interval = window.setInterval(check, 30_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);

  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', check);
    window.removeEventListener('online', check);
  };
};

import { useEffect } from'react';
import { isPWA } from'@/lib/pwa-utils';

/**
 * Apply mobile-specific optimizations and PWA enhancements
 */
export const useMobileOptimizations = () => {
 useEffect(() => {
 // Disable pull-to-refresh on mobile PWA
 if (isPWA()) {
 document.body.style.overscrollBehavior ='none';
 }

 // Prevent iOS zoom on input focus
 const metaViewport = document.querySelector('meta[name="viewport"]');
 if (metaViewport && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
 metaViewport.setAttribute(
'content',
'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
 );
 }

 // Better touch scrolling on iOS
 (document.body.style as any).webkitOverflowScrolling ='touch';

 // Optimize animations on low-end devices
 const connection = (navigator as any).connection;
 if (connection && (connection.saveData || connection.effectiveType ==='slow-2g')) {
 document.documentElement.classList.add('reduce-motion');
 }
 }, []);
};

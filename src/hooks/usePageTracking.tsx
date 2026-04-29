import { useEffect, useRef } from'react';
import { useLocation } from'react-router-dom';

/**
 * Lightweight page view tracking - no heavy observers per route change
 */
export const usePageTracking = () => {
 const location = useLocation();
 const isFirstRender = useRef(true);

 useEffect(() => {
 // Skip logging on first render (already tracked by initial load)
 if (isFirstRender.current) {
 isFirstRender.current = false;
 return;
 }

 // Track page view - lightweight, no observers
 if (process.env.NODE_ENV ==='production') {
 // Future: send to analytics service
 }
 }, [location.pathname]);
};

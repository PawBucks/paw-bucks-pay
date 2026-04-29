import { useState, useEffect } from'react';

// Responsive design hook for viewport-based rendering
export const useMediaQuery = (query: string): boolean => {
 const [matches, setMatches] = useState(() => {
 if (typeof window !=='undefined') {
 return window.matchMedia(query).matches;
 }
 return false;
 });

 useEffect(() => {
 const mediaQuery = window.matchMedia(query);
 
 const handleChange = (e: MediaQueryListEvent) => {
 setMatches(e.matches);
 };

 // Modern browsers
 mediaQuery.addEventListener('change', handleChange);

 return () => {
 mediaQuery.removeEventListener('change', handleChange);
 };
 }, [query]);

 return matches;
};

// Predefined breakpoints
export const useBreakpoint = () => {
 const isMobile = useMediaQuery('(max-width: 640px)');
 const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
 const isDesktop = useMediaQuery('(min-width: 1025px)');

 return {
 isMobile,
 isTablet,
 isDesktop,
 };
};

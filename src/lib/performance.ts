/**
 * Advanced image optimization utilities
 */

// Determine optimal image format based on browser support
export const getSupportedImageFormat = (): string => {
 const canvas = document.createElement('canvas');
 if (canvas.getContext && canvas.getContext('2d')) {
 // Check for WebP support
 if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
 return'webp';
 }
 // Check for AVIF support
 if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
 return'avif';
 }
 }
 return'jpg';
};

// Enhanced image optimization
export const optimizeImage = (url: string, width?: number, quality: number = 80): string => {
 if (!url) return url;
 
 // Add optimization parameters for Supabase storage
 if (width && url.includes('supabase')) {
 const format = getSupportedImageFormat();
 const separator = url.includes('?') ?'&' :'?';
 return `${url}${separator}width=${width}&quality=${quality}&format=${format}`;
 }
 
 return url;
};

// Generate responsive image srcset
export const generateSrcSet = (url: string, sizes: number[] = [320, 640, 960, 1280]): string => {
 if (!url) return'';
 
 return sizes
 .map(size => `${optimizeImage(url, size)} ${size}w`)
 .join(',');
};

// Lazy load images with Intersection Observer
export const lazyLoadImage = (img: HTMLImageElement, options?: IntersectionObserverInit) => {
 if ('loading' in HTMLImageElement.prototype) {
 img.loading ='lazy';
 } else {
 // Fallback for browsers that don't support lazy loading
 if ('IntersectionObserver' in window) {
 const observer = new IntersectionObserver((entries) => {
 entries.forEach(entry => {
 if (entry.isIntersecting) {
 const image = entry.target as HTMLImageElement;
 const src = image.dataset.src;
 const srcset = image.dataset.srcset;
 
 if (src) image.src = src;
 if (srcset) image.srcset = srcset;
 
 observer.unobserve(image);
 }
 });
 }, options || {
 rootMargin:'50px 0px',
 threshold: 0.01
 });
 observer.observe(img);
 }
 }
};

// Preload critical images
export const preloadCriticalResources = () => {
 const criticalImages = document.querySelectorAll('[data-critical]');
 criticalImages.forEach(img => {
 const link = document.createElement('link');
 link.rel ='preload';
 link.as ='image';
 link.href = (img as HTMLImageElement).src;
 if ((img as HTMLImageElement).srcset) {
 link.setAttribute('imagesrcset', (img as HTMLImageElement).srcset);
 }
 document.head.appendChild(link);
 });
};

// Check if device is low-end
export const isLowEndDevice = (): boolean => {
 // Check for reduced motion preference
 if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
 return true;
 }

 // Check device memory (if available)
 const memory = (navigator as any).deviceMemory;
 if (memory && memory < 4) {
 return true;
 }

 // Check number of CPU cores
 const cores = navigator.hardwareConcurrency;
 if (cores && cores < 4) {
 return true;
 }

 return false;
};

// Adaptive loading based on connection
export const shouldReduceData = (): boolean => {
 const connection = (navigator as any).connection;
 
 if (!connection) return false;

 // Reduce data on slow connections
 if (connection.saveData) return true;
 if (connection.effectiveType ==='slow-2g' || connection.effectiveType ==='2g') return true;

 return false;
};

// Get optimal image quality based on network and device
export const getOptimalQuality = (): number => {
 if (shouldReduceData()) return 60;
 if (isLowEndDevice()) return 70;
 return 80;
};

// Progressive image loading
export const loadProgressiveImage = (
 container: HTMLElement,
 lowResSrc: string,
 highResSrc: string
) => {
 const img = new Image();
 const lowResImg = new Image();
 
 // Load low-res first
 lowResImg.src = lowResSrc;
 lowResImg.classList.add('blur-sm','transition-all','duration-300');
 container.appendChild(lowResImg);
 
 // Load high-res in background
 img.onload = () => {
 img.classList.add('transition-all','duration-300');
 container.appendChild(img);
 setTimeout(() => {
 lowResImg.remove();
 }, 300);
 };
 img.src = highResSrc;
};

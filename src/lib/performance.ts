/**
 * Performance optimization utilities
 */

// Image optimization
export const optimizeImage = (url: string, width?: number): string => {
  if (!url) return url;
  
  // Add width parameter for better loading
  if (width && url.includes('supabase')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${width}&quality=80`;
  }
  
  return url;
};

// Lazy load images
export const lazyLoadImage = (img: HTMLImageElement) => {
  if ('loading' in HTMLImageElement.prototype) {
    img.loading = 'lazy';
  } else {
    // Fallback for browsers that don't support lazy loading
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const image = entry.target as HTMLImageElement;
            image.src = image.dataset.src || '';
            observer.unobserve(image);
          }
        });
      });
      observer.observe(img);
    }
  }
};

// Preload critical resources
export const preloadCriticalResources = () => {
  const criticalImages = document.querySelectorAll('[data-critical]');
  criticalImages.forEach(img => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = (img as HTMLImageElement).src;
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
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') return true;

  return false;
};

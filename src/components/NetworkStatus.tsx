import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Network status indicator for PWA
 */
export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide after coming back online
  useEffect(() => {
    if (isOnline && showOffline) {
      const timer = setTimeout(() => setShowOffline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOffline]);

  if (!showOffline) return null;

  return (
    <div
      className={cn(
        "fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300",
        isOnline 
          ? "bg-accent/90 text-accent-foreground animate-fade-in" 
          : "bg-destructive/90 text-destructive-foreground animate-scale-in"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You're offline</span>
          </>
        )}
      </div>
    </div>
  );
};

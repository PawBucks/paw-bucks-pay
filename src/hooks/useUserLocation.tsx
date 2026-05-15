import { useCallback, useState } from "react";
import { toast } from "sonner";

export type UserLocation = { latitude: number; longitude: number } | null;

/**
 * Browser geolocation hook with high-accuracy → low-accuracy fallback
 * and friendly toasts. Returns the resolved coords or null.
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser";
      setLocationError(msg);
      toast.error(msg);
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    const onSuccess = (position: GeolocationPosition) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationLoading(false);
      toast.success("Location found! Showing nearby merchants.");
    };

    const onError = (error: GeolocationPositionError) => {
      // Retry without high accuracy if position is unavailable
      if (error.code === error.POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryError) => {
            setLocationLoading(false);
            let msg = "Unable to get your location";
            if (retryError.code === retryError.PERMISSION_DENIED) {
              msg = "Location access denied. Enable location in your browser settings.";
            } else if (retryError.code === retryError.POSITION_UNAVAILABLE) {
              msg = "Location unavailable. Check your browser's location settings.";
            } else if (retryError.code === retryError.TIMEOUT) {
              msg = "Location request timed out. Please try again.";
            }
            setLocationError(msg);
            toast.error(msg);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
        );
        return;
      }

      setLocationLoading(false);
      let msg = "Unable to get your location";
      if (error.code === error.PERMISSION_DENIED) {
        msg = "Location access denied. Enable location in your browser settings.";
      } else if (error.code === error.TIMEOUT) {
        msg = "Location request timed out. Please try again.";
      }
      setLocationError(msg);
      toast.error(msg);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  }, []);

  return { userLocation, locationLoading, locationError, requestLocation };
}
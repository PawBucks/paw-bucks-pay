import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  formattedAddress?: string;
  error?: string;
}

/**
 * Hook for geocoding addresses using Mapbox API via edge function
 */
export const useGeocoding = () => {
  const geocodeAddress = useCallback(async (
    address: string, 
    merchantId?: string
  ): Promise<GeocodeResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address, merchantId },
      });

      if (error) {
        console.error('Geocoding error:', error);
        return { latitude: null, longitude: null, error: error.message };
      }

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        formattedAddress: data.formattedAddress,
        error: data.error,
      };
    } catch (error) {
      console.error('Geocoding failed:', error);
      return { 
        latitude: null, 
        longitude: null, 
        error: 'Failed to geocode address' 
      };
    }
  }, []);

  return { geocodeAddress };
};

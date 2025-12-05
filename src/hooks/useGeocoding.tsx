import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  formattedAddress?: string;
  error?: string;
}

/**
 * Hook for geocoding addresses using Mapbox API via edge function.
 * Merchant coordinate updates are handled through authenticated Supabase client.
 */
export const useGeocoding = () => {
  const geocodeAddress = useCallback(async (
    address: string, 
    merchantId?: string
  ): Promise<GeocodeResult> => {
    try {
      // Call the public geocode endpoint (address lookup only)
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address },
      });

      if (error) {
        console.error('Geocoding error:', error);
        return { latitude: null, longitude: null, error: error.message };
      }

      const result: GeocodeResult = {
        latitude: data.latitude,
        longitude: data.longitude,
        formattedAddress: data.formattedAddress,
        error: data.error,
      };

      // If merchantId provided and we got valid coordinates, update via authenticated client
      if (merchantId && result.latitude !== null && result.longitude !== null) {
        const { error: updateError } = await supabase
          .from('merchants')
          .update({ 
            latitude: result.latitude, 
            longitude: result.longitude 
          })
          .eq('id', merchantId);

        if (updateError) {
          console.error('Failed to update merchant coordinates:', updateError);
          // Return the geocode result even if update failed
          // The update will only succeed if the user owns the merchant (RLS)
        } else {
          console.log(`Updated merchant ${merchantId} with coordinates`);
        }
      }

      return result;
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

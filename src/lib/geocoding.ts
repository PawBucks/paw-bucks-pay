import { supabase } from "@/integrations/supabase/client";

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address }
    });

    if (error) {
      console.error('Geocoding failed:', error);
      return null;
    }

    if (data && data.lat && data.lng) {
      return { lat: data.lat, lng: data.lng };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantBookingIntegration } from "@/components/scheduling/externalBookingProviders";

/**
 * Fetches a merchant's enabled external booking/calendar integration (Calendly,
 * Cal.com, Acuity, PetDesk, or a custom link). Returns null when the merchant
 * has not connected one — callers should then fall back to in-app booking.
 */
export function useExternalBooking(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchant-booking-integration", merchantId],
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<MerchantBookingIntegration | null> => {
      if (!merchantId) return null;
      const { data, error } = await supabase
        .from("merchant_booking_integrations")
        .select("id, merchant_id, provider, booking_url, display_label, is_enabled, replace_in_app_booking")
        .eq("merchant_id", merchantId)
        .eq("is_enabled", true)
        .maybeSingle();

      if (error) {
        console.error("Failed to load booking integration:", error);
        return null;
      }
      return (data as MerchantBookingIntegration | null) ?? null;
    },
  });
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandOption {
  id: string;
  brand_name: string;
}

/**
 * All active brand accounts. Used by admin-level editors (e.g. global
 * pet-store catalog) where any brand can be tagged on an item.
 */
export function useAllActiveBrands() {
  return useQuery<BrandOption[]>({
    queryKey: ["brands", "all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_accounts")
        .select("id, brand_name")
        .eq("status", "active")
        .order("brand_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BrandOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Brands the given merchant is actively enrolled in via brand_campaign_merchants.
 * Returns deduped brand list (a merchant may be in multiple campaigns for the
 * same brand). Used by merchant-side editors (services, invoice catalog).
 */
export function useMerchantEnrolledBrands(merchantId: string | null | undefined) {
  return useQuery<BrandOption[]>({
    queryKey: ["brands", "merchant-enrolled", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_campaign_merchants")
        .select(
          "status, brand_campaigns!inner(brand_id, status, brand_accounts!inner(id, brand_name, status))"
        )
        .eq("merchant_id", merchantId!)
        .eq("status", "active");
      if (error) throw error;
      const map = new Map<string, BrandOption>();
      for (const row of (data ?? []) as any[]) {
        const ba = row?.brand_campaigns?.brand_accounts;
        const campaignStatus = row?.brand_campaigns?.status;
        if (!ba || ba.status !== "active" || campaignStatus !== "active") continue;
        if (!map.has(ba.id)) map.set(ba.id, { id: ba.id, brand_name: ba.brand_name });
      }
      return Array.from(map.values()).sort((a, b) =>
        a.brand_name.localeCompare(b.brand_name),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
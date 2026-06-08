import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MerchantBrandedBalance {
  campaign_id: string;
  campaign_name: string;
  brand_id: string;
  brand_name: string;
  balance_pb: number;
  enforce_product_gate: boolean;
}

/**
 * Branded PawBucks balances the current user can spend at a specific merchant.
 * Filters to campaigns where the merchant is actively enrolled and the user
 * has > 0 balance. Used to render per-brand eligibility chips in the cart.
 */
export function useMerchantBrandedBalances(
  userId: string | null | undefined,
  merchantId: string | null | undefined,
) {
  return useQuery<MerchantBrandedBalance[]>({
    queryKey: ["branded-pb-balances", userId, merchantId],
    enabled: !!userId && !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branded_pawbucks_ledger")
        .select(
          "balance, campaign_id, brand_campaigns!inner(id, name, status, enforce_product_gate, brand_id, brand_accounts!inner(id, brand_name, status), brand_campaign_merchants!inner(merchant_id, status))",
        )
        .eq("user_id", userId!)
        .gt("balance", 0);
      if (error) throw error;
      const out: MerchantBrandedBalance[] = [];
      for (const row of (data ?? []) as any[]) {
        const c = row.brand_campaigns;
        if (!c || c.status !== "active") continue;
        const ba = c.brand_accounts;
        if (!ba || ba.status !== "active") continue;
        const enrolled = (c.brand_campaign_merchants ?? []).some(
          (m: any) => m.merchant_id === merchantId && (m.status ?? "active") === "active",
        );
        if (!enrolled) continue;
        out.push({
          campaign_id: c.id,
          campaign_name: c.name,
          brand_id: c.brand_id,
          brand_name: ba.brand_name,
          balance_pb: Number(row.balance) || 0,
          enforce_product_gate: c.enforce_product_gate !== false,
        });
      }
      return out;
    },
    staleTime: 30 * 1000,
  });
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MerchantContext = {
  merchantId?: string;
  businessName?: string;
  hasStripeAccount: boolean;
  loading: boolean;
};

/** Lightweight helper used by Merchant Workspace pages to fetch the current
 *  merchant id + name for the signed-in user. */
export function useMerchantContext(): MerchantContext {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<MerchantContext>({
    merchantId: undefined,
    businessName: undefined,
    hasStripeAccount: false,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("merchants")
        .select("id, business_name, stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setState({
        merchantId: data?.id,
        businessName: data?.business_name ?? undefined,
        hasStripeAccount: !!data?.stripe_account_id,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserPromotion = {
  promotion_id: string;
  expires_at: string;
  promotion: {
    id: string;
    name: string;
    discount_percentage: number;
    duration_hours: number;
    guilt_badge_definitions: {
      emoji: string;
      name: string;
    } | null;
    badge_promotion_items: {
      item_id: string;
    }[];
  };
};

export type PromotionalItemInfo = {
  itemId: string;
  discountPercentage: number;
  badgeEmoji: string;
  badgeName: string;
  expiresAt: string;
  promotionName: string;
};

export function usePromotionalItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-promotional-items", userId],
    queryFn: async () => {
      if (!userId) return { promotions: [], itemMap: new Map<string, PromotionalItemInfo>() };

      // Get user's active promotions (not used and not expired)
      const { data: userPromotions, error } = await supabase
        .from("user_badge_promotions")
        .select(`
          promotion_id,
          expires_at,
          badge_promotions:promotion_id (
            id,
            name,
            discount_percentage,
            duration_hours,
            guilt_badge_definitions (
              emoji,
              name
            ),
            badge_promotion_items (
              item_id
            )
          )
        `)
        .eq("user_id", userId)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString());

      if (error) {
        console.error("Error fetching promotional items:", error);
        return { promotions: [], itemMap: new Map<string, PromotionalItemInfo>() };
      }

      // Build a map of item_id -> best promotion info
      const itemMap = new Map<string, PromotionalItemInfo>();

      for (const up of userPromotions || []) {
        const promo = up.badge_promotions as any;
        if (!promo) continue;

        const badge = promo.guilt_badge_definitions;
        const items = promo.badge_promotion_items || [];

        for (const item of items) {
          const existing = itemMap.get(item.item_id);
          // Keep the better discount if there are multiple promotions for the same item
          if (!existing || promo.discount_percentage > existing.discountPercentage) {
            itemMap.set(item.item_id, {
              itemId: item.item_id,
              discountPercentage: promo.discount_percentage,
              badgeEmoji: badge?.emoji || "🎉",
              badgeName: badge?.name || "Special",
              expiresAt: up.expires_at,
              promotionName: promo.name,
            });
          }
        }
      }

      return { 
        promotions: userPromotions || [], 
        itemMap 
      };
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute to update expiry times
  });
}


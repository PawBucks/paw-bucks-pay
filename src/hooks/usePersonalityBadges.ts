import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PersonalityBadge {
  id: string;
  pet_id: string;
  personality_type: string;
  badge_earned_at: string;
  is_displayed: boolean;
  personality_data?: {
    name: string;
    emoji: string;
    tagline: string;
    color_primary: string;
    color_secondary: string;
    badge_text: string;
  };
}

export const usePersonalityBadges = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["personality-badges", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's personality badges
      const { data: badges, error } = await supabase
        .from("user_personality_badges")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      // Enrich with personality type data
      const enrichedBadges: PersonalityBadge[] = [];
      
      for (const badge of badges || []) {
        const { data: typeData } = await supabase
          .from("pet_personality_types")
          .select("name, emoji, tagline, color_primary, color_secondary, badge_text")
          .eq("type_key", badge.personality_type)
          .single();

        enrichedBadges.push({
          ...badge,
          personality_data: typeData || undefined,
        });
      }

      return enrichedBadges;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const usePetPersonality = (petId: string | undefined) => {
  return useQuery({
    queryKey: ["pet-personality", petId],
    queryFn: async () => {
      if (!petId) return null;

      const { data: pet, error } = await supabase
        .from("pet_profiles")
        .select("personality_type, personality_quiz_completed")
        .eq("id", petId)
        .single();

      if (error || !pet?.personality_type) return null;

      const { data: typeData } = await supabase
        .from("pet_personality_types")
        .select("*")
        .eq("type_key", pet.personality_type)
        .single();

      return typeData;
    },
    enabled: !!petId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

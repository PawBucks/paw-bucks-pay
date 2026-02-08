import { supabase, ServiceResult, ServiceListResult } from "./base.service";
import type { Json } from "@/integrations/supabase/types";

// Types for loyalty system
export interface ConsumerTierDefinition {
  id: string;
  tier: 'silver' | 'gold' | 'platinum';
  display_name: string;
  emoji: string;
  description: string;
  min_consecutive_months: number;
  min_badges_per_year: number;
  min_transactions_per_year: number;
  annual_free_credit_value: number;
  priority_offers: boolean;
  exclusive_perks: Json;
  reward_multiplier: number;
}

export interface UserTierStatus {
  id: string;
  user_id: string;
  current_tier: 'silver' | 'gold' | 'platinum';
  tier_start_date: string;
  consecutive_active_months: number;
  last_active_month: string | null;
  badges_earned_this_year: number;
  transactions_this_year: number;
  tier_paused: boolean;
  tier_paused_at: string | null;
}

export interface LoyaltyMilestone {
  id: string;
  user_id: string;
  merchant_id: string | null;
  milestone_type: string;
  target_count: number;
  current_count: number;
  period_start: string;
  period_end: string;
  credit_value: number;
  platform_contribution: number;
  merchant_contribution: number;
  status: string;
  completed_at: string | null;
  merchants?: { business_name: string; logo_url: string | null } | null;
}

export interface ServiceCredit {
  id: string;
  user_id: string;
  merchant_id: string | null;
  source_type: string;
  source_id: string | null;
  credit_value: number;
  remaining_value: number;
  description: string;
  expires_at: string;
  status: string;
  merchants?: { business_name: string; logo_url: string | null } | null;
}

export interface PersonalityPerk {
  id: string;
  personality_type: string;
  perk_type: string;
  name: string;
  description: string;
  emoji: string;
  perk_value: number | null;
  perk_value_type: string;
  service_category: string | null;
}

export interface UserPersonalityPerk {
  id: string;
  user_id: string;
  pet_id: string | null;
  perk_id: string;
  eligible_at: string;
  expires_at: string;
  status: string;
  claimed_at: string | null;
  personality_perks?: PersonalityPerk | null;
}

export interface BadgeCollection {
  id: string;
  name: string;
  description: string;
  emoji: string;
  start_date: string | null;
  end_date: string | null;
  is_seasonal: boolean;
  completion_reward_type: string | null;
  completion_reward_value: number | null;
  completion_reward_description: string | null;
  is_active: boolean;
}

export interface UserBadgeStreak {
  id: string;
  user_id: string;
  streak_type: string;
  current_streak: number;
  longest_streak: number;
  last_earned_date: string | null;
  streak_start_date: string | null;
}

export interface LoyaltyWarning {
  id: string;
  user_id: string;
  warning_type: string;
  message: string;
  urgency: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_deadline: string | null;
  is_dismissed: boolean;
}

export const loyaltyService = {
  // Tier System
  async getTierDefinitions(): Promise<ServiceListResult<ConsumerTierDefinition>> {
    const { data, error } = await supabase
      .from("consumer_tier_definitions")
      .select("*")
      .order("min_consecutive_months");
    return { data: data || [], error };
  },

  async getUserTierStatus(userId: string): Promise<ServiceResult<UserTierStatus>> {
    const { data, error } = await supabase
      .from("user_tier_status")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { data, error };
  },

  // Milestones (Loyal Pet Parent Guarantee)
  async getUserMilestones(userId: string): Promise<ServiceListResult<LoyaltyMilestone>> {
    const { data, error } = await supabase
      .from("loyalty_milestones")
      .select("*, merchants(business_name, logo_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  async getActiveMilestones(userId: string): Promise<ServiceListResult<LoyaltyMilestone>> {
    const { data, error } = await supabase
      .from("loyalty_milestones")
      .select("*, merchants(business_name, logo_url)")
      .eq("user_id", userId)
      .in("status", ["in_progress", "completed"])
      .order("period_end");
    return { data: data || [], error };
  },

  // Service Credits
  async getUserCredits(userId: string): Promise<ServiceListResult<ServiceCredit>> {
    const { data, error } = await supabase
      .from("service_credits")
      .select("*, merchants(business_name, logo_url)")
      .eq("user_id", userId)
      .in("status", ["active", "partially_used"])
      .order("expires_at");
    return { data: data || [], error };
  },

  async getAllUserCredits(userId: string): Promise<ServiceListResult<ServiceCredit>> {
    const { data, error } = await supabase
      .from("service_credits")
      .select("*, merchants(business_name, logo_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data: data || [], error };
  },

  // Personality Perks
  async getPersonalityPerks(personalityType: string): Promise<ServiceListResult<PersonalityPerk>> {
    const { data, error } = await supabase
      .from("personality_perks")
      .select("*")
      .eq("personality_type", personalityType)
      .eq("is_active", true);
    return { data: data || [], error };
  },

  async getUserPersonalityPerks(userId: string): Promise<ServiceListResult<UserPersonalityPerk>> {
    const { data, error } = await supabase
      .from("user_personality_perks")
      .select("*, personality_perks(*)")
      .eq("user_id", userId)
      .order("expires_at");
    return { data: data || [], error };
  },

  async getAvailablePerks(userId: string): Promise<ServiceListResult<UserPersonalityPerk>> {
    const { data, error } = await supabase
      .from("user_personality_perks")
      .select("*, personality_perks(*)")
      .eq("user_id", userId)
      .eq("status", "available")
      .gte("expires_at", new Date().toISOString());
    return { data: data || [], error };
  },

  // Badge Collections
  async getBadgeCollections(): Promise<ServiceListResult<BadgeCollection>> {
    const { data, error } = await supabase
      .from("badge_collections")
      .select("*")
      .eq("is_active", true);
    return { data: data || [], error };
  },

  // Badge Streaks
  async getUserStreaks(userId: string): Promise<ServiceListResult<UserBadgeStreak>> {
    const { data, error } = await supabase
      .from("user_badge_streaks")
      .select("*")
      .eq("user_id", userId);
    return { data: data || [], error };
  },

  // Loyalty Warnings
  async getActiveWarnings(userId: string): Promise<ServiceListResult<LoyaltyWarning>> {
    const { data, error } = await supabase
      .from("loyalty_warnings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_dismissed", false)
      .order("urgency", { ascending: false });
    return { data: data || [], error };
  },

  async dismissWarning(warningId: string): Promise<ServiceResult<LoyaltyWarning>> {
    const { data, error } = await supabase
      .from("loyalty_warnings")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq("id", warningId)
      .select()
      .single();
    return { data, error };
  },

  // Summary for dashboard
  async getLoyaltySummary(userId: string) {
    const [tierStatus, milestones, credits, warnings, streaks] = await Promise.all([
      this.getUserTierStatus(userId),
      this.getActiveMilestones(userId),
      this.getUserCredits(userId),
      this.getActiveWarnings(userId),
      this.getUserStreaks(userId),
    ]);

    // Calculate next milestone progress
    const activeMilestone = milestones.data?.find(m => m.status === 'in_progress');
    const completedMilestone = milestones.data?.find(m => m.status === 'completed');

    // Total available credit value
    const totalCreditValue = (credits.data || []).reduce(
      (sum, c) => sum + c.remaining_value, 
      0
    );

    // Get monthly streak
    const monthlyStreak = streaks.data?.find(s => s.streak_type === 'monthly');

    return {
      tier: tierStatus.data,
      activeMilestone,
      completedMilestone,
      totalCredits: totalCreditValue,
      activeCreditsCount: credits.data?.length || 0,
      urgentWarnings: (warnings.data || []).filter(w => w.urgency === 'critical' || w.urgency === 'high'),
      monthlyStreak: monthlyStreak?.current_streak || 0,
    };
  },
};

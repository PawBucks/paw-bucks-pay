import { supabase } from "@/integrations/supabase/client";

export type RecipientType = "merchant" | "vet" | "both";
export type PromotionStatus = "draft" | "active" | "archived";
export type InvitationStatus = "pending" | "accepted" | "declined";

export interface PlatformPromotion {
  id: string;
  title: string;
  description: string | null;
  perks: string | null;
  reward_amount_usd: number | null;
  recipient_type: RecipientType;
  status: PromotionStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformPromotionInvitation {
  id: string;
  promotion_id: string;
  recipient_type: "merchant" | "vet";
  recipient_id: string;
  message: string | null;
  status: InvitationStatus;
  invited_by: string;
  invited_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined / hydrated
  promotion?: PlatformPromotion;
  recipient_name?: string;
}

export const listPromotions = async () => {
  return await supabase
    .from("platform_promotions" as any)
    .select("*")
    .order("created_at", { ascending: false });
};

export const createPromotion = async (input: Partial<PlatformPromotion>) => {
  const { data: u } = await supabase.auth.getUser();
  return await supabase
    .from("platform_promotions" as any)
    .insert({
      title: input.title!,
      description: input.description ?? null,
      perks: input.perks ?? null,
      reward_amount_usd: input.reward_amount_usd ?? null,
      recipient_type: input.recipient_type ?? "both",
      status: input.status ?? "active",
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      created_by: u.user?.id,
    } as any)
    .select()
    .single();
};

export const updatePromotion = async (id: string, patch: Partial<PlatformPromotion>) => {
  return await supabase.from("platform_promotions" as any).update(patch as any).eq("id", id).select().single();
};

export const archivePromotion = async (id: string) => {
  return await supabase.from("platform_promotions" as any).update({ status: "archived" } as any).eq("id", id);
};

export const listInvitationsForPromotion = async (promotionId: string) => {
  return await supabase
    .from("platform_promotion_invitations" as any)
    .select("*")
    .eq("promotion_id", promotionId)
    .order("invited_at", { ascending: false });
};

export const bulkInviteToPromotion = async (params: {
  promotion_id: string;
  recipient_type: "merchant" | "vet";
  scope: "all" | "specific";
  recipient_ids?: string[];
  message?: string;
}) => {
  return await supabase.rpc("bulk_invite_to_promotion" as any, {
    p_promotion_id: params.promotion_id,
    p_recipient_type: params.recipient_type,
    p_scope: params.scope,
    p_recipient_ids: params.recipient_ids ?? null,
    p_message: params.message ?? null,
  });
};

// --- Recipient (merchant / vet) helpers ---

export const getMerchantPromotionInvitations = async (merchantId: string) => {
  return await supabase
    .from("platform_promotion_invitations" as any)
    .select("*, promotion:platform_promotions(*)")
    .eq("recipient_type", "merchant")
    .eq("recipient_id", merchantId)
    .order("invited_at", { ascending: false });
};

export const getVetPromotionInvitations = async (vetId: string) => {
  return await supabase
    .from("platform_promotion_invitations" as any)
    .select("*, promotion:platform_promotions(*)")
    .eq("recipient_type", "vet")
    .eq("recipient_id", vetId)
    .order("invited_at", { ascending: false });
};

export const respondToPromotionInvitation = async (invitationId: string, accept: boolean) => {
  return await supabase.rpc("respond_to_promotion_invitation" as any, {
    p_invitation_id: invitationId,
    p_accept: accept,
  });
};

// Lookup helpers for admin UI (search merchants / vets)
export const searchMerchants = async (q: string) => {
  let qb = supabase.from("merchants").select("id, business_name, email").order("business_name").limit(50);
  if (q.trim()) qb = qb.ilike("business_name", `%${q}%`);
  return await qb;
};

export const searchPartnerVets = async (q: string) => {
  let qb = supabase.from("partner_vets").select("id, name, clinic_name, contact_email").order("name").limit(50);
  if (q.trim()) qb = qb.ilike("name", `%${q}%`);
  return await qb;
};
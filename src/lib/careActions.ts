import { supabase } from "@/integrations/supabase/client";

export type CareAction = "view" | "save" | "directions" | "contact" | "call" | "website" | "inquire" | "rsvp" | "book" | "share";
export type CareTarget = "merchant" | "guide_place" | "event" | "community_post" | "vet";

const recent = new Map<string, number>();

/** Fire-and-forget logging of discovery-to-action events. Never throws. */
export async function trackCareAction(action: CareAction, targetType: CareTarget, targetId: string, opts: { merchantId?: string | null; source?: string } = {}) {
  try {
    if (!targetId) return;
    const key = `${action}:${targetType}:${targetId}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - 30_000) return; // dedupe rapid repeats
    recent.set(key, now);
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    await supabase.from("care_action_events").insert({
      user_id: uid, action, target_type: targetType, target_id: targetId.slice(0, 120),
      merchant_id: opts.merchantId ?? null, source: opts.source?.slice(0, 60) ?? null,
    });
  } catch { /* analytics must never break UX */ }
}

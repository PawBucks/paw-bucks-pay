import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "petfest_bonus_reservation";

export interface PetFestBonusReservation {
  token: string;
  expiresAt: string;
  amount: number;
  email?: string;
}

export const savePetFestBonus = (reservation: PetFestBonusReservation) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservation));
  } catch {
    /* storage unavailable — bonus can still be claimed from the success page session */
  }
};

export const readPetFestBonus = (): PetFestBonusReservation | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PetFestBonusReservation;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
};

export const clearPetFestBonus = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};

/** Fire-and-forget funnel analytics for the PetFest bonus offer. */
export const trackPetFestBonusEvent = (
  eventType: "cta_click" | "signup_started",
  metadata?: Record<string, unknown>,
) => {
  const reservation = readPetFestBonus();
  supabase.functions
    .invoke("petfest-bonus-track", {
      body: {
        eventType,
        token: reservation?.token ?? null,
        email: reservation?.email ?? null,
        metadata: metadata ?? {},
      },
    })
    .catch((err) => console.error("petfest bonus tracking failed", err));
};

/**
 * Attempts to grant the reserved 5,000 PawBucks to the signed-in user.
 * Server-side enforces the 5-minute window, email match, and one-per-account.
 */
export const claimPetFestBonus = async (): Promise<
  { success: true; amount: number } | { success: false; reason?: string } | null
> => {
  const reservation = readPetFestBonus();
  if (!reservation) return null;

  // Don't bother the backend once the window has clearly elapsed.
  if (new Date(reservation.expiresAt).getTime() + 30_000 < Date.now()) {
    clearPetFestBonus();
    return { success: false, reason: "expired" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("petfest-bonus-claim", {
      body: { token: reservation.token },
    });
    if (error) throw error;

    if (data?.success) {
      clearPetFestBonus();
      return { success: true, amount: data.amount ?? reservation.amount };
    }
    if (data?.reason && data.reason !== "unavailable" && data.reason !== "credit_failed") {
      clearPetFestBonus();
    }
    return { success: false, reason: data?.reason };
  } catch (err) {
    console.error("petfest bonus claim failed", err);
    return { success: false, reason: "error" };
  }
};

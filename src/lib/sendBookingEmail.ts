import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the booking email function and shows a clear toast if any
 * customer or business email fails to send. Never throws.
 */
export async function sendBookingEmail(body: Record<string, unknown>): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-booking-emails", { body });
    if (error) {
      let details = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const parsed = await error.context.json();
          details = parsed?.error || details;
        } catch {
          /* keep default message */
        }
      }
      console.error("send-booking-emails failed:", details);
      toast.error("Booking email didn't send", { description: details });
      return false;
    }
    if (data && data.success === false) {
      toast.error("Booking email didn't send", { description: data.error });
      return false;
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("send-booking-emails threw:", msg);
    toast.error("Booking email didn't send", { description: msg });
    return false;
  }
}

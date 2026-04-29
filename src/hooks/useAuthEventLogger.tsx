import { supabase } from"@/integrations/supabase/client";

interface AuthEventData {
 event_type:"login" |"signup" |"logout" |"password_reset" |"password_change" |"mfa_challenge" |"mfa_verify";
 user_id?: string;
 email?: string;
 success: boolean;
 failure_reason?: string;
 metadata?: Record<string, unknown>;
}

export const logAuthEvent = async (event: AuthEventData) => {
 try {
 const { error } = await supabase.functions.invoke("log-auth-event", {
 body: event,
 });

 if (error) {
 console.error("Failed to log auth event:", error);
 }
 } catch (err) {
 // Silently fail - don't interrupt user flow for logging
 console.error("Auth event logging failed:", err);
 }
};

export const useAuthEventLogger = () => {
 return { logAuthEvent };
};

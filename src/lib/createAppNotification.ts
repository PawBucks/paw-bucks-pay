import { supabase } from "@/integrations/supabase/client";

interface AppNotificationInput {
  user_id: string | null;
  title: string;
  message: string;
  category?: string;
  link_url?: string | null;
  is_read?: boolean;
}

/** Creates an in-app notification through the server-checked create_app_notification function. */
export async function createAppNotification(n: AppNotificationInput) {
  const { error } = await supabase.rpc("create_app_notification", {
    _target_user_id: n.user_id as string,
    _title: n.title,
    _message: n.message,
    _category: n.category ?? "transactional",
    _link_url: n.link_url ?? undefined,
  });
  if (error) console.error("Failed to create notification:", error.message);
  return { error };
}

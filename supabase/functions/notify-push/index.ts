import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PUSH_URL = "https://pawbucks-backend.rork.app/push/webhook";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  let notificationId: unknown;
  try {
    notificationId = (await req.json())?.notification_id;
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }
  if (typeof notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return json({ ok: false, error: "notification_id must be a uuid" }, 400);
  }

  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("notify-push: PUSH_WEBHOOK_SECRET is missing");
    return json({ ok: false, error: "secret missing" });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: record, error } = await supabase.from("notifications").select("*").eq("id", notificationId).maybeSingle();
  if (error) {
    console.error("notify-push: lookup failed", error.message);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!record) return json({ ok: true, skipped: "not found" });

  const createdAt = (record as Record<string, unknown>).created_at;
  if (typeof createdAt === "string" && Date.now() - new Date(createdAt).getTime() > 10 * 60 * 1000) {
    return json({ ok: true, skipped: "too old" });
  }

  const res = await fetch(PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
    body: JSON.stringify({ type: "INSERT", table: "notifications", schema: "public", record, old_record: null }),
  });
  const text = await res.text();
  console.log("notify-push: push server status", res.status, "body", text.slice(0, 1000));
  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
});

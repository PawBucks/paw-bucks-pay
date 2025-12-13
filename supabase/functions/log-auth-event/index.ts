import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Thresholds for detecting suspicious activity
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MINUTES = 15;
const RAPID_REQUEST_THRESHOLD = 20;
const RAPID_REQUEST_WINDOW_MINUTES = 5;

interface AuthEventPayload {
  event_type: string;
  user_id?: string;
  email?: string;
  success: boolean;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const payload: AuthEventPayload = await req.json();
    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
    const user_agent = req.headers.get("user-agent") || "unknown";

    console.log(`[Auth Event] ${payload.event_type} for ${payload.email || payload.user_id || "unknown"} - Success: ${payload.success}`);

    // Insert the auth event
    const { error: insertError } = await supabaseAdmin
      .from("auth_security_events")
      .insert({
        user_id: payload.user_id || null,
        event_type: payload.event_type,
        ip_address,
        user_agent,
        email: payload.email || null,
        success: payload.success,
        failure_reason: payload.failure_reason || null,
        metadata: payload.metadata || {},
      });

    if (insertError) {
      console.error("Failed to insert auth event:", insertError);
      throw insertError;
    }

    // Check for suspicious patterns if this was a failed login
    if (!payload.success && payload.event_type === "login") {
      await checkForSuspiciousActivity(supabaseAdmin, ip_address, payload.email);
    }

    // Check for rapid requests from same IP
    await checkForRapidRequests(supabaseAdmin, ip_address);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error logging auth event:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkForSuspiciousActivity(
  supabase: SupabaseClient,
  ip_address: string,
  email?: string
) {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - FAILED_LOGIN_WINDOW_MINUTES);

  // Check failed logins from this IP
  const { count: ipFailures } = await supabase
    .from("auth_security_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "login")
    .eq("success", false)
    .eq("ip_address", ip_address)
    .gte("created_at", windowStart.toISOString());

  if (ipFailures && ipFailures >= FAILED_LOGIN_THRESHOLD) {
    const { data: existingAlert } = await supabase
      .from("security_alerts")
      .select("id")
      .eq("alert_type", "brute_force_ip")
      .eq("ip_address", ip_address)
      .eq("is_resolved", false)
      .single();

    if (!existingAlert) {
      console.log(`[SECURITY ALERT] Brute force detected from IP: ${ip_address}`);
      await createSecurityAlert(supabase, {
        alert_type: "brute_force_ip",
        severity: "high",
        ip_address,
        details: {
          failed_attempts: ipFailures,
          window_minutes: FAILED_LOGIN_WINDOW_MINUTES,
          description: `${ipFailures} failed login attempts from IP ${ip_address} in the last ${FAILED_LOGIN_WINDOW_MINUTES} minutes`,
        },
      });
    }
  }

  if (email) {
    const { count: emailFailures } = await supabase
      .from("auth_security_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "login")
      .eq("success", false)
      .eq("email", email)
      .gte("created_at", windowStart.toISOString());

    if (emailFailures && emailFailures >= FAILED_LOGIN_THRESHOLD) {
      const { data: existingAlert } = await supabase
        .from("security_alerts")
        .select("id")
        .eq("alert_type", "brute_force_account")
        .eq("email", email)
        .eq("is_resolved", false)
        .single();

      if (!existingAlert) {
        console.log(`[SECURITY ALERT] Brute force detected for account: ${email}`);
        await createSecurityAlert(supabase, {
          alert_type: "brute_force_account",
          severity: "high",
          email,
          details: {
            failed_attempts: emailFailures,
            window_minutes: FAILED_LOGIN_WINDOW_MINUTES,
            description: `${emailFailures} failed login attempts for account ${email} in the last ${FAILED_LOGIN_WINDOW_MINUTES} minutes`,
          },
        });
      }
    }
  }
}

async function checkForRapidRequests(
  supabase: SupabaseClient,
  ip_address: string
) {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - RAPID_REQUEST_WINDOW_MINUTES);

  const { count } = await supabase
    .from("auth_security_events")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip_address)
    .gte("created_at", windowStart.toISOString());

  if (count && count >= RAPID_REQUEST_THRESHOLD) {
    const { data: existingAlert } = await supabase
      .from("security_alerts")
      .select("id")
      .eq("alert_type", "rapid_requests")
      .eq("ip_address", ip_address)
      .eq("is_resolved", false)
      .single();

    if (!existingAlert) {
      console.log(`[SECURITY ALERT] Rapid auth requests from IP: ${ip_address}`);
      await createSecurityAlert(supabase, {
        alert_type: "rapid_requests",
        severity: "medium",
        ip_address,
        details: {
          request_count: count,
          window_minutes: RAPID_REQUEST_WINDOW_MINUTES,
          description: `${count} authentication requests from IP ${ip_address} in the last ${RAPID_REQUEST_WINDOW_MINUTES} minutes`,
        },
      });
    }
  }
}

async function createSecurityAlert(
  supabase: SupabaseClient,
  alert: {
    alert_type: string;
    severity: string;
    user_id?: string;
    ip_address?: string;
    email?: string;
    details: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("security_alerts").insert(alert);
  if (error) {
    console.error("Failed to create security alert:", error);
    return;
  }

  // Create admin notifications
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin: { user_id: string }) => ({
      user_id: admin.user_id,
      title: `Security Alert: ${alert.alert_type.replace(/_/g, " ").toUpperCase()}`,
      message: alert.details.description as string,
      is_read: false,
    }));

    await supabase.from("notifications").insert(notifications);
  }
}

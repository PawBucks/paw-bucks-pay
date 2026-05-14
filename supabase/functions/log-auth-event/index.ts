import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Thresholds for detecting suspicious activity
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MINUTES = 15;
const RAPID_REQUEST_THRESHOLD = 20;
const RAPID_REQUEST_WINDOW_MINUTES = 5;

// Critical events that trigger email notifications
const CRITICAL_SECURITY_EVENTS = [
  "failed_login",
  "password_change",
  "password_reset_request",
  "multiple_failed_logins",
  "account_locked",
];

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

    // Verify caller identity from JWT to prevent email/user_id spoofing.
    // For unauthenticated callers (e.g. failed-login attempts) we still log
    // the event for security analytics, but we do NOT trust the supplied
    // email and we do NOT send any email alerts (which would otherwise be
    // an open spoofing/phishing vector).
    const authHeader = req.headers.get("Authorization");
    let verifiedUserId: string | null = null;
    let verifiedEmail: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) {
        verifiedUserId = userData.user.id;
        verifiedEmail = userData.user.email ?? null;
      }
    }
    const isAuthenticated = !!verifiedUserId;
    // Override any client-supplied identity with verified values
    if (isAuthenticated) {
      payload.user_id = verifiedUserId!;
      payload.email = verifiedEmail ?? null;
    } else {
      // Untrusted: do not store the spoofable email on the event row
      payload.user_id = null as unknown as string | undefined;
      // Keep payload.email only for brute-force detection (not stored)
    }

    console.log(`[Auth Event] ${payload.event_type} for ${payload.email || payload.user_id || "unknown"} - Success: ${payload.success}`);

    // Insert the auth event
    const { error: insertError } = await supabaseAdmin
      .from("auth_security_events")
      .insert({
        user_id: payload.user_id || null,
        event_type: payload.event_type,
        ip_address,
        user_agent,
        email: isAuthenticated ? (payload.email || null) : null,
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

    // Send email notification for critical security events
    // Only send if we have a verified authenticated user — otherwise the
    // email field is attacker-controlled and would enable phishing.
    if (isAuthenticated && payload.email && shouldSendEmailAlert(payload)) {
      await sendSecurityEmailAlert(payload, ip_address, user_agent);
    }

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

function shouldSendEmailAlert(payload: AuthEventPayload): boolean {
  // Failed login attempts
  if (payload.event_type === "login" && !payload.success) {
    return true;
  }
  // Password changes and resets
  if (payload.event_type === "password_change" || payload.event_type === "password_reset") {
    return true;
  }
  // Any explicitly critical event
  if (CRITICAL_SECURITY_EVENTS.includes(payload.event_type)) {
    return true;
  }
  return false;
}

async function sendSecurityEmailAlert(
  payload: AuthEventPayload,
  ip_address: string,
  user_agent: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey || !payload.email) {
    console.log("Skipping email alert: RESEND_API_KEY not configured or no email provided");
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "long",
    });

    let subject = "";
    let messageHtml = "";

    if (payload.event_type === "login" && !payload.success) {
      subject = "🔒 Security Alert: Failed Login Attempt";
      messageHtml = `
        <h2>Failed Login Attempt Detected</h2>
        <p>We detected a failed login attempt on your PawBucks account.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>IP Address:</strong> ${ip_address}</p>
          <p><strong>Device:</strong> ${user_agent}</p>
          ${payload.failure_reason ? `<p><strong>Reason:</strong> ${payload.failure_reason}</p>` : ""}
        </div>
        <p>If this was you, no action is needed. If you didn't attempt to log in, we recommend:</p>
        <ul>
          <li>Changing your password immediately</li>
          <li>Enabling two-factor authentication</li>
          <li>Reviewing your recent account activity</li>
        </ul>
      `;
    } else if (payload.event_type === "password_change") {
      subject = "🔐 Your Password Was Changed";
      messageHtml = `
        <h2>Password Changed Successfully</h2>
        <p>Your PawBucks account password was just changed.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>IP Address:</strong> ${ip_address}</p>
          <p><strong>Device:</strong> ${user_agent}</p>
        </div>
        <p>If you made this change, no action is needed.</p>
        <p><strong>If you didn't change your password, your account may be compromised.</strong> Please contact support immediately.</p>
      `;
    } else if (payload.event_type === "password_reset") {
      subject = "🔑 Password Reset Requested";
      messageHtml = `
        <h2>Password Reset Request</h2>
        <p>A password reset was requested for your PawBucks account.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>IP Address:</strong> ${ip_address}</p>
          <p><strong>Device:</strong> ${user_agent}</p>
        </div>
        <p>If you requested this reset, please check your email for the reset link.</p>
        <p>If you didn't request this, you can safely ignore this email. Your password has not been changed.</p>
      `;
    } else {
      subject = "🚨 Security Alert on Your Account";
      messageHtml = `
        <h2>Security Event Detected</h2>
        <p>We detected a security event on your PawBucks account.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Event:</strong> ${payload.event_type}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <p><strong>IP Address:</strong> ${ip_address}</p>
          <p><strong>Device:</strong> ${user_agent}</p>
        </div>
        <p>If you recognize this activity, no action is needed. Otherwise, please review your account security settings.</p>
      `;
    }

    await resend.emails.send({
      from: "PawBucks Security <security@resend.dev>",
      to: [payload.email],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
            .content { padding: 20px 0; }
            .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #4F46E5;">PawBucks</h1>
            </div>
            <div class="content">
              ${messageHtml}
            </div>
            <div class="footer">
              <p>This is an automated security notification from PawBucks.</p>
              <p>If you have questions, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Security Email] Sent ${payload.event_type} alert to ${payload.email}`);
  } catch (error) {
    console.error("Failed to send security email alert:", error);
    // Don't throw - email failure shouldn't break the auth event logging
  }
}

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

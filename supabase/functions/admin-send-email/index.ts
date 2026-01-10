import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of allowed HTML tags for email content
const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li', 'a', 'span', 'div',
  'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'blockquote', 'hr', 'pre', 'code'
]);

// Whitelist of allowed attributes
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  'a': new Set(['href', 'target', 'rel']),
  'span': new Set(['style']),
  'div': new Set(['style']),
  'p': new Set(['style']),
  'table': new Set(['style', 'width', 'cellpadding', 'cellspacing', 'border']),
  'td': new Set(['style', 'width', 'colspan', 'rowspan', 'align', 'valign']),
  'th': new Set(['style', 'width', 'colspan', 'rowspan', 'align', 'valign']),
  'tr': new Set(['style']),
  '*': new Set(['class']) // Global allowed attributes
};

// Dangerous patterns to remove
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onload, onerror, etc.
  /data:/gi,
  /vbscript:/gi,
  /<iframe\b[^>]*>.*?<\/iframe>/gi,
  /<object\b[^>]*>.*?<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<form\b[^>]*>.*?<\/form>/gi,
  /<input\b[^>]*>/gi,
  /<button\b[^>]*>.*?<\/button>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*["']?\s*javascript:/gi,
];

// Sanitize HTML content to prevent XSS attacks
function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  let sanitized = html;
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // Remove any remaining script-like content
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  
  // Remove event handlers from remaining tags
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Sanitize href attributes to only allow safe protocols
  sanitized = sanitized.replace(
    /href\s*=\s*["']([^"']*)["']/gi,
    (match, url) => {
      const trimmedUrl = url.trim().toLowerCase();
      if (trimmedUrl.startsWith('http://') || 
          trimmedUrl.startsWith('https://') || 
          trimmedUrl.startsWith('mailto:') ||
          trimmedUrl.startsWith('/')) {
        return match;
      }
      return 'href="#"';
    }
  );
  
  return sanitized;
}

// Convert plain text with line breaks to proper HTML formatting
function formatTextToHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Check if content already contains HTML block elements (user provided HTML)
  const hasBlockHtml = /<(p|div|h[1-6]|ul|ol|li|table|br)\b/i.test(text);
  
  if (hasBlockHtml) {
    // Content already has HTML formatting, just return it
    return text;
  }
  
  // Plain text: convert line breaks to HTML
  // Split by double line breaks (paragraphs) first
  const paragraphs = text.split(/\n\s*\n/);
  
  if (paragraphs.length > 1) {
    // Multiple paragraphs: wrap each in <p> tags
    return paragraphs
      .map(p => {
        // Convert single line breaks within paragraph to <br>
        const content = p.trim().replace(/\n/g, '<br>');
        return content ? `<p style="margin: 0 0 16px 0; line-height: 1.6;">${content}</p>` : '';
      })
      .filter(p => p)
      .join('\n');
  } else {
    // Single paragraph: just convert line breaks to <br>
    return `<p style="margin: 0; line-height: 1.6;">${text.trim().replace(/\n/g, '<br>')}</p>`;
  }
}

interface EmailRequest {
  recipientType: "all" | "merchants" | "pet_owners" | "individual";
  individualEmails?: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "superadmin"])
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipientType, individualEmails, subject, htmlContent, textContent }: EmailRequest = await req.json();

    if (!subject || !htmlContent) {
      return new Response(
        JSON.stringify({ error: "Subject and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First format plain text to HTML (preserves existing HTML), then sanitize
    const formattedHtmlContent = formatTextToHtml(htmlContent);
    const sanitizedHtmlContent = sanitizeHtml(formattedHtmlContent);
    
    console.log("HTML content formatted and sanitized for security");

    let emails: string[] = [];

    if (recipientType === "individual" && individualEmails && individualEmails.length > 0) {
      emails = individualEmails;
    } else if (recipientType === "all") {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("email")
        .not("email", "is", null);
      emails = (allProfiles || []).map((p) => p.email).filter(Boolean);
    } else if (recipientType === "merchants") {
      const { data: merchantProfiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_type", "merchant")
        .not("email", "is", null);
      emails = (merchantProfiles || []).map((p) => p.email).filter(Boolean);
    } else if (recipientType === "pet_owners") {
      const { data: petOwnerProfiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_type", "pet_owner")
        .not("email", "is", null);
      emails = (petOwnerProfiles || []).map((p) => p.email).filter(Boolean);
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending email to ${emails.length} recipients`);

    // Send emails in batches of 50 to avoid rate limits
    const batchSize = 50;
    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const promises = batch.map(async (email) => {
        try {
          // Wrap admin email content with branded header
          const brandedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #22d3ee; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(34, 211, 238, 0.3), 0 0 30px rgba(34, 211, 238, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              ${sanitizedHtmlContent}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} PawBucks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
          
          const { error } = await resend.emails.send({
            from: "PawBucks <noreply@pawbucks.app>",
            to: [email],
            subject: subject,
            html: brandedHtml,
            text: textContent || undefined,
          });

          if (error) {
            console.error(`Failed to send to ${email}:`, error);
            results.failed++;
            results.errors.push(`${email}: ${error.message}`);
          } else {
            results.success++;
          }
        } catch (err: any) {
          console.error(`Error sending to ${email}:`, err);
          results.failed++;
          results.errors.push(`${email}: ${err.message}`);
        }
      });

      await Promise.all(promises);
    }

    // Log the email action
    await supabase.from("audit_logs").insert({
      admin_id: userData.user.id,
      action: "send_email",
      entity_type: "email",
      entity_id: null,
      changes: {
        recipient_type: recipientType,
        recipient_count: emails.length,
        subject: subject,
        success_count: results.success,
        failed_count: results.failed,
      },
    });

    console.log(`Email sending complete: ${results.success} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10), // Only return first 10 errors
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-send-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

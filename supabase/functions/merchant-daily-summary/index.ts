import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format timestamp with explicit US timezone
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatPawBucks(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount) + " PB";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate "today" in EST/PST (America/New_York)
    const now = new Date();
    const estFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayEST = estFormatter.format(now); // YYYY-MM-DD

    console.log(`[Daily Summary] Running for date: ${todayEST}`);

    // Fetch all active (approved, not paused) merchants with email
    const { data: merchants, error: merchantsError } = await supabase
      .from("merchants")
      .select("id, business_name, email, user_id")
      .eq("approval_status", "approved")
      .eq("is_paused", false)
      .not("email", "is", null);

    if (merchantsError) {
      throw new Error(`Failed to fetch merchants: ${merchantsError.message}`);
    }

    if (!merchants || merchants.length === 0) {
      console.log("[Daily Summary] No active merchants found");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Daily Summary] Processing ${merchants.length} merchants`);

    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    let processed = 0;
    let emailsSent = 0;
    let errors: string[] = [];

    for (const merchant of merchants) {
      try {
        // Get today's completed transactions for this merchant
        const startOfDay = `${todayEST}T00:00:00-05:00`;
        const endOfDay = `${todayEST}T23:59:59-05:00`;

        const { data: transactions, error: txError } = await supabase
          .from("transactions")
          .select("amount, stripe_amount, pawbucks_used, application_fee, status")
          .eq("merchant_id", merchant.id)
          .eq("status", "completed")
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        if (txError) {
          console.error(`[Daily Summary] Error fetching transactions for ${merchant.business_name}:`, txError);
          errors.push(`${merchant.business_name}: ${txError.message}`);
          continue;
        }

        const txList = transactions || [];
        const transactionCount = txList.length;
        const totalSales = txList.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        // Net USD = stripe_amount minus the 3% network fee (application_fee)
        const totalStripeAmount = txList.reduce((sum, t) => sum + Number(t.stripe_amount || 0), 0);
        const totalApplicationFee = txList.reduce((sum, t) => sum + Number(t.application_fee || 0), 0);
        const totalUsdProcessed = totalStripeAmount - totalApplicationFee;
        const totalPawbucksCredits = txList.reduce((sum, t) => sum + (t.pawbucks_used || 0), 0);

        // Upsert daily summary record
        const { error: upsertError } = await supabase
          .from("merchant_daily_summaries")
          .upsert(
            {
              merchant_id: merchant.id,
              summary_date: todayEST,
              total_sales: totalSales,
              total_usd_processed: totalUsdProcessed,
              total_pawbucks_credits: totalPawbucksCredits,
              transaction_count: transactionCount,
              email_sent: false,
            },
            { onConflict: "merchant_id,summary_date" }
          );

        if (upsertError) {
          console.error(`[Daily Summary] Upsert error for ${merchant.business_name}:`, upsertError);
          errors.push(`${merchant.business_name}: upsert failed`);
          continue;
        }

        processed++;

        // Send email if there were transactions and we have Resend
        if (transactionCount > 0 && resend && merchant.email) {
          const formattedDate = formatDate(todayEST);
          const subject = `${merchant.business_name} - Your Daily PawBucks Settlement Summary for ${formattedDate}`;

          const emailHtml = `
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
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a2e; text-align: center;">
                Daily Reconciliation Summary
              </h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280; text-align: center;">
                ${merchant.business_name} &middot; ${formattedDate}
              </p>
            </td>
          </tr>

          <!-- Summary Table -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                    Total Sales via PawBucks
                  </td>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 700; color: #1a1a2e; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    ${formatCurrency(totalSales)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                    Total USD Processed (Net)
                  </td>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 700; color: #059669; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    ${formatCurrency(totalUsdProcessed)}
                  </td>
                </tr>
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                    Total PawBucks Credits Received
                  </td>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 700; color: #7c3aed; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    ${formatPawBucks(totalPawbucksCredits)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151;">
                    Transaction Count
                  </td>
                  <td style="padding: 14px 20px; font-size: 14px; font-weight: 700; color: #1a1a2e; text-align: right;">
                    ${transactionCount}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accounting Note -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>Accounting Note:</strong> Use these totals to balance your POS "Other" category for today's End-of-Day report.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} PawBucks. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">
                This is an automated daily settlement summary. View full history on your Merchant Dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          try {
            const { error: emailError } = await resend.emails.send({
              from: "PawBucks <noreply@pawbucks.app>",
              to: [merchant.email],
              subject,
              html: emailHtml,
            });

            if (emailError) {
              console.error(`[Daily Summary] Email failed for ${merchant.business_name}:`, emailError);
              errors.push(`${merchant.business_name}: email failed`);
            } else {
              emailsSent++;
              // Mark email as sent
              await supabase
                .from("merchant_daily_summaries")
                .update({ email_sent: true })
                .eq("merchant_id", merchant.id)
                .eq("summary_date", todayEST);
            }
          } catch (emailErr) {
            console.error(`[Daily Summary] Email error for ${merchant.business_name}:`, emailErr);
            errors.push(`${merchant.business_name}: email error`);
          }
        }

        // Also save summary for merchants with zero transactions (for complete history)
      } catch (err) {
        console.error(`[Daily Summary] Error processing ${merchant.business_name}:`, err);
        errors.push(`${merchant.business_name}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    console.log(`[Daily Summary] Complete: ${processed} processed, ${emailsSent} emails sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        emailsSent,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Daily Summary] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

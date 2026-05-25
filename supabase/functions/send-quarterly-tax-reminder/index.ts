import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// IRS Quarterly payment deadlines
const QUARTERLY_DEADLINES = [
  { quarter: 'Q1', deadline: 'April 15', checkMonth: 4, checkDay: 1 },
  { quarter: 'Q2', deadline: 'June 15', checkMonth: 6, checkDay: 1 },
  { quarter: 'Q3', deadline: 'September 15', checkMonth: 9, checkDay: 1 },
  { quarter: 'Q4', deadline: 'January 15', checkMonth: 1, checkDay: 1 },
];

const SELF_EMPLOYMENT_TAX_RATE = 0.153;
// Fallback IRS rates - will be fetched from database
const FALLBACK_IRS_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.70,
  2026: 0.725,
};

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[QUARTERLY-TAX-REMINDER] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();

    logStep("Starting quarterly tax reminder check", { currentMonth, currentDay, currentYear });

    // Find if we should send reminders (2 weeks before deadline)
    const upcomingQuarter = QUARTERLY_DEADLINES.find(q => {
      if (q.checkMonth === currentMonth && currentDay >= 1 && currentDay <= 7) {
        return true; // First week of reminder month
      }
      return false;
    });

    if (!upcomingQuarter) {
      logStep("Not in reminder window, skipping");
      return new Response(
        JSON.stringify({ message: "Not in quarterly reminder window" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Sending reminders for quarter", { quarter: upcomingQuarter.quarter });

    // Get all merchants with their earnings and expenses
    const { data: merchants, error: merchantsError } = await supabase
      .from("merchants")
      .select(`
        id,
        user_id,
        business_name,
        email
      `);

    if (merchantsError) {
      throw new Error(`Failed to fetch merchants: ${merchantsError.message}`);
    }

    logStep("Found merchants to process", { count: merchants?.length || 0 });

    const results = {
      emailsSent: 0,
      notificationsCreated: 0,
      errors: [] as string[],
    };

    for (const merchant of merchants || []) {
      try {
        // Get merchant's analytics (total sales)
        const { data: analyticsData } = await supabase
          .rpc('get_merchant_analytics', { p_merchant_id: merchant.id })
          .single();
        
        const analytics = analyticsData as { total_sales?: number } | null;

        // Get expenses for current tax year
        const { data: expenses } = await supabase
          .from("merchant_tax_expenses")
          .select("amount")
          .eq("merchant_id", merchant.id)
          .eq("tax_year", currentYear);

        // Get mileage for current tax year
        const { data: mileage } = await supabase
          .from("merchant_mileage_log")
          .select("miles, trip_type")
          .eq("merchant_id", merchant.id)
          .eq("tax_year", currentYear);

        // Fetch IRS rate from database or use fallback
        const { data: irsRateData } = await supabase
          .from("irs_mileage_rates")
          .select("rate_per_mile")
          .eq("tax_year", currentYear)
          .single();
        
        const irsRate = irsRateData?.rate_per_mile 
          ? Number(irsRateData.rate_per_mile) 
          : (FALLBACK_IRS_RATES[currentYear] || FALLBACK_IRS_RATES[2026]);

        // Calculate estimated tax
        const grossIncome = Number(analytics?.total_sales || 0);
        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const businessMiles = (mileage || [])
          .filter((m: any) => m.trip_type === 'pet_commute')
          .reduce((sum, m: any) => sum + Number(m.miles || 0), 0);
        const mileageDeduction = businessMiles * irsRate;
        
        const netProfit = Math.max(0, grossIncome - totalExpenses - mileageDeduction);
        const seTaxableIncome = netProfit * 0.9235;
        const selfEmploymentTax = seTaxableIncome * SELF_EMPLOYMENT_TAX_RATE;
        
        // Simplified income tax estimate (25% effective rate for middle income)
        const estimatedIncomeTax = netProfit * 0.15;
        const totalEstimatedTax = selfEmploymentTax + estimatedIncomeTax;
        const quarterlyPayment = totalEstimatedTax / 4;

        // Skip if no significant tax liability
        if (quarterlyPayment < 50) {
          continue;
        }

        // Create in-app notification
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: merchant.user_id,
            title: `${upcomingQuarter.quarter} Estimated Tax Payment Due`,
            message: `Your estimated quarterly tax payment of $${quarterlyPayment.toFixed(2)} is due by ${upcomingQuarter.deadline}. Pay on time to avoid IRS underpayment penalties.`,
            category: "transactional",
          });

        if (notifError) {
          logStep("Failed to create notification", { merchantId: merchant.id, error: notifError.message });
          results.errors.push(`Notification for ${merchant.business_name}: ${notifError.message}`);
        } else {
          results.notificationsCreated++;
        }

        // Get merchant's profile email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", merchant.user_id)
          .single();

        const recipientEmail = merchant.email || profile?.email;
        const recipientName = profile?.full_name || merchant.business_name;

        if (recipientEmail) {
          // Send email reminder
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
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #f59e0b; margin: 0 0 16px 0;">⏰ ${upcomingQuarter.quarter} Quarterly Tax Payment Reminder</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi ${recipientName},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                This is a friendly reminder that your <strong>${upcomingQuarter.quarter} estimated quarterly tax payment</strong> is due by <strong>${upcomingQuarter.deadline}</strong>.
              </p>
              
              <!-- Tax Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0;">Estimated Payment Due:</p>
                    <p style="color: #78350f; font-size: 32px; font-weight: 700; margin: 0;">$${quarterlyPayment.toFixed(2)}</p>
                    <p style="color: #92400e; font-size: 12px; margin: 8px 0 0 0;">Based on your ${currentYear} platform earnings and Tax Vault deductions</p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                <strong>Why pay quarterly?</strong> Self-employed individuals are required to pay estimated taxes quarterly to avoid underpayment penalties. The IRS expects you to pay taxes as you earn income.
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                <strong>How to pay:</strong> Use IRS Direct Pay or EFTPS to make your Form 1040-ES payment.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://pawbucks.app/merchant/tax-vault" 
                       style="display: inline-block; background-color: #7DD4D4; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
                      View Your Tax Vault →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                <em>Note: This is an estimate. Consult a tax professional for accurate tax planning.</em>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${currentYear} PawBucks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          const { error: emailError } = await resend.emails.send({
            from: "PawBucks Tax Reminders <noreply@pawbucks.app>",
            to: [recipientEmail],
            subject: `⏰ ${upcomingQuarter.quarter} Quarterly Tax Payment Due ${upcomingQuarter.deadline} - $${quarterlyPayment.toFixed(2)} Estimated`,
            html: emailHtml,
          });

          if (emailError) {
            logStep("Failed to send email", { merchantId: merchant.id, error: emailError.message });
            results.errors.push(`Email for ${merchant.business_name}: ${emailError.message}`);
          } else {
            results.emailsSent++;
          }
        }
      } catch (err: any) {
        logStep("Error processing merchant", { merchantId: merchant.id, error: err.message });
        results.errors.push(`${merchant.business_name}: ${err.message}`);
      }
    }

    logStep("Quarterly tax reminder complete", results);

    return new Response(
      JSON.stringify({
        success: true,
        quarter: upcomingQuarter.quarter,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error in send-quarterly-tax-reminder", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

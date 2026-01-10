import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LostPetPost {
  id: string;
  pet_name: string;
  status: string;
  updated_at: string;
  user_id: string;
  photo_url: string | null;
}

interface Profile {
  email: string;
  full_name: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Calculate the date range: posts resolved 23-24 days ago (7 days before 30-day deletion)
    const warningStartDate = new Date();
    warningStartDate.setDate(warningStartDate.getDate() - 24);
    
    const warningEndDate = new Date();
    warningEndDate.setDate(warningEndDate.getDate() - 23);

    console.log(`[send-lost-pet-deletion-warning] Checking for posts resolved between ${warningStartDate.toISOString()} and ${warningEndDate.toISOString()}`);

    // Find posts that:
    // 1. Are marked as "found" or "reunited"
    // 2. Were resolved 23-24 days ago
    // 3. Haven't already received a warning email
    const { data: postsToWarn, error: fetchError } = await supabase
      .from("lost_pet_posts")
      .select("id, pet_name, status, updated_at, user_id, photo_url")
      .in("status", ["found", "reunited"])
      .gte("updated_at", warningStartDate.toISOString())
      .lt("updated_at", warningEndDate.toISOString())
      .is("deletion_warning_sent_at", null);

    if (fetchError) {
      console.error("[send-lost-pet-deletion-warning] Error fetching posts:", fetchError);
      throw fetchError;
    }

    const postCount = postsToWarn?.length || 0;
    console.log(`[send-lost-pet-deletion-warning] Found ${postCount} posts needing warning emails`);

    if (postCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts require warning emails",
          emails_sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs to fetch their emails
    const userIds = [...new Set(postsToWarn!.map((p: LostPetPost) => p.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    if (profilesError) {
      console.error("[send-lost-pet-deletion-warning] Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const profileMap = new Map(profiles?.map((p: { id: string; email: string; full_name: string | null }) => [p.id, { email: p.email, full_name: p.full_name }]) || []);

    let emailsSent = 0;
    let emailsFailed = 0;
    const results: { postId: string; petName: string; success: boolean; error?: string }[] = [];

    // Send warning emails for each post
    for (const post of postsToWarn as LostPetPost[]) {
      const profile = profileMap.get(post.user_id) as Profile | undefined;
      
      if (!profile?.email) {
        console.warn(`[send-lost-pet-deletion-warning] No email found for user ${post.user_id}`);
        results.push({ postId: post.id, petName: post.pet_name, success: false, error: "No email found" });
        emailsFailed++;
        continue;
      }

      // Calculate deletion date (30 days from resolution)
      const resolutionDate = new Date(post.updated_at);
      const deletionDate = new Date(resolutionDate);
      deletionDate.setDate(deletionDate.getDate() + 30);

      const flyerUrl = `${supabaseUrl.replace('.supabase.co', '')}/lost-pet/${post.id}`;
      const userName = profile.full_name || "Pet Owner";

      const htmlContent = `
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
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center;">
              <img src="https://pawbucks.app/email-header.png" alt="PAWBUCKS" style="max-width: 280px; height: auto;" />
              <p style="color: #6b7280; margin: 16px 0 0 0; font-size: 14px;">Lost Pet Flyer Notice</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hi ${userName},</h2>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 600;">⚠️ Action Required</p>
                <p style="color: #78350f; margin: 8px 0 0 0; font-size: 14px;">Your lost pet flyer will be automatically deleted in <strong>7 days</strong>.</p>
              </div>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Great news that <strong>${post.pet_name}</strong> has been ${post.status}! 🎉
              </p>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                As part of our data cleanup policy, we automatically remove resolved lost pet flyers 30 days after they're marked as found or reunited. Your flyer for <strong>${post.pet_name}</strong> will be deleted on:
              </p>
              
              <div style="background-color: #f3f4f6; padding: 16px 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                <p style="color: #1f2937; margin: 0; font-size: 18px; font-weight: 600;">
                  📅 ${deletionDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                If you'd like to keep a copy of your flyer for your records, please download or screenshot it before this date.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${flyerUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(249, 115, 22, 0.3);">
                      View Your Flyer
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0; text-align: center;">
                This is an automated message from PawBucks. Please do not reply to this email.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
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

      try {
        const { error: emailError } = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [profile.email],
          subject: `⚠️ Your ${post.pet_name} flyer will be deleted in 7 days`,
          html: htmlContent,
        });

        if (emailError) {
          console.error(`[send-lost-pet-deletion-warning] Failed to send email for post ${post.id}:`, emailError);
          results.push({ postId: post.id, petName: post.pet_name, success: false, error: emailError.message });
          emailsFailed++;
          continue;
        }

        // Mark the post as having received a warning
        const { error: updateError } = await supabase
          .from("lost_pet_posts")
          .update({ deletion_warning_sent_at: new Date().toISOString() })
          .eq("id", post.id);

        if (updateError) {
          console.warn(`[send-lost-pet-deletion-warning] Failed to update warning flag for post ${post.id}:`, updateError);
        }

        console.log(`[send-lost-pet-deletion-warning] Sent warning email to ${profile.email} for ${post.pet_name}`);
        results.push({ postId: post.id, petName: post.pet_name, success: true });
        emailsSent++;

      } catch (emailErr: unknown) {
        const errorMessage = emailErr instanceof Error ? emailErr.message : "Unknown error";
        console.error(`[send-lost-pet-deletion-warning] Error sending email for post ${post.id}:`, errorMessage);
        results.push({ postId: post.id, petName: post.pet_name, success: false, error: errorMessage });
        emailsFailed++;
      }
    }

    console.log(`[send-lost-pet-deletion-warning] Complete: ${emailsSent} sent, ${emailsFailed} failed`);

    // Log the action
    await supabase.from("audit_logs").insert({
      admin_id: null,
      action: "auto_send_deletion_warnings",
      entity_type: "lost_pet_posts",
      entity_id: null,
      changes: {
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        results: results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${emailsSent} warning emails, ${emailsFailed} failed`,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        results: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-lost-pet-deletion-warning] Error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

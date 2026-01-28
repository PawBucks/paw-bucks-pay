import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  reminder_id?: string;
  check_all?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: ReminderRequest = await req.json().catch(() => ({}));
    const { reminder_id, check_all } = body;

    // If checking all, get due reminders
    let remindersToSend: any[] = [];

    if (check_all) {
      const { data, error } = await supabase
        .from("compliance_reminders")
        .select(`
          *,
          pet:pet_profiles(id, name, user_id),
          vet:partner_vets(id, name)
        `)
        .eq("is_active", true)
        .lte("due_date", new Date().toISOString().split("T")[0])
        .or("last_sent_at.is.null,last_sent_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      remindersToSend = data || [];
    } else if (reminder_id) {
      const { data, error } = await supabase
        .from("compliance_reminders")
        .select(`
          *,
          pet:pet_profiles(id, name, user_id),
          vet:partner_vets(id, name)
        `)
        .eq("id", reminder_id)
        .single();

      if (error) throw error;
      if (data) remindersToSend = [data];
    }

    const results: any[] = [];
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    for (const reminder of remindersToSend) {
      const petOwnerId = reminder.pet?.user_id;
      if (!petOwnerId) continue;

      // Get owner's contact info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", petOwnerId)
        .single();

      if (!profile) continue;

      const petName = reminder.pet?.name || "Your pet";
      const vetName = reminder.vet?.name || "your veterinarian";
      const message = `Hi ${profile.full_name || "there"}! This is a reminder that ${petName} is due for: ${reminder.title}. Please contact ${vetName} to schedule an appointment. - PawBucks`;

      // Send SMS if enabled and phone is available
      if (reminder.sms_enabled && profile.phone && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: profile.phone,
                From: twilioPhoneNumber,
                Body: message,
              }),
            }
          );

          const smsResult = await twilioResponse.json();

          await supabase.from("compliance_reminder_logs").insert({
            reminder_id: reminder.id,
            channel: "sms",
            status: twilioResponse.ok ? "sent" : "failed",
            error_message: twilioResponse.ok ? null : smsResult.message,
          });

          results.push({
            reminder_id: reminder.id,
            channel: "sms",
            success: twilioResponse.ok,
          });
        } catch (smsError: any) {
          await supabase.from("compliance_reminder_logs").insert({
            reminder_id: reminder.id,
            channel: "sms",
            status: "failed",
            error_message: smsError.message,
          });
        }
      }

      // Send push notification if enabled
      if (reminder.push_enabled) {
        try {
          // Create in-app notification
          await supabase.from("notifications").insert({
            user_id: petOwnerId,
            title: `Reminder: ${reminder.title}`,
            message: `${petName} is due for ${reminder.reminder_type.replace("_", " ")}. Please schedule an appointment with ${vetName}.`,
            category: "transactional",
          });

          await supabase.from("compliance_reminder_logs").insert({
            reminder_id: reminder.id,
            channel: "push",
            status: "sent",
          });

          results.push({
            reminder_id: reminder.id,
            channel: "push",
            success: true,
          });
        } catch (pushError: any) {
          await supabase.from("compliance_reminder_logs").insert({
            reminder_id: reminder.id,
            channel: "push",
            status: "failed",
            error_message: pushError.message,
          });
        }
      }

      // Update last_sent_at
      await supabase
        .from("compliance_reminders")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      // If recurring, update next_reminder_at
      if (reminder.recurrence_months) {
        const nextDate = new Date(reminder.due_date);
        nextDate.setMonth(nextDate.getMonth() + reminder.recurrence_months);
        
        await supabase
          .from("compliance_reminders")
          .update({
            due_date: nextDate.toISOString().split("T")[0],
            next_reminder_at: nextDate.toISOString(),
          })
          .eq("id", reminder.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_processed: remindersToSend.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing compliance reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

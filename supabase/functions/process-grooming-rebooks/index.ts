import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { checkInternalSecret } from "../_shared/internal-auth.ts";
import { currentHourInTz } from "../_shared/tz.ts";

const TARGET_LOCAL_HOUR = 10; // 10 AM in each customer's timezone

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all enabled rebook settings
    const { data: settings, error: settingsError } = await supabase
      .from("grooming_rebook_settings")
      .select("*, merchants!inner(id, business_name, user_id, storefront_slug)")
      .eq("is_enabled", true);

    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ message: "No enabled rebook settings found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const setting of settings) {
      const merchant = (setting as any).merchants;
      const intervalDays = setting.rebook_interval_days;
      const maxReminders = setting.max_reminders_per_cycle;
      const channels = setting.reminder_channels as string[];
      const messageTemplate = setting.message_template;

      // Find completed grooming bookings older than the rebook interval
      // that haven't been followed up (or haven't exceeded max reminders)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - intervalDays);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      // Get completed grooming bookings for this merchant where:
      // 1. Booking date is before the cutoff (hasn't visited in X days)
      // 2. The service category is grooming
      // 3. The customer hasn't already booked a future appointment
      const { data: staleBookings, error: bookingsError } = await supabase
        .from("service_bookings")
        .select(`
          id, user_id, booking_date, customer_name, customer_email,
          pet_id, pet_profiles(name),
          merchant_services!inner(category, merchant_id)
        `)
        .eq("merchant_services.merchant_id", setting.merchant_id)
        .eq("merchant_services.category", "grooming")
        .eq("status", "completed")
        .lte("booking_date", cutoffStr)
        .order("booking_date", { ascending: false });

      if (bookingsError) {
        console.error(`Error fetching bookings for merchant ${setting.merchant_id}:`, bookingsError);
        continue;
      }

      if (!staleBookings || staleBookings.length === 0) continue;

      // Deduplicate by user_id - keep only the most recent booking per user
      const latestByUser = new Map<string, typeof staleBookings[0]>();
      for (const booking of staleBookings) {
        if (!latestByUser.has(booking.user_id)) {
          latestByUser.set(booking.user_id, booking);
        }
      }

      for (const [userId, lastBooking] of latestByUser) {
        // Per-user timezone gate: only fire at 10 AM local for the customer.
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle();
        if (currentHourInTz(userProfile?.timezone) !== TARGET_LOCAL_HOUR) continue;

        // Check if user has a future booking with this merchant already
        const today = new Date().toISOString().split("T")[0];
        const { data: futureBooking } = await supabase
          .from("service_bookings")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "confirmed")
          .gte("booking_date", today)
          .limit(1)
          .maybeSingle();

        if (futureBooking) continue; // Already has an upcoming appointment

        // Check how many reminders we've already sent this cycle
        const { count: reminderCount } = await supabase
          .from("grooming_rebook_log")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", setting.merchant_id)
          .eq("user_id", userId)
          .eq("last_booking_id", lastBooking.id)
          .eq("status", "sent");

        if ((reminderCount || 0) >= maxReminders) continue;

        // Check cooldown - don't send more than once per week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const { data: recentReminder } = await supabase
          .from("grooming_rebook_log")
          .select("id")
          .eq("merchant_id", setting.merchant_id)
          .eq("user_id", userId)
          .gte("message_sent_at", oneWeekAgo.toISOString())
          .limit(1)
          .maybeSingle();

        if (recentReminder) continue;

        // Build personalized message
        const ownerName = lastBooking.customer_name || "there";
        const petName = lastBooking.pet_name || "your pet";
        const personalizedMessage = messageTemplate
          .replace(/\{\{owner_name\}\}/g, ownerName)
          .replace(/\{\{pet_name\}\}/g, petName);

        // Send notifications based on configured channels
        if (channels.includes("push")) {
          // In-app notification
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "🐾 Time for a grooming visit!",
            message: personalizedMessage,
            category: "transactional",
            is_read: false,
          });
        }

        if (channels.includes("email") && lastBooking.customer_email) {
          // Send email via existing edge function
          try {
            const bookingUrl = `${supabaseUrl.replace('.supabase.co', '')}/book/${merchant.storefront_slug || setting.merchant_id}`;
            await supabase.functions.invoke("send-booking-emails", {
              headers: { "x-internal-secret": Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "" },
              body: {
                type: "rebook_reminder",
                customerEmail: lastBooking.customer_email,
                customerName: ownerName,
                merchantName: merchant.business_name || "your groomer",
                serviceName: "Grooming",
                petName,
                personalizedMessage,
                bookingUrl,
              },
            });
          } catch (emailErr) {
            console.error("Failed to send rebook email:", emailErr);
          }
        }

        // Log the reminder
        await supabase.from("grooming_rebook_log").insert({
          merchant_id: setting.merchant_id,
          user_id: userId,
          pet_id: lastBooking.pet_id,
          last_booking_id: lastBooking.id,
          reminder_number: (reminderCount || 0) + 1,
          status: "sent",
        });

        totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Rebook processing complete", totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing rebooks:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

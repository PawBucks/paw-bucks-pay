import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Audience = {
  userId?: string;
  contactId?: string;
  name: string;
  email?: string;
  phone?: string;
  source: "customer" | "subscriber" | "imported";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: { user } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const { data: merchant } = await admin
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!merchant) return json({ success: false, error: "No merchant account found" }, 403);
    const merchantId = merchant.id as string;

    // 1) Platform users with a prior relationship to this merchant
    const [tx, bookings, subs, punch, msgs] = await Promise.all([
      admin.from("transactions").select("user_id").eq("merchant_id", merchantId),
      admin.from("service_bookings").select("user_id").eq("merchant_id", merchantId),
      admin.from("merchant_subscriptions").select("user_id, status").eq("merchant_id", merchantId),
      admin.from("customer_punch_cards").select("user_id").eq("merchant_id", merchantId),
      admin.from("merchant_messages").select("user_id").eq("merchant_id", merchantId),
    ]);

    const subscriberIds = new Set<string>();
    for (const r of subs.data ?? []) {
      if (r.user_id && (r.status === "active" || r.status === "paused")) subscriberIds.add(r.user_id as string);
    }

    const userIds = new Set<string>(subscriberIds);
    for (const set of [tx.data, bookings.data, punch.data, msgs.data, subs.data]) {
      for (const r of set ?? []) if ((r as any).user_id) userIds.add((r as any).user_id as string);
    }

    const audience: Audience[] = [];
    let optedOut = 0;

    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const [profilesRes, prefsRes] = await Promise.all([
        admin.from("profiles").select("id, full_name, email, phone, is_banned").in("id", ids),
        admin.from("notification_preferences").select("user_id, marketing").in("user_id", ids),
      ]);

      // Do-not-contact: explicit marketing opt-out or banned account
      const doNotContact = new Set<string>();
      for (const p of prefsRes.data ?? []) {
        if ((p as any).marketing === false) doNotContact.add((p as any).user_id as string);
      }

      for (const p of profilesRes.data ?? []) {
        const id = (p as any).id as string;
        if ((p as any).is_banned || doNotContact.has(id)) {
          optedOut++;
          continue;
        }
        audience.push({
          userId: id,
          name: (p as any).full_name || (p as any).email || "Customer",
          email: (p as any).email || undefined,
          phone: (p as any).phone || undefined,
          source: subscriberIds.has(id) ? "subscriber" : "customer",
        });
      }
    }

    // 2) Merchant-uploaded / invoiced clients (may not have platform accounts)
    const { data: clients } = await admin
      .from("invoice_clients")
      .select("id, name, email, phone, is_active")
      .eq("merchant_id", merchantId);

    const seenEmails = new Set(
      audience.map((a) => a.email?.toLowerCase()).filter(Boolean) as string[],
    );
    const seenPhones = new Set(
      audience.map((a) => a.phone?.replace(/\D/g, "")).filter((p) => !!p) as string[],
    );

    for (const c of clients ?? []) {
      if ((c as any).is_active === false) {
        optedOut++;
        continue;
      }
      const email = ((c as any).email || "").trim().toLowerCase() || undefined;
      const phoneDigits = ((c as any).phone || "").replace(/\D/g, "") || undefined;
      if ((email && seenEmails.has(email)) || (phoneDigits && seenPhones.has(phoneDigits))) continue;
      if (email) seenEmails.add(email);
      if (phoneDigits) seenPhones.add(phoneDigits);
      audience.push({
        contactId: (c as any).id as string,
        name: (c as any).name || email || "Client",
        email: (c as any).email || undefined,
        phone: (c as any).phone || undefined,
        source: "imported",
      });
    }

    audience.sort((a, b) => a.name.localeCompare(b.name));

    return json({
      success: true,
      recipients: audience,
      counts: {
        total: audience.length,
        withEmail: audience.filter((a) => a.email).length,
        withPhone: audience.filter((a) => a.phone).length,
        pushEligible: audience.filter((a) => a.userId).length,
        excluded: optedOut,
      },
    });
  } catch (e) {
    console.error("merchant-campaign-audience error:", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

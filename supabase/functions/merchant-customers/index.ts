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

type Customer = {
  key: string;
  userId?: string;
  clientId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  sources: string[];
  transactions: number;
  bookings: number;
  totalSpent: number;
  rewardsEarned: number;
  lastActivity?: string;
  subscriptionStatus?: string;
  marketingOptOut: boolean;
  saved: boolean;
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

    const [txRes, bookingsRes, subsRes, clientsRes] = await Promise.all([
      admin
        .from("transactions")
        .select("user_id, amount, rewards_earned, cashback_earned, status, created_at")
        .eq("merchant_id", merchantId),
      admin
        .from("service_bookings")
        .select("user_id, customer_name, customer_email, customer_phone, status, created_at")
        .eq("merchant_id", merchantId),
      admin
        .from("merchant_subscriptions")
        .select("user_id, status, cancel_at_period_end")
        .eq("merchant_id", merchantId),
      admin
        .from("invoice_clients")
        .select("id, name, email, phone, company_name, created_at, is_active")
        .eq("merchant_id", merchantId)
        .eq("is_active", true),
    ]);

    const byUser = new Map<string, Customer>();
    const ensureUser = (id: string): Customer => {
      let c = byUser.get(id);
      if (!c) {
        c = {
          key: `user:${id}`,
          userId: id,
          name: "Customer",
          sources: [],
          transactions: 0,
          bookings: 0,
          totalSpent: 0,
          rewardsEarned: 0,
          marketingOptOut: false,
          saved: false,
        };
        byUser.set(id, c);
      }
      return c;
    };

    const bumpActivity = (c: Customer, when?: string | null) => {
      if (!when) return;
      if (!c.lastActivity || when > c.lastActivity) c.lastActivity = when;
    };

    for (const t of txRes.data ?? []) {
      const uid = (t as any).user_id as string | null;
      if (!uid) continue;
      const c = ensureUser(uid);
      if (!c.sources.includes("purchase")) c.sources.push("purchase");
      if ((t as any).status !== "refunded") {
        c.transactions++;
        c.totalSpent += Number((t as any).amount ?? 0);
        c.rewardsEarned += Number((t as any).rewards_earned ?? (t as any).cashback_earned ?? 0);
      }
      bumpActivity(c, (t as any).created_at);
    }

    const guestBookings: Customer[] = [];
    for (const b of bookingsRes.data ?? []) {
      const uid = (b as any).user_id as string | null;
      if (uid) {
        const c = ensureUser(uid);
        if (!c.sources.includes("booking")) c.sources.push("booking");
        c.bookings++;
        bumpActivity(c, (b as any).created_at);
      } else if ((b as any).customer_email || (b as any).customer_name) {
        guestBookings.push({
          key: `guest:${((b as any).customer_email || (b as any).customer_name || "").toLowerCase()}`,
          name: (b as any).customer_name || (b as any).customer_email || "Guest",
          email: (b as any).customer_email || undefined,
          phone: (b as any).customer_phone || undefined,
          sources: ["booking"],
          transactions: 0,
          bookings: 1,
          totalSpent: 0,
          rewardsEarned: 0,
          lastActivity: (b as any).created_at,
          marketingOptOut: false,
          saved: false,
        });
      }
    }

    for (const s of subsRes.data ?? []) {
      const uid = (s as any).user_id as string | null;
      if (!uid) continue;
      const c = ensureUser(uid);
      if (!c.sources.includes("subscriber")) c.sources.push("subscriber");
      c.subscriptionStatus = (s as any).cancel_at_period_end
        ? "canceling"
        : ((s as any).status as string);
    }

    if (byUser.size > 0) {
      const ids = Array.from(byUser.keys());
      const [profilesRes, prefsRes] = await Promise.all([
        admin.from("profiles").select("id, full_name, email, phone, is_banned").in("id", ids),
        admin.from("notification_preferences").select("user_id, marketing").in("user_id", ids),
      ]);
      const optOut = new Set(
        (prefsRes.data ?? [])
          .filter((p: any) => p.marketing === false)
          .map((p: any) => p.user_id as string),
      );
      for (const p of profilesRes.data ?? []) {
        const c = byUser.get((p as any).id as string);
        if (!c) continue;
        c.name = (p as any).full_name || (p as any).email || "Customer";
        c.email = (p as any).email || undefined;
        c.phone = (p as any).phone || undefined;
        c.marketingOptOut = optOut.has((p as any).id) || !!(p as any).is_banned;
      }
    }

    const customers: Customer[] = [...byUser.values()];

    // Merge guest bookings (dedupe by email)
    const emailIndex = new Map<string, Customer>();
    for (const c of customers) if (c.email) emailIndex.set(c.email.toLowerCase(), c);
    for (const g of guestBookings) {
      const key = g.email?.toLowerCase();
      const existing = key ? emailIndex.get(key) : undefined;
      if (existing) {
        existing.bookings += g.bookings;
        if (!existing.sources.includes("booking")) existing.sources.push("booking");
        bumpActivity(existing, g.lastActivity);
      } else {
        const dupe = customers.find((c) => c.key === g.key);
        if (dupe) {
          dupe.bookings += 1;
          bumpActivity(dupe, g.lastActivity);
        } else {
          customers.push(g);
          if (key) emailIndex.set(key, g);
        }
      }
    }

    // Merge saved contacts
    for (const cl of clientsRes.data ?? []) {
      const email = ((cl as any).email || "").trim().toLowerCase();
      const existing = email ? emailIndex.get(email) : undefined;
      if (existing) {
        existing.saved = true;
        existing.clientId = (cl as any).id as string;
        existing.company = existing.company || (cl as any).company_name || undefined;
        if (!existing.sources.includes("contact")) existing.sources.push("contact");
        if (!existing.phone) existing.phone = (cl as any).phone || undefined;
      } else {
        const c: Customer = {
          key: `client:${(cl as any).id}`,
          clientId: (cl as any).id as string,
          name: (cl as any).name || (cl as any).email || "Client",
          email: (cl as any).email || undefined,
          phone: (cl as any).phone || undefined,
          company: (cl as any).company_name || undefined,
          sources: ["contact"],
          transactions: 0,
          bookings: 0,
          totalSpent: 0,
          rewardsEarned: 0,
          lastActivity: (cl as any).created_at,
          marketingOptOut: false,
          saved: true,
        };
        customers.push(c);
        if (email) emailIndex.set(email, c);
      }
    }

    customers.sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""));

    return json({
      success: true,
      merchantId,
      customers,
      summary: {
        total: customers.length,
        saved: customers.filter((c) => c.saved).length,
        platform: customers.filter((c) => c.userId).length,
        subscribers: customers.filter((c) => c.subscriptionStatus === "active").length,
        repeat: customers.filter((c) => c.transactions + c.bookings > 1).length,
        totalSpent: customers.reduce((s, c) => s + c.totalSpent, 0),
      },
    });
  } catch (e) {
    console.error("merchant-customers error:", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

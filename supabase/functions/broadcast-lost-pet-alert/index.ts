import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://pawbucks.app";
const RADIUS_MILES = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613; // earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
      `?limit=1&country=US&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    if (Array.isArray(center) && center.length === 2) {
      return { lat: Number(center[1]), lng: Number(center[0]) };
    }
  } catch (e) {
    console.error("[broadcast-lost-pet-alert] geocode failed", e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  let postId: unknown;
  try {
    postId = (await req.json())?.postId;
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }
  if (typeof postId !== "string" || !/^[0-9a-f-]{36}$/i.test(postId)) {
    return json({ ok: false, error: "postId must be a uuid" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: post, error: postError } = await supabase
    .from("lost_pet_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    console.error("[broadcast-lost-pet-alert] lookup failed", postError.message);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!post) return json({ ok: true, skipped: "not found" });
  if (post.status !== "lost" || post.is_active !== true) {
    return json({ ok: true, skipped: "not an active lost post" });
  }

  // ---- Resolve flyer coordinates -------------------------------------------
  let lat = post.latitude != null ? Number(post.latitude) : null;
  let lng = post.longitude != null ? Number(post.longitude) : null;

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    const query = [post.last_seen_location, post.last_seen_area_description]
      .filter(Boolean)
      .join(", ");
    const geo = query ? await geocode(query) : null;
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      await supabase
        .from("lost_pet_posts")
        .update({ latitude: lat, longitude: lng })
        .eq("id", postId);
    }
  }

  if (lat == null || lng == null) {
    console.warn("[broadcast-lost-pet-alert] no coordinates; cannot geo-filter", postId);
    return json({ ok: true, skipped: "no coordinates" });
  }

  const within = (a: unknown, b: unknown) => {
    const la = a == null ? NaN : Number(a);
    const lo = b == null ? NaN : Number(b);
    if (Number.isNaN(la) || Number.isNaN(lo)) return false;
    return milesBetween(lat!, lng!, la, lo) <= RADIUS_MILES;
  };

  // ---- Build recipient set -------------------------------------------------
  const recipients = new Set<string>();

  // 1. Merchants (businesses + clinics on the merchants table) within radius
  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, user_id, latitude, longitude");
  const nearbyMerchantIds: string[] = [];
  for (const m of merchants ?? []) {
    if (!within(m.latitude, m.longitude)) continue;
    nearbyMerchantIds.push(m.id as string);
    if (m.user_id) recipients.add(m.user_id as string);
  }

  // 2. Pet owners / users with a saved last-known location within radius
  const { data: locatedProfiles } = await supabase
    .from("profiles")
    .select("id, last_known_latitude, last_known_longitude")
    .not("last_known_latitude", "is", null)
    .not("last_known_longitude", "is", null);
  for (const p of locatedProfiles ?? []) {
    if (within(p.last_known_latitude, p.last_known_longitude)) {
      recipients.add(p.id as string);
    }
  }

  // 3. Customers who booked or checked in at a nearby business (local community)
  if (nearbyMerchantIds.length > 0) {
    const chunk = nearbyMerchantIds.slice(0, 500);
    const [{ data: bookings }, { data: checkins }] = await Promise.all([
      supabase.from("service_bookings").select("user_id").in("merchant_id", chunk).limit(5000),
      supabase.from("checkins").select("user_id").in("merchant_id", chunk).limit(5000),
    ]);
    for (const row of [...(bookings ?? []), ...(checkins ?? [])]) {
      if (row.user_id) recipients.add(row.user_id as string);
    }
  }

  // 4. Platform admins always see lost pet alerts
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "superadmin"]);
  for (const a of admins ?? []) if (a.user_id) recipients.add(a.user_id as string);

  // Never alert the person who posted the flyer about their own pet
  recipients.delete(post.user_id as string);

  const recipientIds = [...recipients];
  if (recipientIds.length === 0) {
    return json({ ok: true, recipients: 0, emails: 0, skipped: "no one within radius" });
  }

  // ---- In-app notifications (the push relay trigger forwards these) --------
  const petDetail = post.breed || post.color_markings || post.pet_type;
  const title = `Lost Pet Alert: ${post.pet_name}`;
  const message =
    `${post.pet_type}${petDetail ? ` (${petDetail})` : ""} missing near ` +
    `${post.last_seen_location}. Tap to view the flyer and help reunite them.`;
  const linkUrl = `/lost-pets/${postId}`;

  let notified = 0;
  for (let i = 0; i < recipientIds.length; i += 200) {
    const rows = recipientIds.slice(i, i + 200).map((uid) => ({
      user_id: uid,
      title,
      message,
      category: "lost_pet",
      link_url: linkUrl,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) {
      console.error("[broadcast-lost-pet-alert] notification insert failed", error.message);
    } else {
      notified += rows.length;
    }
  }

  // ---- Email flyer via Resend ---------------------------------------------
  let emailsSent = 0;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const emailRows: { email: string; full_name: string | null }[] = [];
    for (let i = 0; i < recipientIds.length; i += 200) {
      const { data } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("id", recipientIds.slice(i, i + 200));
      for (const p of data ?? []) {
        if (p.email) emailRows.push({ email: p.email as string, full_name: p.full_name as string | null });
      }
    }

    const flyerUrl = `${APP_URL}/lost-pets/${postId}`;
    const photo = Array.isArray(post.photo_urls) && post.photo_urls.length > 0
      ? post.photo_urls[0]
      : post.photo_url;
    const rows: string[] = [
      ["Pet", post.pet_name],
      ["Type", post.pet_type],
      ["Breed", post.breed],
      ["Colors / markings", post.color_markings],
      ["Size", post.size],
      ["Collar", post.collar_description],
      ["Identifying features", post.identifying_features],
      ["Last seen", [post.last_seen_date, post.last_seen_time].filter(Boolean).join(" at ")],
      ["Location", post.last_seen_location],
      ["Area", post.last_seen_area_description],
      ["Reward", post.reward_amount ? `$${Number(post.reward_amount).toFixed(2)}` : null],
      ["Contact", [post.contact_name, post.contact_phone].filter(Boolean).join(" - ")],
    ]
      .filter(([, v]) => v)
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;white-space:nowrap">${escapeHtml(
            String(label),
          )}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(
            String(value),
          )}</td></tr>`,
      );

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#ffffff;padding:20px 24px;border-bottom:1px solid #e2e8f0">
      <div style="font-size:18px;font-weight:700;color:#0f172a">PawBucks</div>
    </div>
    <div style="background:#b91c1c;color:#ffffff;padding:16px 24px;font-size:16px;font-weight:700">
      Lost pet near you
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;font-size:15px;color:#334155">
        ${escapeHtml(String(post.pet_name))} went missing within ${RADIUS_MILES} miles of you.
        Please keep an eye out and share this flyer.
      </p>
      ${photo ? `<img src="${escapeHtml(String(photo))}" alt="${escapeHtml(String(post.pet_name))}" style="width:100%;border-radius:12px;margin-bottom:16px" />` : ""}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">${rows.join("")}</table>
      ${post.additional_notes ? `<p style="margin:0 0 20px;font-size:14px;color:#475569">${escapeHtml(String(post.additional_notes))}</p>` : ""}
      <a href="${flyerUrl}" style="display:inline-block;background:#0f9b9b;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:15px">View flyer and help</a>
    </div>
    <div style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px">
      You receive local lost pet alerts because you are part of the PawBucks community near this area.
    </div>
  </div>
</body></html>`;

    const subject = `Lost pet near you: ${post.pet_name} (${post.pet_type})`;

    for (let i = 0; i < emailRows.length; i += 100) {
      const batch = emailRows.slice(i, i + 100).map((r) => ({
        from: "PawBucks <noreply@pawbucks.app>",
        to: [r.email],
        subject,
        html,
      }));
      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batch),
        });
        const text = await res.text();
        if (!res.ok) {
          console.error("[broadcast-lost-pet-alert] resend batch failed", res.status, text.slice(0, 500));
        } else {
          emailsSent += batch.length;
        }
      } catch (e) {
        console.error("[broadcast-lost-pet-alert] resend batch threw", e);
      }
    }
  } else {
    console.warn("[broadcast-lost-pet-alert] RESEND_API_KEY missing; skipped emails");
  }

  console.log(
    `[broadcast-lost-pet-alert] post=${postId} recipients=${recipientIds.length} notified=${notified} emails=${emailsSent}`,
  );
  return json({ ok: true, recipients: recipientIds.length, notified, emails: emailsSent });
});

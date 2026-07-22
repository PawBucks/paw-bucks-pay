// Shared Clover REST API helpers (write-back to POS orders/payments).
//
// Clover receipt templates render the `note` field of orders and payments by
// default — there is no separate "print flag" API. Setting the note field is
// what surfaces the text on the printed and emailed customer receipt.
//
// Auth: per-merchant OAuth v2 access tokens, persisted on
// `merchant_pos_integrations` (columns: clover_access_token,
// clover_refresh_token, clover_token_expires_at). The exchange happens in the
// `clover-oauth-callback` edge function.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CLOVER_API_BASE =
  Deno.env.get("CLOVER_API_BASE")?.trim() || "https://api.clover.com";
const CLOVER_OAUTH_BASE =
  Deno.env.get("CLOVER_OAUTH_BASE")?.trim() || "https://api.clover.com";

export type CloverTokenRow = {
  clover_merchant_id: string | null;
  clover_access_token: string | null;
  clover_refresh_token: string | null;
  clover_token_expires_at: string | null;
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function refreshAccessToken(
  supabase: SupabaseClient,
  row: CloverTokenRow,
): Promise<string | null> {
  const appId = Deno.env.get("CLOVER_APP_ID")?.trim();
  const appSecret = Deno.env.get("CLOVER_APP_SECRET")?.trim();
  if (!appId || !appSecret || !row.clover_refresh_token) return null;

  const res = await fetch(`${CLOVER_OAUTH_BASE}/oauth/v2/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      refresh_token: row.clover_refresh_token,
    }),
  });
  if (!res.ok) {
    console.error("[CLOVER][token] refresh failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const accessToken: string | undefined = data.access_token;
  const refreshToken: string | undefined = data.refresh_token ?? row.clover_refresh_token ?? undefined;
  const expiresAt = data.access_token_expiration
    ? new Date(Number(data.access_token_expiration) * 1000).toISOString()
    : null;
  if (!accessToken || !row.clover_merchant_id) return null;

  await supabase
    .from("merchant_pos_integrations")
    .update({
      clover_access_token: accessToken,
      clover_refresh_token: refreshToken,
      clover_token_expires_at: expiresAt,
    })
    .eq("clover_merchant_id", row.clover_merchant_id);

  return accessToken;
}

export async function getMerchantAccessToken(
  cloverMerchantId: string,
): Promise<string | null> {
  if (!cloverMerchantId) return null;
  const supabase = admin();
  const { data, error } = await supabase
    .from("merchant_pos_integrations")
    .select(
      "clover_merchant_id, clover_access_token, clover_refresh_token, clover_token_expires_at",
    )
    .eq("clover_merchant_id", cloverMerchantId)
    .maybeSingle();

  if (error || !data) {
    console.error("[CLOVER][token] lookup failed", error);
    return null;
  }
  const row = data as CloverTokenRow;
  if (!row.clover_access_token) return null;

  const expiresAt = row.clover_token_expires_at
    ? new Date(row.clover_token_expires_at).getTime()
    : null;
  const now = Date.now();
  const isExpired = expiresAt !== null && expiresAt - 60_000 <= now; // 60s skew
  if (isExpired) {
    const refreshed = await refreshAccessToken(supabase, row);
    return refreshed;
  }
  return row.clover_access_token;
}

async function cloverRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${CLOVER_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mergeNote(existing: string | null | undefined, note: string): string {
  const clean = (existing ?? "").trim();
  if (!clean) return note;
  // Avoid duplicating if the same note was already appended.
  if (clean.includes(note)) return clean;
  return `${note}\n${clean}`;
}

/**
 * Attach a note to a Clover order so it prints on the customer receipt.
 * Preserves any existing note by prepending our text.
 */
export async function addOrderNote(
  cloverMerchantId: string,
  orderId: string,
  note: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const token = await getMerchantAccessToken(cloverMerchantId);
  if (!token) return { ok: false, status: 0, error: "no_access_token" };

  // Fetch existing order note so we don't clobber it.
  const getRes = await cloverRequest(
    "GET",
    `/v3/merchants/${cloverMerchantId}/orders/${orderId}`,
    token,
  );
  let existing: string | null = null;
  if (getRes.ok) {
    try {
      const j = await getRes.json();
      existing = (j?.note as string | null) ?? null;
    } catch { /* ignore */ }
  }

  const res = await cloverRequest(
    "POST",
    `/v3/merchants/${cloverMerchantId}/orders/${orderId}`,
    token,
    { note: mergeNote(existing, note) },
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error("[CLOVER][order-note] failed", res.status, errText);
    return { ok: false, status: res.status, error: errText.slice(0, 500) };
  }
  return { ok: true, status: res.status };
}

/**
 * Attach a note to a Clover payment so it prints on the customer receipt.
 */
export async function addPaymentNote(
  cloverMerchantId: string,
  orderId: string,
  paymentId: string,
  note: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const token = await getMerchantAccessToken(cloverMerchantId);
  if (!token) return { ok: false, status: 0, error: "no_access_token" };

  const getRes = await cloverRequest(
    "GET",
    `/v3/merchants/${cloverMerchantId}/orders/${orderId}/payments/${paymentId}`,
    token,
  );
  let existing: string | null = null;
  if (getRes.ok) {
    try {
      const j = await getRes.json();
      existing = (j?.note as string | null) ?? null;
    } catch { /* ignore */ }
  }

  const res = await cloverRequest(
    "POST",
    `/v3/merchants/${cloverMerchantId}/orders/${orderId}/payments/${paymentId}`,
    token,
    { note: mergeNote(existing, note) },
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error("[CLOVER][payment-note] failed", res.status, errText);
    return { ok: false, status: res.status, error: errText.slice(0, 500) };
  }
  return { ok: true, status: res.status };
}

export const PAWBUCKS_RECEIPT_NOTE = "Paid via PawBucks - Balance Updated.";

/**
 * Convenience wrapper: attach the standard PawBucks note to both the order and
 * (if provided) the payment. Never throws — logs and returns per-target status.
 */
export async function attachPawBucksNote(params: {
  cloverMerchantId: string;
  orderId?: string | null;
  paymentId?: string | null;
}): Promise<{ order?: { ok: boolean }; payment?: { ok: boolean } }> {
  const out: { order?: { ok: boolean }; payment?: { ok: boolean } } = {};
  if (!params.cloverMerchantId || !params.orderId) return out;
  try {
    const orderRes = await addOrderNote(
      params.cloverMerchantId,
      params.orderId,
      PAWBUCKS_RECEIPT_NOTE,
    );
    out.order = { ok: orderRes.ok };
  } catch (e) {
    console.error("[CLOVER][note] order write threw", e);
    out.order = { ok: false };
  }
  if (params.paymentId) {
    try {
      const payRes = await addPaymentNote(
        params.cloverMerchantId,
        params.orderId,
        params.paymentId,
        PAWBUCKS_RECEIPT_NOTE,
      );
      out.payment = { ok: payRes.ok };
    } catch (e) {
      console.error("[CLOVER][note] payment write threw", e);
      out.payment = { ok: false };
    }
  }
  return out;
}
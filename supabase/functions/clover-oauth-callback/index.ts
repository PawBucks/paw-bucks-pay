// Clover OAuth v2 callback: exchanges the returned `code` for access/refresh
// tokens and stores them on the matching merchant_pos_integrations row.
//
// Clover redirects here with query params: code, merchant_id (and sometimes
// client_id / employee_id). See Clover OAuth v2 docs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOVER_OAUTH_BASE =
  Deno.env.get("CLOVER_OAUTH_BASE")?.trim() || "https://api.clover.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let code = url.searchParams.get("code");
    let cloverMerchantId = url.searchParams.get("merchant_id");

    // Some Clover configurations POST JSON to the callback instead of redirect.
    if ((!code || !cloverMerchantId) && req.method === "POST") {
      try {
        const body = await req.json();
        code = code || body.code || null;
        cloverMerchantId = cloverMerchantId || body.merchant_id || body.merchantId || null;
      } catch { /* ignore */ }
    }

    if (!code || !cloverMerchantId) {
      return new Response(
        JSON.stringify({ error: "Missing code or merchant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const appId = Deno.env.get("CLOVER_APP_ID")?.trim();
    const appSecret = Deno.env.get("CLOVER_APP_SECRET")?.trim();
    if (!appId || !appSecret) {
      console.error("[CLOVER][oauth] missing CLOVER_APP_ID / CLOVER_APP_SECRET");
      return new Response(
        JSON.stringify({ error: "Clover OAuth is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Exchange authorization code for access + refresh tokens.
    const tokenRes = await fetch(`${CLOVER_OAUTH_BASE}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        code,
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[CLOVER][oauth] token exchange failed", tokenRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Token exchange failed", detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const tokenJson = await tokenRes.json();
    const accessToken: string | undefined = tokenJson.access_token;
    const refreshToken: string | null = tokenJson.refresh_token ?? null;
    const accessExpiration = tokenJson.access_token_expiration
      ? new Date(Number(tokenJson.access_token_expiration) * 1000).toISOString()
      : null;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Clover did not return an access token" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Upsert onto the integration keyed on clover_merchant_id.
    const { data: existing } = await supabase
      .from("merchant_pos_integrations")
      .select("id")
      .eq("clover_merchant_id", cloverMerchantId)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase
        .from("merchant_pos_integrations")
        .update({
          clover_access_token: accessToken,
          clover_refresh_token: refreshToken,
          clover_token_expires_at: accessExpiration,
          is_active: true,
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error("[CLOVER][oauth] token persist failed", updErr);
        return new Response(
          JSON.stringify({ error: "Failed to store token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // No pre-existing integration row for this Clover merchant. Record the
      // token so a merchant admin can complete linkage later; merchant_id must
      // be set at that point. We stash the token in a placeholder row keyed on
      // clover_merchant_id only if the column allows null merchant_id, which it
      // does not by default — so we simply return success and let the caller
      // finish onboarding first.
      console.warn(
        "[CLOVER][oauth] token received but no matching merchant_pos_integrations row",
        { cloverMerchantId },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id: cloverMerchantId,
        stored: Boolean(existing),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[CLOVER][oauth] unhandled", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
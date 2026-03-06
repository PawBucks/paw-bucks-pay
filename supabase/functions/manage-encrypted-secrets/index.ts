import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// AES-256-GCM encryption helpers
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get("SECRETS_ENCRYPTION_KEY");
  if (!keyHex || keyHex.length < 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY not configured or too short");
  }
  // Use SHA-256 hash of the key string to get exactly 32 bytes
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest("SHA-256", encoder.encode(keyHex));
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertext: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = new Uint8Array(
    atob(ciphertext).split("").map((c) => c.charCodeAt(0))
  );
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create_webhook": {
        const { merchant_id, name, url, events } = body;

        // Verify user owns this merchant
        const { data: merchant } = await supabaseAdmin
          .from("merchants")
          .select("id")
          .eq("id", merchant_id)
          .eq("user_id", userId)
          .single();

        if (!merchant) {
          return new Response(JSON.stringify({ error: "Merchant not found or unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate and encrypt webhook secret
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let rawSecret = "";
        for (let i = 0; i < 32; i++) {
          rawSecret += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const encryptedSecret = await encrypt(rawSecret);

        const { data: webhook, error } = await supabaseAdmin
          .from("merchant_webhooks")
          .insert({
            merchant_id,
            name: name || "Default Webhook",
            url,
            secret: encryptedSecret,
            events: events || ["transaction.created", "reward.awarded"],
          })
          .select("id, name, url, events, is_active, created_at")
          .single();

        if (error) throw error;

        // Return the raw secret once so merchant can copy it
        return new Response(
          JSON.stringify({ success: true, webhook, raw_secret: rawSecret }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "decrypt_webhook_secret": {
        // Internal use: decrypt a webhook secret for HMAC signing
        // Only service-role or verified merchant owner can do this
        const { webhook_id } = body;

        const { data: webhook } = await supabaseAdmin
          .from("merchant_webhooks")
          .select("secret, merchant_id")
          .eq("id", webhook_id)
          .single();

        if (!webhook) {
          return new Response(JSON.stringify({ error: "Webhook not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify ownership
        const { data: ownerCheck } = await supabaseAdmin
          .from("merchants")
          .select("id")
          .eq("id", webhook.merchant_id)
          .eq("user_id", userId)
          .single();

        if (!ownerCheck) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const decrypted = await decrypt(webhook.secret);
          return new Response(
            JSON.stringify({ success: true, secret: decrypted }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          // Secret might be legacy plain text
          return new Response(
            JSON.stringify({ success: true, secret: webhook.secret }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("manage-encrypted-secrets error:", message);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    const { invoiceId } = await req.json();

    if (!jwt || !invoiceId) {
      return new Response(JSON.stringify({ error: "Authentication and invoiceId are required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    const user = userData?.user;

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, merchant_id, client_email, access_token")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("id", invoice.merchant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const userEmail = (user.email ?? "").toLowerCase();
    const clientEmail = (invoice.client_email ?? "").toLowerCase();
    const authorized = Boolean(merchant) || (Boolean(userEmail) && userEmail === clientEmail);

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Not authorized for this invoice" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;

    return new Response(JSON.stringify({ paymentUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET_INVOICE_PAYMENT_LINK] Unexpected error", error);
    return new Response(JSON.stringify({ error: "Unable to create invoice payment link" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
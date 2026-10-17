import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { sendPosReceipts } from "../_shared/pos-receipts.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const Body = z.object({ saleId: z.string().uuid(), email: z.string().trim().email().max(255).optional() });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Receipt service unavailable" }, 500);
    const admin = createClient(url, key);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: user, error: authError } = await admin.auth.getUser(token);
    if (authError || !user.user) return json({ error: "Not signed in" }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Enter a valid sale and email address" }, 400);
    const { saleId, email } = parsed.data;
    const { data: sale } = await admin.from("merchant_pos_sales").select("merchant_id").eq("id", saleId).maybeSingle();
    if (!sale) return json({ error: "Sale not found" }, 404);
    const { data: merchant } = await admin.from("merchants").select("user_id").eq("id", sale.merchant_id).maybeSingle();
    if (merchant?.user_id !== user.user.id) return json({ error: "Not allowed" }, 403);
    const result = await sendPosReceipts(admin, saleId, { email });
    return json(result, result.success ? 200 : 502);
  } catch (error) {
    console.error("[POS-RECEIPT]", error);
    return json({ error: "Receipt emails could not be sent" }, 500);
  }
});

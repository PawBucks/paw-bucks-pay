import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ success: false, error: 'Not authenticated' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ success: false, error: 'Not authenticated' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const sid = typeof body?.twilio_account_sid === 'string' ? body.twilio_account_sid.trim() : '';
    const phone = typeof body?.twilio_phone_number === 'string' ? body.twilio_phone_number.trim() : '';
    const token = typeof body?.twilio_auth_token === 'string' ? body.twilio_auth_token.trim() : '';

    if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) {
      return json({ success: false, error: 'Invalid Twilio Account SID' }, 400);
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return json({ success: false, error: 'Phone number must be in E.164 format (e.g. +15551234567)' }, 400);
    }
    if (token && !/^[A-Za-z0-9]{20,64}$/.test(token)) {
      return json({ success: false, error: 'Invalid Twilio Auth Token' }, 400);
    }

    const admin = createClient(url, service);

    // Ownership check: the caller must own the merchant record.
    const { data: merchant, error: merchantErr } = await admin
      .from('merchants')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (merchantErr) throw merchantErr;
    if (!merchant) return json({ success: false, error: 'Merchant account not found' }, 403);

    const { data: existing } = await admin
      .from('merchant_twilio_settings')
      .select('id')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        twilio_account_sid: sid,
        twilio_phone_number: phone,
      };
      if (token) updates.twilio_auth_token = token;
      const { error } = await admin
        .from('merchant_twilio_settings')
        .update(updates)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      if (!token) return json({ success: false, error: 'Auth token is required for initial setup' }, 400);
      const { error } = await admin.from('merchant_twilio_settings').insert({
        merchant_id: merchant.id,
        twilio_account_sid: sid,
        twilio_auth_token: token,
        twilio_phone_number: phone,
      });
      if (error) throw error;
    }

    return json({ success: true });
  } catch (err) {
    console.error('merchant-save-twilio-settings error:', err);
    return json({ success: false, error: 'Could not save settings' }, 200);
  }
});

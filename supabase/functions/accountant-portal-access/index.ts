import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const baseRequestSchema = z.object({
  accessToken: z.string().min(1).max(500),
  selectedYear: z.number().int().min(2020).max(2100).optional(),
  action: z.enum(['validate', 'getExpenses', 'getMileage', 'getIncome', 'addNote']),
});

const addNoteSchema = z.object({
  accessToken: z.string().min(1).max(500),
  selectedYear: z.number().int().min(2020).max(2100).optional(),
  action: z.literal('addNote'),
  expenseId: z.string().uuid(),
  note: z.string().min(1).max(2000),
  suggestedCategory: z.string().max(100).optional().nullable(),
});

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[ACCOUNTANT-PORTAL] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    
    // Validate input with Zod schema
    const baseValidation = baseRequestSchema.safeParse(rawBody);
    if (!baseValidation.success) {
      const errorMessage = baseValidation.error.errors.map(e => e.message).join(', ');
      logStep("Validation failed", { error: errorMessage });
      return new Response(
        JSON.stringify({ error: "Invalid request parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, accessToken, selectedYear } = baseValidation.data;

    logStep("Processing request", { action, accessToken: accessToken.substring(0, 8) + "..." });

    // Validate the access token using the secure function
    const { data: invitationId, error: validateError } = await supabase
      .rpc('validate_accountant_access_token', { token_param: accessToken });

    if (validateError || !invitationId) {
      logStep("Invalid token", { error: validateError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid or expired access link" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the full invitation data using service role
    const { data: invitation, error: invError } = await supabase
      .from('accountant_invitations')
      .select(`
        id,
        merchant_id,
        accountant_name,
        accountant_email,
        permissions,
        status,
        expires_at,
        merchants (
          business_name,
          owner_name
        )
      `)
      .eq('id', invitationId)
      .single();

    if (invError || !invitation) {
      logStep("Failed to fetch invitation", { error: invError?.message });
      return new Response(
        JSON.stringify({ error: "Failed to load invitation data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    if (action === 'validate') {
      // Update status to accepted if pending
      if (invitation.status === 'pending') {
        await supabase
          .from('accountant_invitations')
          .update({ 
            status: 'accepted', 
            accepted_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', invitation.id);
      } else {
        // Update last accessed time
        await supabase
          .from('accountant_invitations')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', invitation.id);
      }

      // Log activity
      await supabase.from('accountant_activity_log').insert({
        invitation_id: invitation.id,
        merchant_id: invitation.merchant_id,
        action: 'portal_access',
        entity_type: 'portal',
        notes: `Accessed portal for tax year ${selectedYear || new Date().getFullYear()}`
      });

      return new Response(
        JSON.stringify({ success: true, invitation }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'getExpenses') {
      const permissions = invitation.permissions as { view_expenses?: boolean };
      if (!permissions.view_expenses) {
        return new Response(
          JSON.stringify({ error: "Not authorized to view expenses" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: expenses } = await supabase
        .from('merchant_tax_expenses')
        .select('*')
        .eq('merchant_id', invitation.merchant_id)
        .eq('tax_year', selectedYear || new Date().getFullYear())
        .order('expense_date', { ascending: false });

      const { data: notes } = await supabase
        .from('accountant_expense_notes')
        .select('*')
        .eq('invitation_id', invitation.id);

      return new Response(
        JSON.stringify({ success: true, expenses: expenses || [], notes: notes || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'getMileage') {
      const permissions = invitation.permissions as { view_mileage?: boolean };
      if (!permissions.view_mileage) {
        return new Response(
          JSON.stringify({ error: "Not authorized to view mileage" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: mileage } = await supabase
        .from('merchant_mileage_log')
        .select('*')
        .eq('merchant_id', invitation.merchant_id)
        .eq('tax_year', selectedYear || new Date().getFullYear())
        .order('trip_date', { ascending: false });

      return new Response(
        JSON.stringify({ success: true, mileage: mileage || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'getIncome') {
      const permissions = invitation.permissions as { view_income?: boolean };
      if (!permissions.view_income) {
        return new Response(
          JSON.stringify({ error: "Not authorized to view income" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const year = selectedYear || new Date().getFullYear();
      const { data: earningsData } = await supabase
        .from('direct_payments')
        .select('amount, created_at')
        .eq('merchant_id', invitation.merchant_id)
        .eq('status', 'succeeded')
        .gte('created_at', `${year}-01-01`)
        .lte('created_at', `${year}-12-31`);

      const byMonth: Record<string, number> = {};
      let total = 0;

      (earningsData || []).forEach((payment: { amount: number; created_at: string }) => {
        const date = new Date(payment.created_at);
        const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        byMonth[month] = (byMonth[month] || 0) + payment.amount;
        total += payment.amount;
      });

      return new Response(
        JSON.stringify({ success: true, income: { total, byMonth } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'addNote') {
      const permissions = invitation.permissions as { add_notes?: boolean };
      if (!permissions.add_notes) {
        return new Response(
          JSON.stringify({ error: "Not authorized to add notes" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate addNote request with stricter schema
      const noteValidation = addNoteSchema.safeParse(rawBody);
      if (!noteValidation.success) {
        const errorMessage = noteValidation.error.errors.map(e => e.message).join(', ');
        return new Response(
          JSON.stringify({ error: "Invalid note parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { expenseId, note, suggestedCategory } = noteValidation.data;

      const { error: insertError } = await supabase.from('accountant_expense_notes').insert({
        invitation_id: invitation.id,
        expense_id: expenseId,
        note: note.trim(),
        suggested_category: suggestedCategory || null
      });

      if (insertError) {
        logStep("Failed to add note", { error: insertError.message });
        return new Response(
          JSON.stringify({ error: "Failed to add note" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log activity
      await supabase.from('accountant_activity_log').insert({
        invitation_id: invitation.id,
        merchant_id: invitation.merchant_id,
        action: 'add_note',
        entity_type: 'expense',
        entity_id: expenseId,
        notes: note.trim()
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("Error processing request", { error: message });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

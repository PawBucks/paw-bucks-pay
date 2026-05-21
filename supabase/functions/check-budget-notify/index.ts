import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, amount, merchant_category } = await req.json();

    if (!user_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Checking budget for user:', user_id, 'category:', merchant_category, 'amount:', amount);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's budget settings
    const { data: budgetSettings, error: budgetError } = await supabaseAdmin
      .from('budget_settings')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (budgetError) {
      console.error('Error fetching budget settings:', budgetError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch budget settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!budgetSettings || budgetSettings.length === 0) {
      console.log('No budget settings found for user');
      return new Response(
        JSON.stringify({ alerts: [], message: 'No budget settings configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get current month's spending by category
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('amount, merchants!inner(business_type)')
      .eq('user_id', user_id)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'completed');

    if (txError) {
      console.error('Error fetching transactions:', txError);
    }

    // Calculate spending by category
    const spendingByCategory: Record<string, number> = {};
    transactions?.forEach((tx: any) => {
      const category = tx.merchants?.business_type || 'other';
      spendingByCategory[category] = (spendingByCategory[category] || 0) + parseFloat(tx.amount);
    });

    console.log('Current spending by category:', spendingByCategory);

    // Check which budgets are exceeded
    const alerts: Array<{
      category: string;
      spent: number;
      limit: number;
      percentage: number;
      exceededThreshold: boolean;
    }> = [];

    for (const budget of budgetSettings) {
      const spent = spendingByCategory[budget.category] || 0;
      const percentage = (spent / budget.monthly_limit) * 100;
      
      if (percentage >= budget.alert_threshold) {
        alerts.push({
          category: budget.category,
          spent,
          limit: budget.monthly_limit,
          percentage,
          exceededThreshold: percentage >= 100,
        });
      }
    }

    console.log('Budget alerts:', alerts);

    if (alerts.length > 0) {
      // Get user email for notification
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', user_id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      // Create in-app notifications
      for (const alert of alerts) {
        const isExceeded = alert.exceededThreshold;
        const title = isExceeded 
          ? `Budget Exceeded: ${alert.category}`
          : `Budget Alert: ${alert.category}`;
        const message = isExceeded
          ? `You've spent $${alert.spent.toFixed(2)} of your $${alert.limit.toFixed(2)} monthly budget for ${alert.category}.`
          : `You've used ${alert.percentage.toFixed(0)}% of your ${alert.category} budget ($${alert.spent.toFixed(2)}/$${alert.limit.toFixed(2)}).`;

        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id,
            title,
            message,
            category: 'budget',
          });

        console.log('Created notification:', title);
      }

      // Send email notification for exceeded budgets
      if (profile?.email) {
        const exceededAlerts = alerts.filter(a => a.exceededThreshold);
        
        if (exceededAlerts.length > 0) {
          const alertsHtml = exceededAlerts.map(a => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${a.category}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">$${a.spent.toFixed(2)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">$${a.limit.toFixed(2)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #ef4444;">${a.percentage.toFixed(0)}%</td>
            </tr>
          `).join('');

          try {
            await resend.emails.send({
              from: 'PawBucks <noreply@pawbucks.app>',
              to: [profile.email],
              subject: '⚠️ Budget Alert - You\'ve exceeded your spending limit',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #8B5CF6;">Budget Alert</h1>
                  <p>Hi ${profile.full_name || 'there'},</p>
                  <p>You've exceeded one or more of your monthly spending budgets:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                      <tr style="background: #f9fafb;">
                        <th style="padding: 10px; text-align: left;">Category</th>
                        <th style="padding: 10px; text-align: left;">Spent</th>
                        <th style="padding: 10px; text-align: left;">Budget</th>
                        <th style="padding: 10px; text-align: left;">Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${alertsHtml}
                    </tbody>
                  </table>
                  <p>Consider reviewing your spending or adjusting your budget settings in the PawBucks app.</p>
                  <p style="color: #888; font-size: 12px;">— The PawBucks Team</p>
                </div>
              `,
            });
            console.log('Email notification sent to:', profile.email);
          } catch (emailError) {
            console.error('Error sending email:', emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        alerts, 
        message: alerts.length > 0 ? 'Budget alerts triggered' : 'Within budget' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Budget check error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

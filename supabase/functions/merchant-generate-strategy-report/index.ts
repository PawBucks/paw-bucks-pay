import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, business_type, cashback_rate, address, description')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check service access
    const { data: servicePurchase } = await supabase
      .from('merchant_service_purchases')
      .select('*, merchant_market_services(name)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    const hasAccess = servicePurchase?.some(
      (p: any) => p.merchant_market_services?.name === 'Dedicated Strategy Consultation'
    );

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'No active Strategy Consultation service' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Gather merchant data for AI analysis
    const [txResult, reviewResult, servicesResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, created_at, cashback_earned, status')
        .eq('merchant_id', merchant.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('merchant_reviews')
        .select('rating, review_text, created_at')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('merchant_service_purchases')
        .select('*, merchant_market_services(name)')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active'),
    ]);

    const transactions = txResult.data || [];
    const reviews = reviewResult.data || [];
    const activeServices = servicesResult.data || [];

    // Calculate key metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgTransactionValue = transactions.length > 0 ? totalRevenue / transactions.length : 0;
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    // Recent 30-day vs prior 30-day revenue
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recent30 = transactions.filter(t => new Date(t.created_at) >= thirtyDaysAgo);
    const prior30 = transactions.filter(t => new Date(t.created_at) >= sixtyDaysAgo && new Date(t.created_at) < thirtyDaysAgo);

    const recentRevenue = recent30.reduce((sum, t) => sum + t.amount, 0);
    const priorRevenue = prior30.reduce((sum, t) => sum + t.amount, 0);
    const revenueGrowth = priorRevenue > 0 ? ((recentRevenue - priorRevenue) / priorRevenue * 100) : 0;

    // Unique customers
    const uniqueCustomerCount = transactions.length;

    // Generate AI report using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let aiReport;
    if (LOVABLE_API_KEY) {
      const prompt = `You are a business strategy consultant for small pet-related businesses. Analyze this merchant's data and provide a concise, actionable strategy report.

MERCHANT DATA:
- Business: ${merchant.business_name} (${merchant.business_type})
- Description: ${merchant.description || 'Not provided'}
- Location: ${merchant.address || 'Not provided'}
- Cashback Rate: ${merchant.cashback_rate}%
- Total Transactions: ${transactions.length}
- Total Revenue: $${totalRevenue.toFixed(2)}
- Average Transaction Value: $${avgTransactionValue.toFixed(2)}
- Last 30-Day Revenue: $${recentRevenue.toFixed(2)}
- Prior 30-Day Revenue: $${priorRevenue.toFixed(2)}
- Revenue Growth: ${revenueGrowth.toFixed(1)}%
- Average Review Rating: ${avgRating.toFixed(1)}/5 (${reviews.length} reviews)
- Active Premium Services: ${activeServices.map((s: any) => s.merchant_market_services?.name).filter(Boolean).join(', ') || 'None'}

Respond with a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "strengths": ["strength1", "strength2", "strength3"],
  "opportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "actionItems": [
    {"action": "specific action", "priority": "high|medium|low", "timeline": "e.g. This week, This month, Next quarter"},
    {"action": "specific action", "priority": "high|medium|low", "timeline": "timeline"}
  ],
  "projectedImpact": "1-2 sentence projected business impact if recommendations are followed"
}`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are a business strategy consultant. Always respond with valid JSON only, no markdown formatting.' },
              { role: 'user', content: prompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "generate_strategy_report",
                description: "Generate a strategy report for a merchant",
                parameters: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    opportunities: { type: "array", items: { type: "string" } },
                    actionItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          action: { type: "string" },
                          priority: { type: "string", enum: ["high", "medium", "low"] },
                          timeline: { type: "string" }
                        },
                        required: ["action", "priority", "timeline"]
                      }
                    },
                    projectedImpact: { type: "string" }
                  },
                  required: ["summary", "strengths", "opportunities", "actionItems", "projectedImpact"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "generate_strategy_report" } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            aiReport = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (aiError) {
        console.error('AI generation error:', aiError);
      }
    }

    // Fallback to data-driven report if AI unavailable
    if (!aiReport) {
      aiReport = {
        summary: `${merchant.business_name} has processed ${transactions.length} transactions totaling $${totalRevenue.toFixed(2)}. ${revenueGrowth >= 0 ? 'Revenue is growing' : 'Revenue has declined'} ${Math.abs(revenueGrowth).toFixed(0)}% month-over-month.`,
        strengths: [
          transactions.length > 10 ? 'Active customer base with consistent transactions' : 'Early-stage business with growth potential',
          avgRating >= 4 ? `Strong customer satisfaction with ${avgRating.toFixed(1)}/5 rating` : 'Opportunity to improve customer experience',
          activeServices.length > 0 ? `Leveraging ${activeServices.length} premium services for growth` : 'Untapped premium service opportunities'
        ],
        opportunities: [
          'Increase average order value through bundled offerings',
          'Implement a loyalty program to boost repeat visits',
          'Optimize online presence with Search Ranking Booster'
        ],
        actionItems: [
          { action: 'Review and optimize your business description and photos', priority: 'high' as const, timeline: 'This week' },
          { action: 'Set up a PawBucks promotion to attract new customers', priority: 'high' as const, timeline: 'This week' },
          { action: 'Respond to all customer reviews to build engagement', priority: 'medium' as const, timeline: 'This month' },
          { action: 'Consider adding Flash Sales during slow periods', priority: 'medium' as const, timeline: 'This month' },
        ],
        projectedImpact: `Implementing these recommendations could increase monthly revenue by 15-25% and improve customer retention by 20% within the next quarter.`
      };
    }

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      ...aiReport,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Strategy report error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

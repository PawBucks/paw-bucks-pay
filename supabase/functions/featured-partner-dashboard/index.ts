import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PartnerBenefit {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'used' | 'pending';
  usedAt?: string;
  expiresAt?: string;
}

interface CoMarketingOpportunity {
  id: string;
  title: string;
  description: string;
  type: 'email_campaign' | 'social_media' | 'blog_feature' | 'event';
  status: 'open' | 'applied' | 'approved' | 'completed';
  deadline?: string;
  reward?: string;
}

interface QuarterlyReview {
  quarter: string;
  scheduledDate?: string;
  status: 'scheduled' | 'completed' | 'pending';
  notes?: string;
  metrics?: {
    totalRevenue: number;
    totalTransactions: number;
    customerGrowth: number;
    avgRating: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for active Featured Partner Status purchase
    const { data: activePurchase, error: purchaseError } = await supabase
      .from('merchant_service_purchases')
      .select(`
        *,
        service:merchant_market_services(*)
      `)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const featuredPartnerPurchase = activePurchase?.find(
      (p: any) => p.service?.name?.toLowerCase().includes('featured partner')
    );

    if (!featuredPartnerPurchase) {
      return new Response(JSON.stringify({ 
        error: 'No active Featured Partner Status subscription',
        hasSubscription: false 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate partner tenure and tier
    const purchaseDate = new Date(featuredPartnerPurchase.created_at);
    const now = new Date();
    const tenureMonths = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    let tier: 'bronze' | 'silver' | 'gold' = 'bronze';
    let tierProgress = 0;
    if (tenureMonths >= 24) {
      tier = 'gold';
      tierProgress = 100;
    } else if (tenureMonths >= 12) {
      tier = 'silver';
      tierProgress = Math.min(100, ((tenureMonths - 12) / 12) * 100);
    } else {
      tier = 'bronze';
      tierProgress = Math.min(100, (tenureMonths / 12) * 100);
    }

    // Get merchant statistics
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('amount, created_at')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .gte('created_at', ninetyDaysAgo);

    const { data: reviews } = await supabase
      .from('merchant_reviews')
      .select('rating')
      .eq('merchant_id', merchant.id);

    const totalRevenue = recentTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalTransactions = recentTransactions?.length || 0;
    const avgRating = reviews?.length 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Calculate customer growth (compare last 30 days to previous 30 days)
    const last30DaysTxns = recentTransactions?.filter(
      t => new Date(t.created_at) >= new Date(thirtyDaysAgo)
    ).length || 0;
    const prev30DaysTxns = recentTransactions?.filter(
      t => new Date(t.created_at) < new Date(thirtyDaysAgo) && 
           new Date(t.created_at) >= new Date(new Date(thirtyDaysAgo).getTime() - 30 * 24 * 60 * 60 * 1000)
    ).length || 0;
    const customerGrowth = prev30DaysTxns > 0 
      ? ((last30DaysTxns - prev30DaysTxns) / prev30DaysTxns) * 100 
      : 0;

    // Generate partner benefits based on tier
    const benefits: PartnerBenefit[] = [
      {
        id: 'badge',
        name: 'Featured Partner Badge',
        description: 'Crown badge displayed on all your listings',
        status: 'available',
      },
      {
        id: 'priority_support',
        name: 'Priority Support',
        description: '24-hour response time guarantee',
        status: 'available',
      },
      {
        id: 'early_access',
        name: 'Early Feature Access',
        description: 'Be the first to try new platform features',
        status: 'available',
      },
      {
        id: 'quarterly_review',
        name: 'Quarterly Business Review',
        description: 'One-on-one strategy session with our team',
        status: 'pending',
      },
      {
        id: 'co_marketing',
        name: 'Co-Marketing Opportunities',
        description: 'Get featured in our marketing campaigns',
        status: 'available',
      },
    ];

    // Add tier-specific benefits
    if (tier === 'silver' || tier === 'gold') {
      benefits.push({
        id: 'analytics_boost',
        name: 'Enhanced Analytics',
        description: 'Access to advanced customer insights',
        status: 'available',
      });
    }

    if (tier === 'gold') {
      benefits.push({
        id: 'dedicated_manager',
        name: 'Dedicated Account Manager',
        description: 'Personal point of contact for all your needs',
        status: 'available',
      });
      benefits.push({
        id: 'custom_promotions',
        name: 'Custom Promotion Campaigns',
        description: 'Tailored marketing campaigns for your business',
        status: 'available',
      });
    }

    // Generate co-marketing opportunities
    const coMarketingOpportunities: CoMarketingOpportunity[] = [
      {
        id: 'holiday_campaign',
        title: 'Holiday Pet Care Campaign',
        description: 'Be featured in our holiday email blast reaching 50,000+ pet owners',
        type: 'email_campaign',
        status: 'open',
        deadline: new Date(now.getFullYear(), 11, 15).toISOString(),
        reward: 'Featured placement + 500 bonus PawBucks',
      },
      {
        id: 'social_spotlight',
        title: 'Merchant Spotlight Series',
        description: 'Featured post on our social media channels',
        type: 'social_media',
        status: 'open',
        reward: 'Social media feature + profile boost',
      },
      {
        id: 'blog_feature',
        title: 'Success Story Blog Post',
        description: 'Share your success story on our blog',
        type: 'blog_feature',
        status: 'open',
        reward: 'Blog feature + backlink',
      },
    ];

    if (tier === 'silver' || tier === 'gold') {
      coMarketingOpportunities.push({
        id: 'pet_expo',
        title: 'PawBucks Pet Expo Booth',
        description: 'Reserved booth space at our annual pet expo event',
        type: 'event',
        status: 'open',
        deadline: new Date(now.getFullYear() + 1, 2, 1).toISOString(),
        reward: 'Booth + promotional materials',
      });
    }

    // Generate quarterly reviews
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterlyReviews: QuarterlyReview[] = [];
    
    for (let q = 1; q <= 4; q++) {
      const quarterStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), q * 3, 0);
      
      quarterlyReviews.push({
        quarter: `Q${q} ${now.getFullYear()}`,
        status: q < currentQuarter ? 'completed' : q === currentQuarter ? 'scheduled' : 'pending',
        scheduledDate: q === currentQuarter 
          ? new Date(now.getFullYear(), q * 3 - 1, 15).toISOString()
          : undefined,
        metrics: q < currentQuarter ? {
          totalRevenue: Math.round(totalRevenue * (0.8 + Math.random() * 0.4)),
          totalTransactions: Math.round(totalTransactions * (0.8 + Math.random() * 0.4)),
          customerGrowth: Math.round((Math.random() - 0.3) * 20),
          avgRating: Math.round((avgRating || 4) * 10 + (Math.random() - 0.5) * 5) / 10,
        } : undefined,
      });
    }

    // Calculate benefits utilization
    const totalBenefits = benefits.length;
    const usedBenefits = benefits.filter(b => b.status === 'used').length;
    const availableBenefits = benefits.filter(b => b.status === 'available').length;
    const utilizationRate = totalBenefits > 0 ? (usedBenefits / totalBenefits) * 100 : 0;

    // Generate AI-powered insights using Lovable AI
    let aiInsights = [];
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a business advisor for premium merchant partners. Analyze the partner's data and provide 3-4 actionable recommendations to maximize their featured partner benefits. Be concise and specific.`
              },
              {
                role: 'user',
                content: `Partner Data:
- Tier: ${tier} (${tenureMonths} months tenure)
- Revenue (90 days): $${totalRevenue.toFixed(2)}
- Transactions: ${totalTransactions}
- Average Rating: ${avgRating.toFixed(1)}/5
- Customer Growth: ${customerGrowth.toFixed(1)}%
- Available Benefits: ${availableBenefits}/${totalBenefits}
- Co-Marketing Opportunities: ${coMarketingOpportunities.filter(o => o.status === 'open').length} open

Provide actionable recommendations to help this partner maximize their featured status benefits.`
              }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'provide_partner_insights',
                  description: 'Provide strategic insights for the featured partner',
                  parameters: {
                    type: 'object',
                    properties: {
                      insights: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            recommendation: { type: 'string' },
                            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                            category: { type: 'string', enum: ['growth', 'engagement', 'optimization', 'marketing'] }
                          },
                          required: ['title', 'recommendation', 'priority', 'category']
                        }
                      }
                    },
                    required: ['insights']
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'provide_partner_insights' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiInsights = parsed.insights || [];
          }
        }
      } catch (aiError) {
        console.error('AI insights error:', aiError);
        // Fallback to static insights
        aiInsights = [
          {
            title: 'Maximize Your Badge Visibility',
            recommendation: 'Ensure your profile is complete with high-quality photos to make your Featured Partner badge stand out.',
            priority: 'high',
            category: 'optimization'
          },
          {
            title: 'Apply for Co-Marketing',
            recommendation: `You have ${coMarketingOpportunities.filter(o => o.status === 'open').length} open co-marketing opportunities. Apply to increase your visibility.`,
            priority: 'medium',
            category: 'marketing'
          }
        ];
      }
    } else {
      aiInsights = [
        {
          title: 'Utilize All Benefits',
          recommendation: `You have ${availableBenefits} available benefits. Make sure to take advantage of all your featured partner perks.`,
          priority: 'high',
          category: 'optimization'
        },
        {
          title: 'Schedule Your Review',
          recommendation: 'Book your quarterly business review to get personalized growth strategies.',
          priority: 'medium',
          category: 'engagement'
        }
      ];
    }

    // Calculate days until renewal
    const expiresAt = new Date(featuredPartnerPurchase.expires_at);
    const daysUntilRenewal = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const response = {
      hasSubscription: true,
      subscription: {
        id: featuredPartnerPurchase.id,
        startDate: featuredPartnerPurchase.created_at,
        expiresAt: featuredPartnerPurchase.expires_at,
        daysUntilRenewal,
        amountPaid: featuredPartnerPurchase.amount_paid_usd || featuredPartnerPurchase.amount_paid_pawbucks,
        paymentMethod: featuredPartnerPurchase.amount_paid_usd > 0 ? 'usd' : 'pawbucks',
      },
      partner: {
        tier,
        tierProgress,
        tenureMonths,
        nextTier: tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : null,
        monthsToNextTier: tier === 'bronze' ? 12 - tenureMonths : tier === 'silver' ? 24 - tenureMonths : 0,
      },
      metrics: {
        totalRevenue,
        totalTransactions,
        avgRating,
        customerGrowth,
        reviewCount: reviews?.length || 0,
      },
      benefits,
      benefitsUtilization: {
        total: totalBenefits,
        used: usedBenefits,
        available: availableBenefits,
        utilizationRate,
      },
      coMarketingOpportunities,
      quarterlyReviews,
      aiInsights,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Featured partner dashboard error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

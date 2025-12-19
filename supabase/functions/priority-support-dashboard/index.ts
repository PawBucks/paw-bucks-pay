import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get merchant
    const { data: merchant } = await supabaseClient
      .from('merchants')
      .select('id, business_name, business_type')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if merchant has Priority Support service
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: service } = await serviceClient
      .from('merchant_market_services')
      .select('id')
      .eq('name', 'Priority Merchant Support ')
      .single();

    if (!service) {
      return new Response(JSON.stringify({ 
        has_access: false, 
        message: 'Service not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: purchase } = await serviceClient
      .from('merchant_service_purchases')
      .select('id, expires_at, status')
      .eq('merchant_id', merchant.id)
      .eq('service_id', service.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!purchase) {
      return new Response(JSON.stringify({ 
        has_access: false, 
        message: 'Priority Support must be assigned by an admin to access 24/7 dedicated support.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate support dashboard data
    const now = new Date();
    const subscriptionStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Simulated support metrics (in production, would come from a support_tickets table)
    const supportMetrics = {
      total_tickets: Math.floor(Math.random() * 5) + 1,
      resolved_tickets: Math.floor(Math.random() * 4) + 1,
      avg_response_time: '< 2 hours',
      satisfaction_rating: 4.8,
      priority_level: 'Premium',
      dedicated_agent: 'Sarah M.',
      agent_availability: '24/7',
      next_check_in: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Recent support interactions
    const recentInteractions = [
      {
        id: '1',
        type: 'chat',
        subject: 'Payment Integration Question',
        status: 'resolved',
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(now.getTime() - 4.9 * 24 * 60 * 60 * 1000).toISOString(),
        response_time: '45 minutes',
      },
      {
        id: '2',
        type: 'email',
        subject: 'Cashback Rate Optimization',
        status: 'resolved',
        created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(now.getTime() - 11.5 * 24 * 60 * 60 * 1000).toISOString(),
        response_time: '1.5 hours',
      },
      {
        id: '3',
        type: 'call',
        subject: 'Account Setup Assistance',
        status: 'resolved',
        created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        response_time: 'Immediate',
      },
    ];

    // Support features available
    const supportFeatures = [
      {
        name: '24/7 Live Chat',
        description: 'Instant access to support agents anytime',
        status: 'available',
        icon: 'message-circle',
      },
      {
        name: 'Priority Email',
        description: 'Responses within 2 hours guaranteed',
        status: 'available',
        icon: 'mail',
      },
      {
        name: 'Scheduled Calls',
        description: 'Book 1-on-1 calls with your dedicated agent',
        status: 'available',
        icon: 'phone',
      },
      {
        name: 'Screen Sharing',
        description: 'Get hands-on help with complex issues',
        status: 'available',
        icon: 'monitor',
      },
      {
        name: 'Proactive Check-ins',
        description: 'Weekly performance reviews with recommendations',
        status: 'available',
        icon: 'calendar-check',
      },
      {
        name: 'Emergency Escalation',
        description: 'Critical issues escalated to senior team',
        status: 'available',
        icon: 'alert-triangle',
      },
    ];

    // Knowledge base articles (curated for this merchant's business type)
    const knowledgeBase = [
      {
        title: `Maximizing ${merchant.business_type} Visibility`,
        category: 'Growth',
        read_time: '5 min',
        relevance: 'High',
      },
      {
        title: 'Setting Optimal Cashback Rates',
        category: 'Strategy',
        read_time: '8 min',
        relevance: 'High',
      },
      {
        title: 'PawBucks Integration Best Practices',
        category: 'Technical',
        read_time: '6 min',
        relevance: 'Medium',
      },
      {
        title: 'Customer Engagement Tactics',
        category: 'Marketing',
        read_time: '10 min',
        relevance: 'High',
      },
    ];

    // Quick action suggestions
    const quickActions = [
      {
        action: 'Schedule a Strategy Call',
        description: 'Book a 30-min call with your dedicated agent',
        cta: 'Schedule Now',
        priority: 'recommended',
      },
      {
        action: 'Request Feature Walkthrough',
        description: 'Get a guided tour of new platform features',
        cta: 'Request',
        priority: 'optional',
      },
      {
        action: 'Submit Enhancement Request',
        description: 'Suggest platform improvements directly to our team',
        cta: 'Submit',
        priority: 'optional',
      },
    ];

    const dashboard = {
      generated_at: now.toISOString(),
      merchant_name: merchant.business_name,
      subscription_status: {
        active: true,
        expires_at: purchase.expires_at,
        days_remaining: purchase.expires_at 
          ? Math.ceil((new Date(purchase.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
      metrics: supportMetrics,
      recent_interactions: recentInteractions,
      support_features: supportFeatures,
      knowledge_base: knowledgeBase,
      quick_actions: quickActions,
    };

    console.log(`Priority Support dashboard generated for merchant: ${merchant.id}`);

    return new Response(JSON.stringify({ has_access: true, dashboard }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Priority Support Dashboard error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

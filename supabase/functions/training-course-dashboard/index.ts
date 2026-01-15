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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ has_access: false, message: 'Merchant not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for active Training Course service using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: service } = await serviceClient
      .from('merchant_market_services')
      .select('id, name')
      .eq('name', 'Exclusive Training Course')
      .single();

    if (!service) {
      return new Response(
        JSON.stringify({ has_access: false, message: 'Service not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: purchase } = await serviceClient
      .from('merchant_service_purchases')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('service_id', service.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!purchase) {
      return new Response(
        JSON.stringify({ 
          has_access: false, 
          message: 'Purchase the Exclusive Training Course from the Merchant Market to access this content.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate course content (in production, this would come from a database)
    const modules = [
      {
        id: 'module-1',
        title: 'Getting Started with PawBucks',
        description: 'Learn the fundamentals of the PawBucks platform',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            title: 'Welcome to PawBucks',
            description: 'An introduction to the platform and what you can achieve',
            duration_minutes: 8,
            video_url: null,
            order: 1,
            is_completed: false,
          },
          {
            id: 'lesson-1-2',
            title: 'Setting Up Your Profile',
            description: 'How to create an optimized merchant profile that attracts customers',
            duration_minutes: 12,
            video_url: null,
            order: 2,
            is_completed: false,
          },
          {
            id: 'lesson-1-3',
            title: 'Understanding PawBucks Rewards',
            description: 'How the rewards system works and how to maximize customer engagement',
            duration_minutes: 10,
            video_url: null,
            order: 3,
            is_completed: false,
          },
        ],
      },
      {
        id: 'module-2',
        title: 'Customer Engagement Strategies',
        description: 'Master the art of attracting and retaining customers',
        order: 2,
        lessons: [
          {
            id: 'lesson-2-1',
            title: 'Creating Compelling Offers',
            description: 'Design offers that drive customer action and loyalty',
            duration_minutes: 15,
            video_url: null,
            order: 1,
            is_completed: false,
          },
          {
            id: 'lesson-2-2',
            title: 'Leveraging Reviews',
            description: 'How to encourage and respond to customer reviews',
            duration_minutes: 10,
            video_url: null,
            order: 2,
            is_completed: false,
          },
          {
            id: 'lesson-2-3',
            title: 'Building Customer Loyalty',
            description: 'Strategies for turning one-time buyers into repeat customers',
            duration_minutes: 14,
            video_url: null,
            order: 3,
            is_completed: false,
          },
        ],
      },
      {
        id: 'module-3',
        title: 'Analytics & Growth',
        description: 'Use data to make smarter business decisions',
        order: 3,
        lessons: [
          {
            id: 'lesson-3-1',
            title: 'Understanding Your Dashboard',
            description: 'A deep dive into your analytics dashboard and key metrics',
            duration_minutes: 12,
            video_url: null,
            order: 1,
            is_completed: false,
          },
          {
            id: 'lesson-3-2',
            title: 'Tracking Customer Behavior',
            description: 'How to analyze customer patterns and preferences',
            duration_minutes: 11,
            video_url: null,
            order: 2,
            is_completed: false,
          },
          {
            id: 'lesson-3-3',
            title: 'Growth Strategies',
            description: 'Proven tactics to scale your business on PawBucks',
            duration_minutes: 16,
            video_url: null,
            order: 3,
            is_completed: false,
          },
          {
            id: 'lesson-3-4',
            title: 'Premium Services Deep Dive',
            description: 'Maximize your ROI with premium platform features',
            duration_minutes: 13,
            video_url: null,
            order: 4,
            is_completed: false,
          },
        ],
      },
    ];

    const resources = [
      {
        id: 'resource-1',
        title: 'Merchant Profile Checklist',
        description: 'Ensure your profile is fully optimized with this comprehensive checklist',
        type: 'checklist',
        download_url: '#',
      },
      {
        id: 'resource-2',
        title: 'Customer Engagement Playbook',
        description: 'Step-by-step guide to engaging customers effectively',
        type: 'guide',
        download_url: '#',
      },
      {
        id: 'resource-3',
        title: 'Offer Creation Templates',
        description: 'Ready-to-use templates for creating compelling offers',
        type: 'template',
        download_url: '#',
      },
      {
        id: 'resource-4',
        title: 'Analytics Quick Reference',
        description: 'Quick guide to understanding your key metrics',
        type: 'pdf',
        download_url: '#',
      },
      {
        id: 'resource-5',
        title: 'Growth Strategy Worksheet',
        description: 'Plan your growth strategy with this interactive worksheet',
        type: 'template',
        download_url: '#',
      },
      {
        id: 'resource-6',
        title: 'Best Practices Guide',
        description: 'Industry best practices for pet service businesses',
        type: 'guide',
        download_url: '#',
      },
    ];

    const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
    const completedLessons = modules.reduce(
      (acc, m) => acc + m.lessons.filter(l => l.is_completed).length, 
      0
    );

    const course = {
      title: 'PawBucks Merchant Mastery',
      description: 'Master the PawBucks platform and grow your pet business',
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      progress_percent: Math.round((completedLessons / totalLessons) * 100),
      modules,
      resources,
      certificate_earned: completedLessons === totalLessons,
      started_at: purchase.created_at,
      last_accessed: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ has_access: true, course }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in training-course-dashboard:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

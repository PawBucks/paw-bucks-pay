import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseKey);

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ has_access: false, message: 'Not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ has_access: false, message: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ has_access: false, message: 'Merchant account not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if merchant has purchased the training course service
    const { data: service } = await serviceClient
      .from('merchant_market_services')
      .select('id')
      .ilike('name', '%training%course%')
      .eq('is_active', true)
      .maybeSingle();

    if (!service) {
      return new Response(
        JSON.stringify({ 
          has_access: false, 
          message: 'Training course service is not currently available.' 
        }),
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

    // Fetch course content from database
    const [modulesRes, lessonsRes, resourcesRes, progressRes] = await Promise.all([
      serviceClient
        .from('training_course_modules')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      serviceClient
        .from('training_course_lessons')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      serviceClient
        .from('training_course_resources')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      serviceClient
        .from('merchant_training_progress')
        .select('*')
        .eq('merchant_id', merchant.id)
    ]);

    const dbModules = modulesRes.data || [];
    const dbLessons = lessonsRes.data || [];
    const dbResources = resourcesRes.data || [];
    const progressRecords = progressRes.data || [];

    // Build completed lessons set
    const completedLessons = new Set(
      progressRecords.filter(p => p.completed_at).map(p => p.lesson_id)
    );

    // Build modules with lessons
    const modules = dbModules.map(module => ({
      id: module.id,
      title: module.title,
      description: module.description || '',
      order: module.display_order,
      lessons: dbLessons
        .filter(lesson => lesson.module_id === module.id)
        .map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description || '',
          duration_minutes: lesson.duration_minutes,
          video_url: lesson.video_url,
          order: lesson.display_order,
          is_completed: completedLessons.has(lesson.id),
        }))
    }));

    // Build resources
    const resources = dbResources.map(resource => ({
      id: resource.id,
      title: resource.title,
      description: resource.description || '',
      type: resource.resource_type,
      download_url: resource.download_url || '#',
    }));

    // Calculate progress
    const totalLessons = dbLessons.length;
    const completedCount = completedLessons.size;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const certificateEarned = progressPercent === 100;

    // Get first and last progress timestamps
    const sortedProgress = [...progressRecords].sort(
      (a, b) => new Date(a.started_at || a.created_at).getTime() - new Date(b.started_at || b.created_at).getTime()
    );
    const startedAt = sortedProgress[0]?.started_at || sortedProgress[0]?.created_at || null;
    
    const lastAccessedProgress = [...progressRecords].sort(
      (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )[0];
    const lastAccessed = lastAccessedProgress?.updated_at || lastAccessedProgress?.created_at || null;

    return new Response(
      JSON.stringify({
        has_access: true,
        course: {
          title: 'PawBucks Merchant Mastery',
          description: 'Your comprehensive guide to succeeding on the PawBucks platform',
          total_lessons: totalLessons,
          completed_lessons: completedCount,
          progress_percent: progressPercent,
          modules,
          resources,
          certificate_earned: certificateEarned,
          started_at: startedAt,
          last_accessed: lastAccessed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Training course dashboard error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

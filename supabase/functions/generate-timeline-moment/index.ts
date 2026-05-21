import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stock photo collections by category/mood
const stockPhotoCollections: Record<string, string[]> = {
  vet: [
    "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=400&h=300&fit=crop", // Dog at vet
    "https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=400&h=300&fit=crop", // Happy dog after vet
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Golden retriever smiling
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop", // Dog with bandana
  ],
  grooming: [
    "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&h=300&fit=crop", // Fluffy dog
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Happy golden
    "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&h=300&fit=crop", // Clean golden retriever
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop", // Fresh looking dog
  ],
  food: [
    "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop", // Dog eating
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Happy dog
    "https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&h=300&fit=crop", // Dog with tongue out
    "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400&h=300&fit=crop", // Happy dog portrait
  ],
  daycare: [
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop", // Dogs playing
    "https://images.unsplash.com/photo-1558929996-da64ba858215?w=400&h=300&fit=crop", // Dog at park
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Happy dog
    "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=400&h=300&fit=crop", // Playful dog
  ],
  walker: [
    "https://images.unsplash.com/photo-1558929996-da64ba858215?w=400&h=300&fit=crop", // Dog walking
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop", // Dogs outdoor
    "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=400&h=300&fit=crop", // Happy outdoor dog
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Smiling dog
  ],
  trainer: [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Good boy dog
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop", // Proud dog
    "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&h=300&fit=crop", // Attentive dog
    "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400&h=300&fit=crop", // Smart dog
  ],
  store: [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop", // Happy dog
    "https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&h=300&fit=crop", // Dog with tongue
    "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400&h=300&fit=crop", // Cute dog
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=300&fit=crop", // Dog with treats
  ],
  cat_vet: [
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop", // Cat portrait
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=300&fit=crop", // Orange cat
    "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=300&fit=crop", // Calm cat
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop", // Cute cat
  ],
  cat_grooming: [
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop", // Beautiful cat
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=300&fit=crop", // Fluffy cat
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop", // Clean cat
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&h=300&fit=crop", // Cat with sunglasses
  ],
  cat_food: [
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop", // Happy cat
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop", // Content cat
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=300&fit=crop", // Well-fed cat
    "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400&h=300&fit=crop", // Relaxed cat
  ],
  default: [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop",
  ],
};

function getPhotoForMoment(category: string, petType: string): string {
  const categoryLower = category?.toLowerCase() || '';
  const petPrefix = petType === 'cat' ? 'cat_' : '';
  
  let collection = stockPhotoCollections.default;
  
  if (categoryLower.includes('vet') || categoryLower.includes('clinic') || categoryLower.includes('dental') || categoryLower.includes('medical')) {
    collection = stockPhotoCollections[`${petPrefix}vet`] || stockPhotoCollections.vet;
  } else if (categoryLower.includes('groom') || categoryLower.includes('spa') || categoryLower.includes('bath')) {
    collection = stockPhotoCollections[`${petPrefix}grooming`] || stockPhotoCollections.grooming;
  } else if (categoryLower.includes('food') || categoryLower.includes('nutrition') || categoryLower.includes('treat')) {
    collection = stockPhotoCollections[`${petPrefix}food`] || stockPhotoCollections.food;
  } else if (categoryLower.includes('daycare') || categoryLower.includes('boarding') || categoryLower.includes('kennel')) {
    collection = stockPhotoCollections.daycare;
  } else if (categoryLower.includes('walk') || categoryLower.includes('hike') || categoryLower.includes('outdoor')) {
    collection = stockPhotoCollections.walker;
  } else if (categoryLower.includes('train') || categoryLower.includes('obedience') || categoryLower.includes('behavior')) {
    collection = stockPhotoCollections.trainer;
  } else if (categoryLower.includes('store') || categoryLower.includes('shop') || categoryLower.includes('supply')) {
    collection = stockPhotoCollections.store;
  }
  
  // Pick a random photo from the collection
  return collection[Math.floor(Math.random() * collection.length)];
}

function getMoodForCategory(category: string): string {
  const categoryLower = category?.toLowerCase() || '';
  
  if (categoryLower.includes('vet') || categoryLower.includes('dental') || categoryLower.includes('medical')) {
    return 'brave';
  } else if (categoryLower.includes('groom') || categoryLower.includes('spa')) {
    return 'cozy';
  } else if (categoryLower.includes('walk') || categoryLower.includes('hike') || categoryLower.includes('park')) {
    return 'adventurous';
  } else if (categoryLower.includes('train')) {
    return 'proud';
  } else if (categoryLower.includes('daycare') || categoryLower.includes('play')) {
    return 'playful';
  }
  return 'happy';
}

function getEmojiForCategory(category: string): string {
  const categoryLower = category?.toLowerCase() || '';
  
  if (categoryLower.includes('dental')) return '😷';
  if (categoryLower.includes('vet') || categoryLower.includes('medical') || categoryLower.includes('clinic')) return '🏥';
  if (categoryLower.includes('groom') || categoryLower.includes('spa') || categoryLower.includes('bath')) return '✨';
  if (categoryLower.includes('food') || categoryLower.includes('treat') || categoryLower.includes('nutrition')) return '🍖';
  if (categoryLower.includes('walk') || categoryLower.includes('hike')) return '🚶';
  if (categoryLower.includes('train')) return '🎓';
  if (categoryLower.includes('daycare') || categoryLower.includes('boarding')) return '🏠';
  if (categoryLower.includes('store') || categoryLower.includes('shop')) return '🛍️';
  return '🐾';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transactionId, petId, userId, petName, petType, merchantName, merchantCategory, amount, pawbucksEarned, description } = await req.json();
    
    console.log("[generate-timeline-moment] Generating moment for:", { transactionId, petName, merchantName, amount });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get day of week for narrative
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const emoji = getEmojiForCategory(merchantCategory || description || '');
    const mood = getMoodForCategory(merchantCategory || description || '');
    const photoUrl = getPhotoForMoment(merchantCategory || description || '', petType || 'dog');

    // Generate narrative using AI - GROUNDED IN REAL DATA ONLY
    // Generate FUN narrative using AI - but ONLY from real data
    const prompt = `You are a playful, warm storyteller creating timeline moments for pet owners. Make it FUN and EMOTIONAL while using ONLY the real data provided.

REAL EVENT DATA:
- Pet Name: ${petName || 'Pet'}
- Pet Type: ${petType || 'pet'}
- Day: ${dayName}
- Merchant: ${merchantName || 'Pet Business'}
- Service: ${merchantCategory || 'Pet Services'}
- Amount: $${amount?.toFixed(2) || '0.00'}
- PawBucks Earned: ${pawbucksEarned || 0}
- Description: ${description || ''}

CREATE A FUN MOMENT:
1. Use playful language, emojis in the narrative, and pet personality
2. Add warmth and charm - make pet owners smile!
3. You CAN use phrases like "rocked it", "nailed it", "like a boss", "VIP treatment"
4. You CAN describe the type of service in a fun way (e.g., "spa day" for grooming, "health check" for vet)
5. Do NOT invent specific events that didn't happen (no "made friends", "got treats", "was scared")
6. The reward/PawBucks should feel celebratory

GOOD examples (fun but factual):
- "✨ ${petName}'s ${dayName} Glow-Up! Spa day at ${merchantName} = one fresh pupper. +${pawbucksEarned} PawBucks in the bank!"
- "🏥 Health check complete! ${petName} crushed it at the vet today. $${amount?.toFixed(2)} well spent → ${pawbucksEarned} PawBucks earned!"
- "🍖 Treat run! ${petName}'s pantry just got restocked at ${merchantName}. Cha-ching: +${pawbucksEarned} PawBucks!"

BAD examples (invents fake events - NEVER DO):
- "Made so many friends today!" (no friend data)
- "Got a special treat for being brave!" (no treat data)
- "The groomer said she was the cutest!" (no groomer feedback data)

Respond ONLY in JSON format:
{"title": "Catchy 3-5 Word Title", "narrative": "Fun 1-2 sentence narrative with emoji."}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a creative writer who creates adorable, emotional pet timeline moments. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("[generate-timeline-moment] AI API error:", aiResponse.status);
      // Fallback to template-based narrative - FACTUAL ONLY
      const fallbackTitle = `${merchantCategory || 'Visit'} at ${merchantName || 'Pet Business'}`;
      const fallbackNarrative = `${petName || 'Pet'} had ${merchantCategory?.toLowerCase() || 'a service'} at ${merchantName || 'a local business'}. $${amount?.toFixed(2) || '0.00'} spent → ${pawbucksEarned || 0} PawBucks earned!`;
      
      const { data: moment, error: insertError } = await supabase
        .from("pet_timeline_moments")
        .insert({
          pet_id: petId,
          user_id: userId,
          transaction_id: transactionId,
          title: fallbackTitle,
          narrative: fallbackNarrative,
          emoji,
          photo_url: photoUrl,
          photo_prompt: merchantCategory || description,
          merchant_name: merchantName,
          merchant_category: merchantCategory,
          amount,
          pawbucks_earned: pawbucksEarned,
          moment_type: 'transaction',
          mood,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[generate-timeline-moment] Insert error:", insertError);
        throw insertError;
      }

      return new Response(JSON.stringify({ success: true, moment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    
    console.log("[generate-timeline-moment] AI response:", aiContent);

    // Factual fallback defaults
    let title = `${merchantCategory || 'Visit'} at ${merchantName || 'Pet Business'}`;
    let narrative = `${petName || 'Pet'} had ${merchantCategory?.toLowerCase() || 'a service'} at ${merchantName || 'a local business'}. $${amount?.toFixed(2) || '0.00'} spent → ${pawbucksEarned || 0} PawBucks earned!`;

    try {
      // Try to parse AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) title = parsed.title;
        if (parsed.narrative) narrative = parsed.narrative;
      }
    } catch (parseError) {
      console.log("[generate-timeline-moment] Parse error, using fallback:", parseError);
    }

    // Insert moment into database
    const { data: moment, error: insertError } = await supabase
      .from("pet_timeline_moments")
      .insert({
        pet_id: petId,
        user_id: userId,
        transaction_id: transactionId,
        title,
        narrative,
        emoji,
        photo_url: photoUrl,
        photo_prompt: merchantCategory || description,
        merchant_name: merchantName,
        merchant_category: merchantCategory,
        amount,
        pawbucks_earned: pawbucksEarned,
        moment_type: 'transaction',
        mood,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[generate-timeline-moment] Insert error:", insertError);
      throw insertError;
    }

    console.log("[generate-timeline-moment] Created moment:", moment.id);

    return new Response(JSON.stringify({ success: true, moment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[generate-timeline-moment] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { assessment_id } = await req.json();

    if (!assessment_id) {
      throw new Error("Missing required field: assessment_id");
    }

    // Fetch the assessment data and verify ownership (owner or assigned vet)
    const { data: assessment, error: fetchError } = await supabase
      .from("symptom_triage_assessments")
      .select(`
        *,
        pet:pet_profiles(name, species, breed, date_of_birth, weight)
      `)
      .eq("id", assessment_id)
      .single();

    if (fetchError || !assessment) {
      throw new Error("Assessment not found");
    }

    if (assessment.owner_id !== user.id && assessment.vet_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing symptom triage for assessment ${assessment_id}`);

    // Update status to analyzing
    await supabase
      .from("symptom_triage_assessments")
      .update({ status: "analyzing" })
      .eq("id", assessment_id);

    const startTime = Date.now();

    // Calculate pet age
    let petAge = "Unknown";
    if (assessment.pet?.date_of_birth) {
      const birthDate = new Date(assessment.pet.date_of_birth);
      const now = new Date();
      const years = Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const months = Math.floor(((now.getTime() - birthDate.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
      petAge = years > 0 ? `${years} years${months > 0 ? `, ${months} months` : ""}` : `${months} months`;
    }

    const systemPrompt = `You are an expert veterinary triage AI assistant. Your role is to analyze pet owner-reported symptoms and provide an urgency assessment to help veterinarians prioritize cases.

CRITICAL GUIDELINES:
1. Always err on the side of caution - pet safety is paramount
2. Consider species-specific concerns (dogs vs cats)
3. Account for pet age when assessing severity
4. Flag any potential emergency symptoms immediately
5. Provide clear, actionable recommendations

URGENCY LEVELS:
- Emergency (9-10): Life-threatening, requires immediate veterinary attention
- Urgent (7-8): Serious condition, should be seen within 24 hours
- Soon (4-6): Concerning but stable, appointment within 48-72 hours
- Routine (1-3): Minor concerns, can wait for regular appointment

You must be thorough but also calming - owners are often worried.`;

    const userPrompt = `Please analyze the following symptom report and provide a comprehensive triage assessment:

PATIENT INFORMATION:
- Name: ${assessment.pet?.name || "Unknown"}
- Species: ${assessment.pet?.species || "Unknown"}
- Breed: ${assessment.pet?.breed || "Unknown"}
- Age: ${petAge}
- Weight: ${assessment.pet?.weight ? `${assessment.pet.weight} lbs` : "Unknown"}

CHIEF COMPLAINT:
${assessment.chief_complaint}

SYMPTOM DETAILS:
- Duration: ${assessment.symptom_duration || "Not specified"}
- Onset: ${assessment.symptom_onset || "Not specified"}
- Progression: ${assessment.symptom_progression || "Not specified"}

REPORTED SYMPTOMS:
${JSON.stringify(assessment.symptoms, null, 2)}

AFFECTED BODY AREAS:
${JSON.stringify(assessment.affected_body_areas, null, 2)}

BEHAVIORAL CHANGES:
${JSON.stringify(assessment.behavioral_changes, null, 2)}

VITAL OBSERVATIONS:
- Eating: ${assessment.eating_status || "Not reported"}
- Drinking: ${assessment.drinking_status || "Not reported"}
- Energy Level: ${assessment.energy_level || "Not reported"}
- Bathroom Habits: ${assessment.bathroom_habits || "Not reported"}

ADDITIONAL CONTEXT:
- Recent Changes: ${assessment.recent_changes || "None reported"}
- Current Medications: ${assessment.current_medications || "None reported"}
- Known Allergies: ${assessment.known_allergies || "None reported"}
- Owner Notes: ${assessment.additional_notes || "None"}

Provide your assessment in the following JSON format:
{
  "urgency_score": <number 1-10>,
  "urgency_level": "<routine|soon|urgent|emergency>",
  "summary": "<2-3 sentence summary for the veterinarian>",
  "differential_considerations": [
    {"condition": "name", "likelihood": "high|moderate|low", "reasoning": "brief explanation"}
  ],
  "recommended_questions": [
    "Question the vet should ask the owner"
  ],
  "recommended_diagnostics": [
    {"test": "name", "priority": "high|medium|low", "reasoning": "why this test"}
  ],
  "triage_reasoning": "<detailed explanation of urgency assessment>"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI service quota exceeded. Please contact support.");
      }
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI service");
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    const processingTime = Date.now() - startTime;

    // Update the assessment with AI analysis
    const { error: updateError } = await supabase
      .from("symptom_triage_assessments")
      .update({
        status: "ready",
        ai_urgency_score: parsedContent.urgency_score,
        ai_urgency_level: parsedContent.urgency_level,
        ai_summary: parsedContent.summary,
        ai_differential_considerations: parsedContent.differential_considerations || [],
        ai_recommended_questions: parsedContent.recommended_questions || [],
        ai_recommended_diagnostics: parsedContent.recommended_diagnostics || [],
        ai_triage_reasoning: parsedContent.triage_reasoning,
        model_used: "google/gemini-2.5-flash",
        processing_time_ms: processingTime,
      })
      .eq("id", assessment_id);

    if (updateError) {
      console.error("Error updating assessment:", updateError);
      throw new Error("Failed to save AI analysis");
    }

    console.log(`Symptom triage ${assessment_id} completed in ${processingTime}ms - Urgency: ${parsedContent.urgency_level}`);

    return new Response(
      JSON.stringify({
        success: true,
        assessment_id,
        processing_time_ms: processingTime,
        urgency_score: parsedContent.urgency_score,
        urgency_level: parsedContent.urgency_level,
        summary: parsedContent.summary
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-symptom-triage:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

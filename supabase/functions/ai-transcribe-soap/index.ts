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

    const { draft_id, transcription, pet_name, pet_species, pet_breed, pet_age } = await req.json();

    if (!draft_id || !transcription) {
      throw new Error("Missing required fields: draft_id and transcription");
    }

    console.log(`Processing SOAP draft ${draft_id} with transcription length: ${transcription.length}`);

    // Verify ownership: requesting user must be the vet that owns the draft
    const { data: draftRow, error: draftErr } = await supabase
      .from("ai_soap_drafts")
      .select("id, vet_id")
      .eq("id", draft_id)
      .maybeSingle();
    if (draftErr || !draftRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: vetRow } = await supabase
      .from("partner_vets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!vetRow || vetRow.id !== draftRow.vet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to generating
    await supabase
      .from("ai_soap_drafts")
      .update({ status: "generating", transcription })
      .eq("id", draft_id);

    const startTime = Date.now();

    // Generate SOAP content using AI
    const systemPrompt = `You are an expert veterinary medical scribe assistant. Your task is to convert raw voice transcription from a veterinary examination into structured SOAP note sections.

You must extract and organize information into these sections:
1. SUBJECTIVE: Owner's reported concerns, history, and observations
2. OBJECTIVE: Clinical findings, vital signs, physical examination results
3. ASSESSMENT (suggested): Potential diagnoses based on findings
4. PLAN (suggested): Recommended treatments, tests, or follow-ups

Guidelines:
- Use professional veterinary medical terminology
- Be concise but thorough
- Extract any mentioned vital signs (temperature, weight, heart rate, respiratory rate)
- Identify symptoms and clinical observations
- If information for a section is not present in the transcription, indicate "Not documented in examination"
- Format vital signs consistently (e.g., "Temperature: 101.5°F, Weight: 25 lbs")

Patient context:
- Name: ${pet_name || "Unknown"}
- Species: ${pet_species || "Unknown"}
- Breed: ${pet_breed || "Unknown"}
- Age: ${pet_age || "Unknown"}`;

    const userPrompt = `Please analyze the following veterinary examination transcription and generate structured SOAP note content:

TRANSCRIPTION:
"""
${transcription}
"""

Respond in the following JSON format:
{
  "subjective": "Owner-reported information and history",
  "objective": "Physical examination findings and vital signs",
  "suggested_assessment": "Preliminary diagnostic considerations",
  "suggested_plan": "Recommended next steps and treatments",
  "extracted_vitals": {
    "temperature": null or number,
    "weight": null or number,
    "heart_rate": null or number,
    "respiratory_rate": null or number,
    "body_condition_score": null or number
  },
  "extracted_symptoms": ["symptom1", "symptom2"],
  "extracted_observations": ["observation1", "observation2"]
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
        temperature: 0.3,
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

    // Update the draft with AI-generated content
    const { error: updateError } = await supabase
      .from("ai_soap_drafts")
      .update({
        status: "ready",
        ai_subjective: parsedContent.subjective || "Not documented",
        ai_objective: parsedContent.objective || "Not documented",
        ai_suggested_assessment: parsedContent.suggested_assessment || "Pending evaluation",
        ai_suggested_plan: parsedContent.suggested_plan || "To be determined",
        extracted_vitals: parsedContent.extracted_vitals || {},
        extracted_symptoms: parsedContent.extracted_symptoms || [],
        extracted_observations: parsedContent.extracted_observations || [],
        model_used: "google/gemini-2.5-flash",
        processing_time_ms: processingTime,
      })
      .eq("id", draft_id);

    if (updateError) {
      console.error("Error updating draft:", updateError);
      throw new Error("Failed to save AI-generated content");
    }

    console.log(`SOAP draft ${draft_id} processed successfully in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        draft_id,
        processing_time_ms: processingTime,
        content: parsedContent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-transcribe-soap:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

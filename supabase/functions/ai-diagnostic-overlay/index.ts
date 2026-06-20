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

    const { 
      analysis_id, 
      image_urls, 
      analysis_type, 
      pet_name, 
      pet_species, 
      pet_breed, 
      pet_age,
      body_part,
      clinical_context 
    } = await req.json();

    if (!analysis_id || !image_urls || image_urls.length === 0 || !analysis_type) {
      throw new Error("Missing required fields: analysis_id, image_urls, and analysis_type");
    }

    console.log(`Processing diagnostic analysis ${analysis_id} for ${analysis_type}`);

    // Verify ownership: caller must be the vet that owns this analysis
    const { data: analysisRow, error: analysisErr } = await supabase
      .from("diagnostic_ai_analyses")
      .select("id, vet_id")
      .eq("id", analysis_id)
      .maybeSingle();
    if (analysisErr || !analysisRow) {
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
    if (!vetRow || vetRow.id !== analysisRow.vet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to analyzing
    await supabase
      .from("diagnostic_ai_analyses")
      .update({ status: "analyzing" })
      .eq("id", analysis_id);

    const startTime = Date.now();

    // Build analysis prompt based on type
    const analysisPrompts: Record<string, string> = {
      xray: `You are an expert veterinary radiologist AI assistant. Analyze this X-ray image for potential abnormalities.

Focus on:
- Skeletal structures: fractures, arthritis, bone lesions, joint abnormalities
- Thoracic: cardiac silhouette, lung fields, pleural space, mediastinum
- Abdominal: organ size/shape, foreign bodies, masses, gas patterns
- Soft tissue: calcifications, swelling, masses

Always note normal findings as well as abnormalities.`,

      ultrasound: `You are an expert veterinary sonographer AI assistant. Analyze this ultrasound image for potential abnormalities.

Focus on:
- Organ architecture and echogenicity
- Presence of masses, cysts, or fluid
- Vascular patterns
- Size and shape abnormalities
- Any areas of concern`,

      ct: `You are an expert veterinary CT imaging specialist. Analyze this CT scan for potential abnormalities.

Focus on:
- Cross-sectional anatomy
- Tissue density variations
- Mass lesions
- Vascular abnormalities
- Bone and soft tissue changes`,

      mri: `You are an expert veterinary MRI specialist. Analyze this MRI scan for potential abnormalities.

Focus on:
- Signal intensity changes
- Mass effect
- Edema patterns
- Structural abnormalities
- Contrast enhancement patterns`,

      bloodwork: `You are an expert veterinary clinical pathologist. Analyze these laboratory results for abnormalities.

Focus on:
- Complete blood count abnormalities
- Chemistry panel deviations
- Patterns suggesting organ dysfunction
- Infection or inflammation markers
- Electrolyte imbalances`,

      ecg: `You are an expert veterinary cardiologist. Analyze this ECG/EKG for cardiac abnormalities.

Focus on:
- Heart rate and rhythm
- P wave morphology
- QRS complex characteristics
- ST segment changes
- Arrhythmias or conduction abnormalities`,
    };

    const systemPrompt = analysisPrompts[analysis_type] || `You are an expert veterinary diagnostic AI assistant. Analyze the provided diagnostic image/data for potential abnormalities.`;

    const fullSystemPrompt = `${systemPrompt}

CRITICAL GUIDELINES:
1. This is a decision-support tool - all findings must be verified by a licensed veterinarian
2. Be thorough but clearly indicate confidence levels
3. Differentiate between definite findings, possible findings, and artifacts
4. Always recommend follow-up studies when appropriate
5. Consider species-specific normal variations

OUTPUT FORMAT:
Provide structured findings that can be overlaid on the image and used for clinical decision-making.`;

    const userPrompt = `Please analyze the following diagnostic study:

PATIENT INFORMATION:
- Name: ${pet_name || "Unknown"}
- Species: ${pet_species || "Unknown"}  
- Breed: ${pet_breed || "Unknown"}
- Age: ${pet_age || "Unknown"}

STUDY DETAILS:
- Type: ${analysis_type.toUpperCase()}
- Body Part/Region: ${body_part || "Not specified"}
- Clinical Context: ${clinical_context || "Routine examination"}

IMAGE(S) TO ANALYZE:
${image_urls.map((url: string, i: number) => `Image ${i + 1}: ${url}`).join("\n")}

Provide your analysis in the following JSON format:
{
  "findings": [
    {
      "finding": "Description of finding",
      "location": "Anatomical location",
      "significance": "normal|incidental|mild|moderate|severe",
      "confidence": 0.0-1.0
    }
  ],
  "anomalies_detected": [
    {
      "anomaly": "Description",
      "location": "Where on image (if applicable)",
      "region": {"description": "anatomical region"},
      "severity": "mild|moderate|severe",
      "confidence": 0.0-1.0,
      "differential_diagnoses": ["possibility1", "possibility2"]
    }
  ],
  "measurements": {
    "vhs": null or number (vertebral heart score for thoracic),
    "other_measurements": {}
  },
  "confidence_score": 0.0-1.0,
  "summary": "Overall assessment summary",
  "recommendations": "Suggested follow-up or additional studies",
  "severity_assessment": "normal|mild|moderate|severe|critical"
}`;

    // For image analysis, we use the vision-capable model
    const messages: any[] = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Add images if they're actual image URLs (for vision model)
    const isImageAnalysis = ["xray", "ultrasound", "ct", "mri", "ecg"].includes(analysis_type);
    
    if (isImageAnalysis && image_urls.some((url: string) => url.startsWith("http"))) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...image_urls.map((url: string) => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Using pro for complex medical imaging analysis
        messages,
        temperature: 0.1, // Low temperature for medical accuracy
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

    // Update the analysis with AI findings
    const { error: updateError } = await supabase
      .from("diagnostic_ai_analyses")
      .update({
        status: "ready",
        ai_findings: parsedContent.findings || [],
        ai_anomalies_detected: parsedContent.anomalies_detected || [],
        ai_measurements: parsedContent.measurements || {},
        ai_confidence_score: parsedContent.confidence_score,
        ai_summary: parsedContent.summary,
        ai_recommendations: parsedContent.recommendations,
        severity_assessment: parsedContent.severity_assessment,
        model_used: "google/gemini-2.5-pro",
        processing_time_ms: processingTime,
      })
      .eq("id", analysis_id);

    if (updateError) {
      console.error("Error updating analysis:", updateError);
      throw new Error("Failed to save AI analysis");
    }

    console.log(`Diagnostic analysis ${analysis_id} completed in ${processingTime}ms - Severity: ${parsedContent.severity_assessment}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id,
        processing_time_ms: processingTime,
        severity: parsedContent.severity_assessment,
        findings_count: parsedContent.findings?.length || 0,
        anomalies_count: parsedContent.anomalies_detected?.length || 0,
        summary: parsedContent.summary
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-diagnostic-overlay:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

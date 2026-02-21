import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { documents, pet_id } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pet info for context
    const { data: pet } = await supabase
      .from("pet_profiles")
      .select("name, type, breed")
      .eq("id", pet_id)
      .single();

    const results: any[] = [];

    for (const doc of documents) {
      try {
        const prompt = `You are a veterinary document classifier. Classify the following document sent to a pet's health email inbox.

Pet: ${pet?.name || "Unknown"} (${pet?.type || "unknown"} ${pet?.breed ? `- ${pet.breed}` : ""})

Document details:
- File name: ${doc.file_name}
- File type: ${doc.file_type}
- Sender email: ${doc.sender_email || "unknown"}
- Sender name: ${doc.sender_name || "unknown"}
- Email subject: ${doc.email_subject || "none"}
- Email body snippet: ${doc.email_body_snippet || "none"}

Classify this document into exactly ONE category and provide a brief summary.`;

        const response = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: "You are a veterinary document classifier. Always respond using the classify_document tool.",
                },
                { role: "user", content: prompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_document",
                    description: "Classify a veterinary document into a category",
                    parameters: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          enum: [
                            "vaccine",
                            "lab_result",
                            "prescription",
                            "imaging",
                            "surgical",
                            "dental",
                            "wellness",
                            "insurance",
                            "invoice",
                            "other",
                          ],
                          description: "The document category",
                        },
                        confidence: {
                          type: "number",
                          minimum: 0,
                          maximum: 1,
                          description: "Confidence score 0-1",
                        },
                        summary: {
                          type: "string",
                          description:
                            "Brief 1-2 sentence summary of the document",
                        },
                      },
                      required: ["category", "confidence", "summary"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "classify_document" },
              },
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            console.warn("AI rate limited, skipping categorization for", doc.id);
            continue;
          }
          if (response.status === 402) {
            console.warn("AI payment required, skipping categorization");
            break;
          }
          const errText = await response.text();
          console.error("AI error:", response.status, errText);
          continue;
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

        if (toolCall?.function?.arguments) {
          const classification = JSON.parse(toolCall.function.arguments);

          // Update document with AI classification
          await supabase
            .from("pet_inbound_documents")
            .update({
              category: classification.category,
              ai_confidence: Math.min(classification.confidence, 0.99),
              ai_summary: classification.summary,
            })
            .eq("id", doc.id);

          results.push({
            documentId: doc.id,
            category: classification.category,
            confidence: classification.confidence,
            summary: classification.summary,
          });
        }
      } catch (docErr) {
        console.error("Error categorizing document", doc.id, docErr);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

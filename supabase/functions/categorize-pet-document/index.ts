import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map document categories to medical_record_type enum values
const CATEGORY_TO_RECORD_TYPE: Record<string, string> = {
  vaccine: "vaccination",
  lab_result: "lab_results",
  prescription: "prescription",
  imaging: "other",
  surgical: "surgery",
  dental: "dental",
  wellness: "checkup",
  // invoice and insurance don't create medical records
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
      .select("name, type, breed, user_id")
      .eq("id", pet_id)
      .single();

    const results: any[] = [];

    for (const doc of documents) {
      try {
        const prompt = `You are a veterinary document classifier and medical record extractor. Analyze the following document sent to a pet's health email inbox.

Pet: ${pet?.name || "Unknown"} (${pet?.type || "unknown"} ${pet?.breed ? `- ${pet.breed}` : ""})

Document details:
- File name: ${doc.file_name}
- File type: ${doc.file_type}
- Sender email: ${doc.sender_email || "unknown"}
- Sender name: ${doc.sender_name || "unknown"}
- Email subject: ${doc.email_subject || "none"}
- Email body snippet: ${doc.email_body_snippet || "none"}

Classify this document AND extract any medical record information from the email body/subject.`;

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
                  content: "You are a veterinary document classifier and medical data extractor. Always respond using the classify_and_extract tool.",
                },
                { role: "user", content: prompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_and_extract",
                    description: "Classify a veterinary document and extract medical record data",
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
                          description: "Brief 1-2 sentence summary of the document",
                        },
                        is_medical: {
                          type: "boolean",
                          description: "Whether this contains actionable medical information that should be added to health records"
                        },
                        medical_records: {
                          type: "array",
                          description: "Extracted medical record line items (empty if not medical)",
                          items: {
                            type: "object",
                            properties: {
                              title: {
                                type: "string",
                                description: "Name of procedure, medication, test, vaccination, etc."
                              },
                              record_type: {
                                type: "string",
                                enum: ["vaccination", "checkup", "surgery", "lab_results", "prescription", "dental", "emergency", "other"],
                                description: "Type of medical record"
                              },
                              description: {
                                type: "string",
                                description: "Additional details, dosage, instructions, results, etc."
                              },
                              price: {
                                type: "number",
                                description: "Cost if mentioned, or null"
                              },
                              record_date: {
                                type: "string",
                                description: "Date of the procedure/record in YYYY-MM-DD format if found"
                              }
                            },
                            required: ["title", "record_type"]
                          }
                        },
                        visit_date: {
                          type: "string",
                          description: "Visit date in YYYY-MM-DD format if found in the document"
                        },
                        vet_name: {
                          type: "string",
                          description: "Vet clinic name if identifiable from sender"
                        },
                        doctor_name: {
                          type: "string",
                          description: "Doctor name if found"
                        }
                      },
                      required: ["category", "confidence", "summary", "is_medical"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "classify_and_extract" },
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

          // Auto-create medical records if this is medical content
          if (classification.is_medical && classification.medical_records?.length > 0 && pet?.user_id) {
            try {
              const visitDate = classification.visit_date || new Date().toISOString().split("T")[0];

              // Create a medical visit
              const { data: visit } = await supabase
                .from("pet_medical_visits")
                .insert({
                  pet_id: pet_id,
                  user_id: pet.user_id,
                  visit_date: visitDate,
                  notes: `Auto-created from email: ${doc.email_subject || doc.file_name}`,
                  vet_name: classification.vet_name || doc.sender_name || null,
                  doctor_name: classification.doctor_name || null,
                })
                .select()
                .single();

              if (visit) {
                for (const record of classification.medical_records) {
                  await supabase
                    .from("pet_medical_records")
                    .insert({
                      visit_id: visit.id,
                      pet_id: pet_id,
                      user_id: pet.user_id,
                      record_type: record.record_type || "other",
                      title: record.title,
                      record_date: record.record_date || visitDate,
                      description: record.description || null,
                      price: record.price != null ? parseFloat(record.price) : null,
                      file_url: doc.file_url || null,
                    });
                }

                // Notify the pet owner
                await supabase.from("notifications").insert({
                  user_id: pet.user_id,
                  title: "📋 Medical Records Auto-Added",
                  message: `${classification.medical_records.length} record(s) from ${classification.vet_name || doc.sender_name || "your vet"} have been added to ${pet.name}'s health history.`,
                  category: "transactional",
                  link_url: `/pet-health/${pet_id}?tab=records`,
                });
              }
            } catch (medErr) {
              console.error("Error creating medical records from email:", medErr);
              // Non-blocking - categorization still succeeded
            }
          }

          results.push({
            documentId: doc.id,
            category: classification.category,
            confidence: classification.confidence,
            summary: classification.summary,
            medicalRecordsCreated: classification.medical_records?.length || 0,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  // SECURITY: This function uses the service-role client to write medical
  // records, visits, and notifications for any pet. It must only be invoked
  // server-to-server (e.g. from `receive-pet-email`) — never directly from
  // unauthenticated clients. Enforce the shared internal-secret guard.
  const authResp = await checkInternalSecret(req, corsHeaders);
  if (authResp) return authResp;

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

Classify this document AND extract medical record information from the attachment (if provided), email body and subject.

If the document is an INVOICE, RECEIPT or BILL (category "invoice"), you MUST also extract:
- every billed line item into invoice_items (description, quantity, unit_price, amount)
- subtotal, tax and total amounts, plus the invoice number and visit/service date
Invoices always count as records worth adding to the pet's medical history, so set is_medical to true for them.`;

        // Attach the file itself when possible so line items can be read
        // straight off the invoice PDF/image instead of just the email body.
        let fileDataUrl: string | null = null;
        const attachableTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"];
        if (doc.file_url && doc.file_type && attachableTypes.includes(String(doc.file_type).toLowerCase())) {
          try {
            const fileRes = await fetch(doc.file_url);
            if (fileRes.ok) {
              const buf = new Uint8Array(await fileRes.arrayBuffer());
              if (buf.length > 0 && buf.length < 15_000_000) {
                let binary = "";
                for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
                fileDataUrl = `data:${doc.file_type};base64,${btoa(binary)}`;
              }
            }
          } catch (fileErr) {
            console.warn("Could not attach document for AI extraction:", doc.file_name, fileErr);
          }
        }

        const userContent: any = fileDataUrl
          ? [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: fileDataUrl } },
            ]
          : prompt;

        const callAi = (content: any) => fetch(
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
                { role: "user", content },
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
                        invoice_items: {
                          type: "array",
                          description: "Billed line items when the document is an invoice/receipt/bill (empty otherwise)",
                          items: {
                            type: "object",
                            properties: {
                              description: { type: "string", description: "Line item description as printed" },
                              quantity: { type: "number", description: "Quantity billed, default 1" },
                              unit_price: { type: "number", description: "Price per unit" },
                              amount: { type: "number", description: "Extended line total (quantity x unit_price)" },
                              record_type: {
                                type: "string",
                                enum: ["vaccination", "checkup", "surgery", "lab_results", "prescription", "dental", "emergency", "other"],
                                description: "Best-fit medical record type for this line item"
                              }
                            },
                            required: ["description"]
                          }
                        },
                        invoice_number: { type: "string", description: "Invoice or receipt number if printed" },
                        invoice_subtotal: { type: "number", description: "Invoice subtotal before tax" },
                        invoice_tax: { type: "number", description: "Tax amount on the invoice" },
                        invoice_total: { type: "number", description: "Invoice grand total charged" },
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

        let response = await callAi(userContent);
        // If the multimodal call was rejected, retry with text only so the
        // document still gets categorized.
        if (!response.ok && fileDataUrl) {
          console.warn("Multimodal AI call failed, retrying text-only for", doc.file_name, response.status);
          response = await callAi(prompt);
        }


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

          // Build the list of records to add to the pet's medical history.
          // Invoices contribute one record per billed line item so the visit,
          // items and totals all land in the health history automatically.
          const invoiceItems: any[] = Array.isArray(classification.invoice_items)
            ? classification.invoice_items.filter((i: any) => i && i.description)
            : [];
          const isInvoice = classification.category === "invoice" || invoiceItems.length > 0;

          const toNum = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
          const invoiceTotal = toNum(classification.invoice_total);
          const invoiceSubtotal = toNum(classification.invoice_subtotal);
          const invoiceTax = toNum(classification.invoice_tax);

          const baseRecords: any[] = Array.isArray(classification.medical_records)
            ? classification.medical_records.filter((r: any) => r && r.title)
            : [];

          const itemRecords = invoiceItems.map((item: any) => {
            const qty = toNum(item.quantity);
            const unit = toNum(item.unit_price);
            const amount = toNum(item.amount) ?? (qty !== null && unit !== null ? qty * unit : null);
            const parts: string[] = [];
            if (qty !== null) parts.push(`Qty ${qty}`);
            if (unit !== null) parts.push(`@ $${unit.toFixed(2)}`);
            if (amount !== null) parts.push(`= $${amount.toFixed(2)}`);
            return {
              title: String(item.description).slice(0, 200),
              record_type: item.record_type || "other",
              description: parts.length ? `Invoice line item — ${parts.join(" ")}` : "Invoice line item",
              quantity: qty !== null && qty > 0 ? Math.round(qty) : 1,
              price: amount,
              record_date: null,
            };
          });

          // For invoices, the billed line items are the authoritative list —
          // the AI's generic medical_records often restate the same charges,
          // which would double-count the visit total. Only keep medical records
          // whose title doesn't already appear as a line item.
          const norm = (s: any) => String(s || "").trim().toLowerCase();
          const itemTitles = new Set(itemRecords.map((r: any) => norm(r.title)));
          const extraRecords = isInvoice
            ? baseRecords.filter((r: any) => !itemTitles.has(norm(r.title)) && r.price == null)
            : baseRecords;
          const seen = new Set<string>();
          const recordsToInsert = [...itemRecords, ...extraRecords].filter((r: any) => {
            const key = `${norm(r.title)}|${r.price ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          if ((classification.is_medical || isInvoice) && recordsToInsert.length > 0 && pet?.user_id) {
            try {
              const visitDate = classification.visit_date || new Date().toISOString().split("T")[0];
              const docTag = `[doc:${doc.id}]`;

              // Idempotency: never create a second visit for the same document.
              const { data: existingVisit } = await supabase
                .from("pet_medical_visits")
                .select("id")
                .eq("pet_id", pet_id)
                .ilike("notes", `%${docTag}%`)
                .maybeSingle();

              const totalsLine = isInvoice
                ? [
                    classification.invoice_number ? `Invoice #${classification.invoice_number}` : null,
                    invoiceSubtotal !== null ? `Subtotal $${invoiceSubtotal.toFixed(2)}` : null,
                    invoiceTax !== null ? `Tax $${invoiceTax.toFixed(2)}` : null,
                    invoiceTotal !== null ? `Total $${invoiceTotal.toFixed(2)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "";

              let visit = existingVisit;
              if (!visit) {
                const { data: newVisit } = await supabase
                  .from("pet_medical_visits")
                  .insert({
                    pet_id: pet_id,
                    user_id: pet.user_id,
                    visit_date: visitDate,
                    notes: [
                      `Auto-created from email: ${doc.email_subject || doc.file_name}`,
                      totalsLine,
                      docTag,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                    vet_name: classification.vet_name || doc.sender_name || null,
                    doctor_name: classification.doctor_name || null,
                  })
                  .select()
                  .single();
                visit = newVisit;
              }

              if (visit) {
                for (const record of recordsToInsert) {
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
                      quantity: record.quantity ?? null,
                      price: record.price != null ? Number(record.price) : null,
                      file_url: doc.file_url || null,
                    });
                }

                // If the invoice total doesn't match the sum of its items
                // (fees, discounts, unparsed lines), add a balancing record so
                // the pet's spending history matches the amount actually paid.
                if (isInvoice && invoiceTotal !== null) {
                  const itemsSum = recordsToInsert.reduce(
                    (sum, r) => sum + (r.price != null ? Number(r.price) : 0),
                    0
                  );
                  const diff = Math.round((invoiceTotal - itemsSum) * 100) / 100;
                  if (Math.abs(diff) >= 0.01) {
                    await supabase.from("pet_medical_records").insert({
                      visit_id: visit.id,
                      pet_id: pet_id,
                      user_id: pet.user_id,
                      record_type: "other",
                      title: diff > 0 ? "Other charges, tax & fees" : "Discounts & adjustments",
                      record_date: visitDate,
                      description: `Balancing entry so this visit matches the invoice total of $${invoiceTotal.toFixed(2)}`,
                      price: diff,
                      file_url: doc.file_url || null,
                    });
                  }
                }

                // Notify the pet owner
                await supabase.from("notifications").insert({
                  user_id: pet.user_id,
                  title: isInvoice ? "🧾 Invoice Added to Health History" : "📋 Medical Records Auto-Added",
                  message: isInvoice
                    ? `A visit with ${recordsToInsert.length} item(s)${
                        invoiceTotal !== null ? ` totaling $${invoiceTotal.toFixed(2)}` : ""
                      } from ${classification.vet_name || doc.sender_name || "your vet"} was added to ${pet.name}'s health history.`
                    : `${recordsToInsert.length} record(s) from ${classification.vet_name || doc.sender_name || "your vet"} have been added to ${pet.name}'s health history.`,
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
            medicalRecordsCreated: recordsToInsert.length,
            invoiceItemsCaptured: itemRecords.length,
            invoiceTotal,
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

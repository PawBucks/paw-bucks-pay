import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('Missing LOVABLE_API_KEY');

    const { imageBase64, petName, petType, petBreed } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a veterinary document extraction specialist. You analyze photos of vet paperwork (invoices, visit summaries, vaccination records, lab results, prescriptions, discharge papers) and extract structured medical record data.

The pet's name is "${petName || 'Unknown'}" (${petType || 'unknown'}${petBreed ? ` - ${petBreed}` : ''}).

Always respond using the extract_medical_records tool. Extract ALL line items, procedures, medications, vaccinations, tests, etc. from the document.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all medical record information from this veterinary document. Include every line item, procedure, medication, test, vaccination, etc. Also extract the visit date, vet clinic name, and doctor name if visible.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_medical_records',
            description: 'Extract structured medical records from vet paperwork',
            parameters: {
              type: 'object',
              properties: {
                visit_date: {
                  type: 'string',
                  description: 'Visit date in YYYY-MM-DD format, or null if not found'
                },
                vet_name: {
                  type: 'string',
                  description: 'Veterinary clinic/hospital name, or null if not found'
                },
                doctor_name: {
                  type: 'string',
                  description: 'Doctor/veterinarian name, or null if not found'
                },
                visit_notes: {
                  type: 'string',
                  description: 'General visit notes, diagnosis, or summary if present'
                },
                line_items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'Name of procedure, medication, test, vaccination, etc.'
                      },
                      record_type: {
                        type: 'string',
                        enum: ['vaccination', 'checkup', 'surgery', 'lab_results', 'prescription', 'dental', 'emergency', 'other'],
                        description: 'Type of medical record'
                      },
                      quantity: {
                        type: 'number',
                        description: 'Quantity if listed, default 1'
                      },
                      price: {
                        type: 'number',
                        description: 'Price/cost in USD if listed, or null'
                      },
                      description: {
                        type: 'string',
                        description: 'Additional details, dosage, instructions, etc.'
                      }
                    },
                    required: ['title', 'record_type']
                  },
                  description: 'All individual procedures, medications, tests, etc.'
                },
                confidence: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Overall confidence in extraction quality'
                }
              },
              required: ['line_items', 'confidence']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_medical_records' } },
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error('AI did not return structured data');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    // Validate date format
    if (extractedData.visit_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(extractedData.visit_date)) {
        const parsedDate = new Date(extractedData.visit_date);
        if (!isNaN(parsedDate.getTime())) {
          extractedData.visit_date = parsedDate.toISOString().split('T')[0];
        } else {
          extractedData.visit_date = null;
        }
      }
    }

    // Sanitize prices
    if (extractedData.line_items) {
      for (const item of extractedData.line_items) {
        if (item.price !== null && item.price !== undefined) {
          const parsed = parseFloat(item.price);
          item.price = isNaN(parsed) ? null : parsed;
        }
        if (item.quantity !== null && item.quantity !== undefined) {
          const parsed = parseInt(item.quantity);
          item.quantity = isNaN(parsed) ? 1 : parsed;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: extractedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error scanning vet paperwork:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan paperwork';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

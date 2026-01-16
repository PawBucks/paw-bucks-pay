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
    if (!LOVABLE_API_KEY) {
      throw new Error('Missing LOVABLE_API_KEY');
    }

    const { imageBase64, imageUrl } = await req.json();

    if (!imageBase64 && !imageUrl) {
      throw new Error('Either imageBase64 or imageUrl is required');
    }

    // Build the image content for the vision model
    const imageContent = imageBase64 
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

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
            content: `You are a receipt OCR specialist. Extract information from receipt images and return ONLY valid JSON.

Your response must be a JSON object with these exact fields:
{
  "vendor_name": "The store/merchant name (string or null if not found)",
  "amount": "The total amount as a number (e.g., 45.99) or null if not found",
  "date": "The date in YYYY-MM-DD format or null if not found",
  "description": "A brief description of items purchased (max 100 chars) or null",
  "suggested_category": "One of: inventory_supplies, specialized_equipment, professional_services, advertising, office_supplies, software_subscriptions, travel_expenses, education_training, utilities, insurance, other",
  "confidence": "high, medium, or low based on image quality and readability"
}

Guidelines:
- Look for the TOTAL or GRAND TOTAL amount, not subtotals
- For vendor name, look at the top of the receipt for store name/logo
- Parse dates in any format and convert to YYYY-MM-DD
- For suggested_category, infer from the vendor name and items:
  - Pet stores, supply wholesalers → inventory_supplies
  - Equipment purchases → specialized_equipment
  - Vet services, accountants, lawyers → professional_services
  - Google, Facebook, marketing → advertising
  - Office Depot, Staples → office_supplies
  - Software, SaaS → software_subscriptions
  - Gas, hotels, flights → travel_expenses
  - Courses, certifications → education_training
  - Electric, water, phone → utilities
  - Insurance premiums → insurance
  - Everything else → other`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the receipt information from this image. Return only valid JSON.' },
              imageContent
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse and validate the response
    let extractedData;
    try {
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      extractedData = {
        vendor_name: null,
        amount: null,
        date: null,
        description: null,
        suggested_category: 'other',
        confidence: 'low'
      };
    }

    // Validate and sanitize the amount
    if (extractedData.amount !== null) {
      const parsedAmount = parseFloat(extractedData.amount);
      extractedData.amount = isNaN(parsedAmount) ? null : parsedAmount;
    }

    // Validate date format
    if (extractedData.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(extractedData.date)) {
        // Try to parse and reformat
        const parsedDate = new Date(extractedData.date);
        if (!isNaN(parsedDate.getTime())) {
          extractedData.date = parsedDate.toISOString().split('T')[0];
        } else {
          extractedData.date = null;
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
    console.error('Error processing receipt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process receipt';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

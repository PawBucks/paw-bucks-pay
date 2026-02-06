import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("cancel-merchant-subscription - requires authorization", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-merchant-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // No authorization header
    },
    body: JSON.stringify({ subscriptionId: "00000000-0000-0000-0000-000000000000" }),
  });

  // Either 400 or 401 are acceptable for missing auth
  assertEquals(response.status >= 400, true);
  
  const data = await response.json();
  // Response could have 'error' or 'message' field depending on where it's rejected
  const hasErrorInfo = data.error !== undefined || data.message !== undefined || data.code !== undefined;
  assertEquals(hasErrorInfo, true);
});

Deno.test("cancel-merchant-subscription - validates subscription ID format", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-merchant-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ subscriptionId: "invalid-uuid" }),
  });

  // Should fail validation
  assertEquals(response.status, 400);
  
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("cancel-merchant-subscription - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-merchant-subscription`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });

  assertEquals(response.status, 200);
  await response.text(); // Consume body
});

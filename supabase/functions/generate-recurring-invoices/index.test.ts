import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("generate-recurring-invoices - responds to POST request", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-recurring-invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 200);
  
  const data = await response.json();
  assertExists(data.success);
  assertEquals(data.success, true);
  assertExists(data.processed);
  assertEquals(typeof data.processed, "number");
  assertExists(data.results);
  assertEquals(Array.isArray(data.results), true);
});

Deno.test("generate-recurring-invoices - returns empty results when no invoices due", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-recurring-invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 200);
  
  const data = await response.json();
  assertEquals(data.success, true);
  // Should not fail even if no invoices need processing
  assertEquals(typeof data.processed, "number");
});

Deno.test("generate-recurring-invoices - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-recurring-invoices`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });

  // OPTIONS should not fail
  assertEquals(response.status, 200);
  await response.text(); // Consume body
});

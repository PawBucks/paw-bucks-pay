import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("process-merchant-subscriptions - responds to POST request", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-merchant-subscriptions`, {
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
});

Deno.test("process-merchant-subscriptions - returns proper structure when no subscriptions due", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-merchant-subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ triggered_by: "test" }),
  });

  assertEquals(response.status, 200);
  
  const data = await response.json();
  assertEquals(data.success, true);
  
  // Should either have "No subscriptions due for billing" message or detailed results
  if (data.message) {
    assertEquals(data.message, "No subscriptions due for billing");
  } else {
    assertExists(data.processed);
    assertEquals(typeof data.processed, "number");
  }
});

Deno.test("process-merchant-subscriptions - handles cron trigger metadata", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-merchant-subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ triggered_by: "cron" }),
  });

  assertEquals(response.status, 200);
  
  const data = await response.json();
  assertEquals(data.success, true);
});

Deno.test("process-merchant-subscriptions - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-merchant-subscriptions`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });

  assertEquals(response.status, 200);
  await response.text(); // Consume body
});

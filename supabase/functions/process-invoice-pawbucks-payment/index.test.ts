import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/process-invoice-pawbucks-payment`;

const post = (body: unknown) =>
  fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

Deno.test("process-invoice-pawbucks-payment - handles CORS preflight", async () => {
  const response = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(response.status, 200);
  await response.text();
});

Deno.test("process-invoice-pawbucks-payment - rejects missing invoiceId", async () => {
  const response = await post({ totalAmountCents: 1000, pawbucksAmountCents: 1000 });
  const data = await response.json();
  assertExists(data.error);
  // Function returns 500 with the thrown error message; just confirm it isn't a success.
  assertEquals(response.status >= 400, true);
  assertEquals(String(data.error).toLowerCase().includes("invoice id"), true);
});

Deno.test("process-invoice-pawbucks-payment - rejects missing totalAmountCents", async () => {
  const response = await post({ invoiceId: "00000000-0000-0000-0000-000000000000" });
  const data = await response.json();
  assertExists(data.error);
  assertEquals(response.status >= 400, true);
});

Deno.test(
  "process-invoice-pawbucks-payment - blocks guest checkouts from spending PawBucks",
  async () => {
    const response = await post({
      invoiceId: "00000000-0000-0000-0000-000000000000",
      totalAmountCents: 5000,
      pawbucksAmountCents: 5000,
      isGuestCheckout: true,
    });
    const data = await response.json();
    assertExists(data.error);
    assertEquals(
      String(data.error).toLowerCase().includes("guest"),
      true,
      "Guest PawBucks attempts must be rejected so they cannot mint merchant credits",
    );
  },
);

Deno.test(
  "process-invoice-pawbucks-payment - rejects unknown invoice / bad access token",
  async () => {
    // Without a valid invoice + access_token pair the function must NOT touch
    // the merchant wallet. We exercise this twice to also confirm repeated
    // attempts never silently credit a merchant.
    for (let i = 0; i < 2; i++) {
      const response = await post({
        invoiceId: "00000000-0000-0000-0000-000000000000",
        totalAmountCents: 5000,
        pawbucksAmountCents: 5000,
        userId: "00000000-0000-0000-0000-000000000000",
        accessToken: "definitely-not-a-real-token",
      });
      const data = await response.json();
      assertExists(data.error);
      assertEquals(
        String(data.error).toLowerCase().includes("invoice not found") ||
          String(data.error).toLowerCase().includes("invalid access token"),
        true,
      );
    }
  },
);

Deno.test(
  "process-invoice-pawbucks-payment - never double-credits: full-PawBucks path is the ONLY merchant credit site",
  async () => {
    // Guard test: read the function source and assert that merchant wallet
    // credits (`merchant_pawbucks_wallet` writes + matching `earn` activity)
    // happen in exactly one place. If a future refactor adds another credit
    // site, this test will fail and force a review.
    const src = await Deno.readTextFile(
      new URL("./index.ts", import.meta.url),
    );

    const walletUpdates = src.match(
      /\.from\(\s*["']merchant_pawbucks_wallet["']\s*\)\s*\.update\(/g,
    ) ?? [];
    const walletInserts = src.match(
      /\.from\(\s*["']merchant_pawbucks_wallet["']\s*\)\s*\.insert\(/g,
    ) ?? [];
    const earnActivityInserts = src.match(
      /\.from\(\s*["']merchant_pawbucks_activity["']\s*\)\s*\.insert\(/g,
    ) ?? [];

    assertEquals(
      walletUpdates.length,
      1,
      "Merchant wallet should be updated in exactly one branch (full PawBucks payment)",
    );
    assertEquals(
      walletInserts.length,
      1,
      "Merchant wallet should be inserted in exactly one branch (first-time merchant)",
    );
    assertEquals(
      earnActivityInserts.length,
      1,
      "Merchant earn activity should be logged in exactly one place to prevent double-credit",
    );
  },
);

Deno.test(
  "process-invoice-pawbucks-payment - credit amount uses pawbucksUsed (not raw cents)",
  async () => {
    // Guard test: the merchant wallet must be credited with PawBucks units
    // (`pawbucksUsed`), not USD cents. A regression here would over-credit
    // merchants by 100x.
    const src = await Deno.readTextFile(
      new URL("./index.ts", import.meta.url),
    );

    // Update path: balance: merchantWallet.balance + pawbucksUsed
    const updateOk = /balance:\s*merchantWallet\.balance\s*\+\s*pawbucksUsed/
      .test(src);
    // Insert path: balance: pawbucksUsed
    const insertOk = /balance:\s*pawbucksUsed\b/.test(src);

    assertEquals(updateOk, true, "Merchant wallet update must add pawbucksUsed");
    assertEquals(
      insertOk,
      true,
      "Merchant wallet insert must seed balance with pawbucksUsed",
    );

    // And the activity row's amount must equal pawbucksUsed (positive).
    const activityOk =
      /merchant_pawbucks_activity[\s\S]{0,400}amount:\s*pawbucksUsed/.test(src);
    assertEquals(
      activityOk,
      true,
      "Merchant earn activity amount must equal pawbucksUsed",
    );
  },
);
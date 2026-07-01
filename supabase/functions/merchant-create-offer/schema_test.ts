import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Mirror the production schema for the image field.
const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};
const isAcceptableImageReference = (value: string) => {
  if (/^https?:\/\//i.test(value)) { try { new URL(value); return true; } catch { return false; } }
  return /^[A-Za-z0-9][A-Za-z0-9/_.,:@+%=-]*\.(jpe?g|png|webp|gif|avif)$/i.test(value);
};
const optionalImageReferenceSchema = z.preprocess(
  normalizeOptionalText,
  z.string().max(2000).refine(isAcceptableImageReference, "Invalid image URL").nullable().optional(),
);
const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  coins_required: z.number().int().min(0).max(1000000).optional().default(0),
  image_url: optionalImageReferenceSchema,
});

const base = { title: "T", description: "D", coins_required: 500 };

Deno.test("accepts full https image URL", () => {
  const r = schema.safeParse({ ...base, image_url: "https://pawbucks.app/placeholder.svg" });
  assertEquals(r.success, true);
});
Deno.test("accepts empty string (coerced to null)", () => {
  const r = schema.safeParse({ ...base, image_url: "" });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.image_url, null);
});
Deno.test("accepts omitted image_url", () => {
  const r = schema.safeParse(base);
  assertEquals(r.success, true);
});
Deno.test("accepts storage object path", () => {
  const r = schema.safeParse({ ...base, image_url: "offers/abc123.png" });
  assertEquals(r.success, true);
});
Deno.test("accepts null image_url", () => {
  const r = schema.safeParse({ ...base, image_url: null });
  assertEquals(r.success, true);
});
Deno.test("rejects garbage image_url", () => {
  const r = schema.safeParse({ ...base, image_url: "not a url" });
  assertEquals(r.success, false);
});

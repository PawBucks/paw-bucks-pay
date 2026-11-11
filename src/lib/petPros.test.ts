import { describe, expect, it } from "vitest";
import { filterPros, normalizeImportRow, toCsv } from "./petPros";
describe("public pet pro rules", () => {
  it("requires a public source page for imported listings", () => { expect(normalizeImportRow({ name: "Paws Grooming" })).toBeNull(); expect(normalizeImportRow({ name: "Paws Grooming", source: "https://example.com" })?.source_url).toBe("https://example.com/"); });
  it("filters PawBucks providers separately from public listings", () => { const pros = [{ id: "1", name: "A", category: "grooming", network: "pawbucks" as const }, { id: "2", name: "B", category: "grooming", network: "public" as const }]; expect(filterPros(pros, "", "all", "public").map((p) => p.id)).toEqual(["2"]); });
  it("neutralizes spreadsheet formulas on export", () => { expect(toCsv([{ name: "=HYPERLINK(1)" }])).toContain("\"'=HYPERLINK(1)\""); });
  it("does not invent coordinates for blank CSV fields", () => { const row = normalizeImportRow({ name: "Paws", source_url: "https://example.com", latitude: "", longitude: "" }); expect(row?.latitude).toBeUndefined(); expect(row?.longitude).toBeUndefined(); });
  it("matches secondary business categories", () => { expect(filterPros([{ id: "1", name: "Care", category: "daycare", categories: ["daycare", "grooming"], network: "pawbucks" }], "", "grooming", "all")).toHaveLength(1); });
});

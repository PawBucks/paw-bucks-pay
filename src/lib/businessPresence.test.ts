import { describe, it, expect } from "vitest";
import { profileCompleteness, interestFunnel } from "./businessPresence";

describe("business presence", () => {
  it("free listing with every item filled is 100% complete", () => {
    const r = profileCompleteness({ logo_url: "x", description: "d", phone: "1", address: "a", website_url: "w", hasHours: true, hasServices: true, hasRecentUpdate: true });
    expect(r.score).toBe(100);
  });
  it("blank text counts as missing", () => {
    const r = profileCompleteness({ description: "   " });
    expect(r.missing.some(m => m.key === "description")).toBe(true);
    expect(r.score).toBe(0);
  });
  it("funnel counts unique people, and a view alone is not an inquiry", () => {
    const f = interestFunnel([
      { user_id: "a", action: "view" }, { user_id: "a", action: "view" },
      { user_id: "b", action: "view" }, { user_id: "b", action: "inquire" },
    ]);
    expect(f.viewed).toBe(2);
    expect(f.reached).toBe(1);
    expect(f.reachRate).toBe(50);
  });
});

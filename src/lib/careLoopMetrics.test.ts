import { describe, it, expect } from "vitest";
import { computeCareLoopMetrics } from "./careLoopMetrics";

const now = Date.parse("2026-10-29T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("care loop metrics", () => {
  it("counts weekly vs monthly active users", () => {
    const m = computeCareLoopMetrics([
      { user_id: "a", action: "view", created_at: ago(2) },
      { user_id: "b", action: "view", created_at: ago(20) },
    ], now);
    expect(m.wau).toBe(1);
    expect(m.mau).toBe(2);
  });
  it("day-7 retention counts only users who returned 7+ days after first visit", () => {
    const m = computeCareLoopMetrics([
      { user_id: "a", action: "view", created_at: ago(10) },
      { user_id: "a", action: "view", created_at: ago(1) },
      { user_id: "b", action: "view", created_at: ago(10) },
    ], now);
    expect(m.d7).toBe(50);
  });
  it("discovery-to-action conversion is viewers who then called, booked, etc.", () => {
    const m = computeCareLoopMetrics([
      { user_id: "a", action: "view", created_at: ago(1) },
      { user_id: "a", action: "call", created_at: ago(1) },
      { user_id: "b", action: "view", created_at: ago(1) },
      { user_id: "c", action: "view", created_at: ago(1) },
      { user_id: "d", action: "view", created_at: ago(1) },
    ], now);
    expect(m.conversion).toBe(25);
  });
});

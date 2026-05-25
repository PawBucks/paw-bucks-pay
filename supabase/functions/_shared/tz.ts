// Shared timezone helpers for cron-driven edge functions.
// Platform rule (mem://constraints/timezone-localization-est-pst-platform-wide):
// ALL user-facing scheduled actions must fire at the right LOCAL hour for
// the recipient. pg_cron only fires in UTC, so cron entries should fire
// hourly and each function should gate on local hour using these helpers.

const DEFAULT_TZ = "America/New_York";

/** Returns 0-23 for the given IANA timezone (defaults to ET). */
export function currentHourInTz(tz?: string | null): number {
  const timeZone = tz && tz.length > 0 ? tz : DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  const n = parseInt(h, 10);
  // Intl can return "24" for midnight in some runtimes — normalize to 0.
  return Number.isFinite(n) ? n % 24 : 0;
}

/** Returns YYYY-MM-DD in the given timezone (defaults to ET). */
export function currentDateInTz(tz?: string | null): string {
  const timeZone = tz && tz.length > 0 ? tz : DEFAULT_TZ;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** True if the caller explicitly requested an on-demand run (not the cron). */
export function isManualInvocation(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.manual === true || b.force === true || b.on_demand === true;
}
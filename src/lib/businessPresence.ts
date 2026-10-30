/** Profile completeness and interest-to-outcome funnel for a business listing. */
export interface ProfileFields {
  logo_url?: string | null; description?: string | null; phone?: string | null;
  address?: string | null; website_url?: string | null; hasHours?: boolean; hasServices?: boolean; hasRecentUpdate?: boolean;
}

export const PROFILE_CHECKS: { key: keyof ProfileFields; label: string }[] = [
  { key: "logo_url", label: "Add a logo or photo" },
  { key: "description", label: "Describe your business" },
  { key: "phone", label: "Add a phone number" },
  { key: "address", label: "Add your address" },
  { key: "website_url", label: "Add your website or booking link" },
  { key: "hasHours", label: "Set your business hours" },
  { key: "hasServices", label: "List at least one service" },
  { key: "hasRecentUpdate", label: "Share an update in the last 30 days" },
];

export function profileCompleteness(p: ProfileFields) {
  const missing = PROFILE_CHECKS.filter(c => { const v = p[c.key]; return typeof v === "string" ? !v.trim() : !v; });
  return { score: Math.round(((PROFILE_CHECKS.length - missing.length) / PROFILE_CHECKS.length) * 100), missing };
}

/** Funnel stages: unique people who viewed → engaged (save/call/directions/website) → inquired/booked → completed. */
export function interestFunnel(events: { user_id: string; action: string }[]) {
  const people = (acts: string[]) => new Set(events.filter(e => acts.includes(e.action)).map(e => e.user_id)).size;
  const viewed = people(["view"]);
  const engaged = people(["save", "call", "contact", "directions", "website"]);
  const reached = people(["inquire", "book", "rsvp"]);
  const completed = people(["attend"]);
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  return { viewed, engaged, reached, completed, engageRate: rate(engaged, viewed), reachRate: rate(reached, viewed), completeRate: rate(completed, reached) };
}

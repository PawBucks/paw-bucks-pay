export interface CareEvent { user_id: string; action: string; created_at: string }

const DAY = 86_400_000;
const INTENT = new Set(["call", "contact", "inquire", "book", "attend", "rsvp", "directions", "website"]);

/** Activity metrics from care-action events, relative to `now`. */
export function computeCareLoopMetrics(events: CareEvent[], now = Date.now()) {
  const within = (days: number) => new Set(events.filter(e => now - Date.parse(e.created_at) < days * DAY).map(e => e.user_id));
  const wau = within(7).size, mau = within(30).size;
  // Day-N retention: users whose first event is at least N days old and who came back on/after day N
  const first = new Map<string, number>(), all = new Map<string, number[]>();
  for (const e of events) {
    const t = Date.parse(e.created_at);
    first.set(e.user_id, Math.min(first.get(e.user_id) ?? Infinity, t));
    (all.get(e.user_id) ?? all.set(e.user_id, []).get(e.user_id)!).push(t);
  }
  const retention = (n: number) => {
    let eligible = 0, kept = 0;
    for (const [u, f] of first) {
      if (now - f < n * DAY) continue;
      eligible++;
      if (all.get(u)!.some(t => t - f >= n * DAY)) kept++;
    }
    return eligible ? Math.round((kept / eligible) * 100) : null;
  };
  const viewers = new Set(events.filter(e => e.action === "view").map(e => e.user_id));
  const actors = new Set(events.filter(e => INTENT.has(e.action) && viewers.has(e.user_id)).map(e => e.user_id));
  return {
    wau, mau,
    d1: retention(1), d7: retention(7), d30: retention(30),
    conversion: viewers.size ? Math.round((actors.size / viewers.size) * 100) : null,
  };
}

/** Count events per action for a business summary. */
export function countByAction(events: { action: string }[]) {
  const out: Record<string, number> = {};
  for (const e of events) out[e.action] = (out[e.action] ?? 0) + 1;
  return out;
}

---
name: Cron local-hour gating pattern
description: How user-facing scheduled edge functions deliver at the right local hour despite pg_cron only firing in UTC
type: feature
---
pg_cron schedules run in the database's UTC timezone with no per-user awareness, but the platform's core rule requires user-facing actions to fire in the recipient's local time (ET/PT, never UTC). For any cron-driven function that notifies users:

**Pattern:**
1. Schedule the cron entry hourly: `0 * * * *`.
2. Inside the edge function, look up the recipient's timezone (`profiles.timezone`, defaulting to `America/New_York`).
3. Use the shared helper `currentHourInTz(tz)` from `supabase/functions/_shared/tz.ts` and skip the recipient unless their local hour matches the target hour.

**Functions using this pattern (target local hour in parens):**
- `merchant-daily-summary` (21 = 9 PM ET; platform-wide ET anchor)
- `send-vaccine-reminders` (9 AM, per pet owner)
- `send-invoice-reminders` (9 AM, per merchant owner — invoice clients aren't always registered users)
- `send-lost-pet-deletion-warning` (9 AM, per pet owner)
- `process-grooming-rebooks` (10 AM, per customer)

**Functions exempt:** TZ-agnostic ops/maintenance jobs (every-N-minute pollers, hourly subscription/expiration checks, daily 3 AM cleanups). These can keep fixed UTC schedules.

**Helper file:** `supabase/functions/_shared/tz.ts` exports `currentHourInTz`, `currentDateInTz`, `isManualInvocation`. Always import from there — do not reimplement `Intl.DateTimeFormat` inline.

**Manual/on-demand invocation:** include `force: true` or `manual: true` in the request body to bypass the hour gate (used by `merchant-daily-summary` when an admin requests a single-merchant digest).

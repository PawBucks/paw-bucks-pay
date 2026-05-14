import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

export const DEFAULT_MERCHANT_TZ = "America/New_York";

/** Common US/Canada IANA timezones surfaced in the merchant settings UI. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Mountain Time — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
  { value: "America/Toronto", label: "Eastern Time (Toronto)" },
  { value: "America/Vancouver", label: "Pacific Time (Vancouver)" },
];

export function getViewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_MERCHANT_TZ;
  } catch {
    return DEFAULT_MERCHANT_TZ;
  }
}

/**
 * Treats `date` (yyyy-MM-dd) + `time` ("HH:mm" or "HH:mm:ss") as a wall-clock
 * moment in the merchant timezone and returns the absolute Date instant.
 */
export function merchantWallClockToInstant(date: string, time: string, merchantTz: string): Date {
  const t = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${t}`, merchantTz || DEFAULT_MERCHANT_TZ);
}

/** Format a wall-clock time string ("HH:mm" or "HH:mm:ss") for display. */
export function formatMerchantTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${(m || 0).toString().padStart(2, "0")} ${period}`;
}

/**
 * Convert a merchant wall-clock slot ("HH:mm") for display in the viewer's
 * timezone on a given booking date. Returns null if viewer is in the same TZ.
 */
export function viewerLocalTimeFor(
  date: Date | string,
  time: string,
  merchantTz: string,
  viewerTz: string = getViewerTimeZone(),
): string | null {
  if (!merchantTz || merchantTz === viewerTz) return null;
  const dateStr = typeof date === "string" ? date : formatInTimeZone(date, merchantTz, "yyyy-MM-dd");
  const instant = merchantWallClockToInstant(dateStr, time, merchantTz);
  return formatInTimeZone(instant, viewerTz, "h:mm a");
}

/** Short timezone abbreviation (e.g. "EST", "PDT") for the merchant TZ on `date`. */
export function tzAbbr(date: Date, tz: string): string {
  try {
    return formatInTimeZone(date, tz || DEFAULT_MERCHANT_TZ, "zzz");
  } catch {
    return "";
  }
}

export { formatInTimeZone, toZonedTime, fromZonedTime };
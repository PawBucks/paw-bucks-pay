export type OpenWindow = { start_time: string; end_time: string };
export type SpecialHours = {
  id: string;
  special_date: string;
  label: string;
  is_closed: boolean;
  repeat_annually: boolean;
  windows: OpenWindow[];
};

export function specialWindowsForDate(entries: SpecialHours[], date: string): OpenWindow[] | null {
  const matches = entries.filter(e => e.special_date === date ||
    (e.repeat_annually && e.special_date.slice(5) === date.slice(5)));
  if (!matches.length) return null;
  if (matches.some(e => e.is_closed)) return [];
  return matches.flatMap(e => e.windows).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function validateOpenWindows(windows: OpenWindow[]): string | null {
  if (!windows.length) return 'Add at least one open window';
  const sorted = [...windows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (const [i, w] of sorted.entries()) {
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!valid.test(w.start_time) || !valid.test(w.end_time)) return 'Enter valid start and end times';
    if (w.start_time >= w.end_time) return 'Each open window must end after it starts';
    if (i > 0 && w.start_time < sorted[i - 1].end_time) return 'Open windows cannot overlap';
  }
  return null;
}

export function fitsOpenWindow(windows: OpenWindow[], start: string, end: string): boolean {
  return end > start && windows.some(w => start.slice(0, 5) >= w.start_time && end.slice(0, 5) <= w.end_time);
}
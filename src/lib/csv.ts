// Safe CSV cell: neutralizes spreadsheet formula prefixes (=, +, -, @, tab, CR)
// and always quotes the value.
export function csvSafeCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

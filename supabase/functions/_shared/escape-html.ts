// Shared HTML entity escaper for outbound email templates.
// Wrap every user-supplied variable at HTML interpolation sites to prevent
// HTML/JS injection into rendered emails.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}
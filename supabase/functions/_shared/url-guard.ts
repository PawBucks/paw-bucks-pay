// Validate webhook URLs to prevent SSRF attacks.
// Rejects non-HTTPS schemes, private IPs, localhost, link-local, and bare hostnames.

const PRIVATE_IPV4_RANGES: Array<[number, number, number]> = [
  // [first octet, second octet match (or -1 for any), prefix length test]
];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1]), parseInt(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local incl. AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export function validateWebhookUrl(rawUrl: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2048) {
    return { ok: false, error: "Invalid URL" };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Malformed URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Webhook URL must use https://" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }
  if (host.includes(":")) {
    if (isPrivateIPv6(host)) return { ok: false, error: "Webhook URL host is not allowed" };
  } else if (isPrivateIPv4(host)) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }
  // Reject bare hostnames (no dot, not an IP) — must be FQDN
  if (!host.includes(".")) {
    return { ok: false, error: "Webhook URL must use a fully-qualified domain" };
  }
  return { ok: true, url: parsed.toString() };
}
// Returns the request Origin only when it is an approved PawBucks origin;
// otherwise falls back to the canonical production URL. Prevents open
// redirects through Stripe return/success/cancel URLs.
const CANONICAL = "https://pawbucks.app";

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (u.protocol === "https:") {
      if (host === "pawbucks.app" || host === "www.pawbucks.app") return true;
      if (host === "paw-bucks-pay.lovable.app") return true;
      if (host.endsWith(".lovable.app") && host.includes("42786380-3966-427e-b3d0-08c5bc7581ed")) return true;
      if (host.endsWith(".lovableproject.com") && host.includes("42786380-3966-427e-b3d0-08c5bc7581ed")) return true;
    }
    if (u.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) return true;
    if (u.protocol === "capacitor:" || u.protocol === "ionic:") return false;
    return false;
  } catch {
    return false;
  }
}

export function safeOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) return origin.replace(/\/$/, "");
  return CANONICAL;
}

// Validates a caller-supplied absolute URL; returns it only when its origin is
// approved, else undefined.
export function safeRedirectUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  try {
    const u = new URL(url);
    return isAllowedOrigin(u.origin) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

import { merchantMatchesCategory, searchMatchesAnyCategory } from "./categoryMapping";
export type ProNetwork = "pawbucks" | "public";
export type DirectoryPro = { id: string; name: string; category: string; categories?: string[]; logo?: string | null; address?: string | null; phone?: string | null; website?: string | null; latitude?: number | null; longitude?: number | null; network: ProNetwork; href?: string; sourceUrl?: string | null };
export type ImportRow = { business_name: string; category: string; address?: string; phone?: string; email?: string; website_url?: string; source_url: string; latitude?: number; longitude?: number };

const clean = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const url = (v: unknown) => { const s = clean(v, 500); if (!s) return ""; try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : ""; } catch { return ""; } };
const num = (v: unknown, min: number, max: number) => { if (v == null || String(v).trim() === "") return undefined; const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : undefined; };
export const sourceKey = (r: Pick<ImportRow, "business_name" | "address" | "phone" | "website_url">) => [r.business_name, r.address, r.phone?.replace(/\D/g, ""), r.website_url?.replace(/^https?:\/\/(www\.)?/, "")].map((x) => (x ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");

/** Normalizes import rows. A row is rejected unless it has a name and a source page. */
export function normalizeImportRow(raw: Record<string, unknown>): ImportRow | null {
  const business_name = clean(raw.business_name ?? raw.name, 200);
  const source_url = url(raw.source_url ?? raw.source);
  if (business_name.length < 2 || !source_url) return null;
  return { business_name, category: clean(raw.category, 60).toLowerCase() || "other", address: clean(raw.address) || undefined, phone: clean(raw.phone, 40) || undefined, email: clean(raw.email, 200) || undefined, website_url: url(raw.website_url ?? raw.website) || undefined, source_url, latitude: num(raw.latitude, -90, 90), longitude: num(raw.longitude, -180, 180) };
}

export function filterPros(pros: DirectoryPro[], q: string, category: string, network: "all" | ProNetwork) {
  const s = q.trim().toLowerCase();
  return pros.filter((p) => (network === "all" || p.network === network) && (category === "all" || merchantMatchesCategory(category, p.category, p.categories)) && (!s || searchMatchesAnyCategory(s, p.category, p.categories) || `${p.name} ${p.category} ${p.address ?? ""}`.toLowerCase().includes(s)));
}

const csvCell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
export const toCsv = (rows: Record<string, unknown>[]) => rows.length ? [Object.keys(rows[0]).map(csvCell).join(","), ...rows.map((r) => Object.values(r).map(csvCell).join(","))].join("\n") : "";

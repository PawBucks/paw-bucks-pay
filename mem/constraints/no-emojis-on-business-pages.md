---
name: no-emojis-on-business-pages
description: Public pages (any audience) may use emojis; authenticated Merchant/Vet/Brand/Admin pages must use Lucide icons only
type: constraint
---
**Rule:** Any PUBLIC-facing page (unauthenticated, viewable by anyone) may use high-quality emojis as iconography — including Discover, Directory, Merchant Profile (public), and pet-owner facing pages. AUTHENTICATED Merchant, Vet, Brand, and Admin dashboards/portals must NEVER use emojis — always use Apple-style, tech-inspired Lucide (or SVG) icons instead.

**Applies to:** category chips, badges, empty states, headers, buttons, labels — any visual on an authenticated merchant/vet/brand/admin route or component.

**Why:** Authenticated business surfaces require a professional, enterprise aesthetic. Public-facing pages benefit from warm, approachable emoji iconography regardless of audience.

**How to apply:**
- Authenticated merchant/, vet/, admin/, brand/ routes (or shared components rendered only there): use Lucide icons (e.g. `Stethoscope`, `Scissors`, `Truck`, `Sparkles`).
- Never import `getCategoryEmoji` or `@/components/ui/sparkles-emoji` in business-facing surfaces.
- Public pages (Discover, Directory, MerchantProfile public view, landing, Home, Pet Health, Wallet, etc.) may use emojis. The Founding 50 badge is public-facing and keeps its ⭐ emoji.

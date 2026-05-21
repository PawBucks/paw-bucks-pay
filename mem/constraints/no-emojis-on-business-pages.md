---
name: no-emojis-on-business-pages
description: Pet Owner pages may use emojis; Merchant/Vet/Brand/Admin pages must use Lucide icons only — never emojis
type: constraint
---
**Rule:** Pet Owner–facing pages may use emojis as iconography. Merchant, Vet, Brand, and Admin–facing pages must NEVER use emojis — always use Lucide icons (or other SVG icons) instead.

**Applies to:** category chips, badges, empty states, headers, buttons, labels — any visual on a merchant/vet/brand/admin route or component.

**Why:** Business-facing surfaces require a professional, enterprise aesthetic. Emojis undermine credibility for paying merchants, vets, brands, and admins.

**How to apply:**
- When building or editing any page under merchant/, vet/, admin/, brand/ routes (or shared components rendered only there), use Lucide icons (e.g. `Stethoscope`, `Scissors`, `Truck`, `Sparkles`).
- Never import `getCategoryEmoji` or `@/components/ui/sparkles-emoji` in business-facing surfaces.
- Pet Owner pages (Discover, Directory, Home, Pet Health, Wallet, etc.) may continue using emojis.

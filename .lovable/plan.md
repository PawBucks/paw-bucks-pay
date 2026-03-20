

# PawBucks Explainer Video — Production Plan

## Overview

A 45–60 second motion graphics explainer video teaching pet owners how to use PawBucks. Rendered as a downloadable MP4 (1920×1080, 30fps). Premium & clean style matching PawBucks' teal brand identity.

## Creative Direction

- **Palette**: Teal primary (#3BA5A8 / hsl 178 55% 42%), white, soft warm gray (#F8F7F5), dark charcoal (#1A1A2E), gold accent (#D4A853)
- **Fonts**: Inter (clean body), Plus Jakarta Sans (display headings) via Google Fonts
- **Motion style**: Smooth spring animations, subtle parallax, elegant reveals — no bouncy/playful energy
- **Motifs**: Rounded cards, paw print accents, shield/trust icons, teal gradient washes
- **Mood**: Confident, welcoming, trustworthy — like a fintech onboarding video

## Scene Breakdown (~50 seconds total)

### Scene 1 — Hook (0–4s, ~120 frames)
PawBucks logo scales in with a spring. Tagline fades: "Rewards for every wag, purr & visit." Teal gradient background with floating paw prints.

### Scene 2 — Sign Up (4–12s, ~240 frames)
Animated phone mockup showing the signup flow. Key points slide in as cards: "Create your account" → "Add your pets" → "You're ready." Shield icon reinforces security.

### Scene 3 — Earn Rewards (12–24s, ~360 frames)
Split layout: left side shows merchant storefront cards appearing in a stagger. Right side shows a PawBucks counter incrementing. Text: "Shop at partner merchants. Earn PawBucks on every purchase."

### Scene 4 — Spend & Redeem (24–36s, ~360 frames)
Wallet card animates in showing a balance. Merchant logos/categories fan out. Text: "Redeem at pet stores, groomers, vets & more." Points transfer animation.

### Scene 5 — Key Features (36–46s, ~300 frames)
Rapid card carousel of features: Pet Profiles, Vet Connections, Lost Pet Alerts, Loyalty Cards. Each card slides in, holds briefly, slides out.

### Scene 6 — Closing (46–52s, ~180 frames)
Logo returns center stage. "Download PawBucks today." Teal gradient resolves. Confident, resolved ending.

**Total**: ~1560 frames ÷ 30fps = 52 seconds

## Technical Approach

1. **Project setup**: Remotion project at `/tmp/pawbucks-video/` with standard scaffold
2. **Assets**: Copy PawBucks logo from `src/assets/logo.png` to the video project's `public/` folder
3. **Scenes**: 6 scene files under `src/scenes/`, wired with `TransitionSeries` using wipe/fade transitions
4. **Persistent layers**: Subtle animated gradient background spanning full duration, floating paw-print particles
5. **Render**: Programmatic render script to `/mnt/documents/pawbucks-explainer.mp4`
6. **QA**: Frame spot-checks at key moments before final render

## Deliverable

- MP4 file at `/mnt/documents/pawbucks-explainer.mp4`
- ~52 seconds, 1920×1080, 30fps, no audio (muted render due to sandbox constraints)


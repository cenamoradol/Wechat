# Hibox Design System

Source of truth for the visual design of **Hibox** — a multi-channel messaging app with AI agents that answer WhatsApp, Facebook Messenger and Instagram DM in your place. **Not a CRM**; a focused inbox plus a few controls.

## Files

| File | Purpose |
| --- | --- |
| `MASTER.md` | Full design system documentation (brand, colors, type, layout, components). Read this before building any UI. |
| `tokens.json` | Machine-readable tokens for code (colors, typography scale, spacing, radii). Mirrors `src/app/globals.css`. |
| `pages/*.md` | Page-specific overrides (added as pages are designed). |

## Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Base:** shadcn/ui + Radix + Tailwind CSS v3
- **Icons:** Lucide React (no emoji, ever)
- **Fonts:** IBM Plex Sans (body) + JetBrains Mono (data) via `next/font/google`

## Direction: Terminal Nocturno (dark-first)

Warm-black canvas (`#0F0E0C`), amber accent (`#F59E0B`), AI pink (`#EC4899`) reserved for AI affordances, mono type for data contexts. The feel is an **ops console**, not a marketing site.

## Stitch

Visual preview is tracked in **Google Stitch** under the project **"Hibox — Design System"**. Use Stitch for:
- Reviewing screens before building them
- Generating variants (empty / loading / error states)
- Exporting HTML/CSS reference

The Stitch design system is the source for the canvas; `MASTER.md` + `tokens.json` are the source for code.

## Tokens in code

The repo's `tailwind.config.ts` already uses shadcn's HSL CSS-variable approach with the Hibox tokens. Globals are in `src/app/globals.css`. Channel and status colors are exposed as custom utility classes (e.g. `bg-channel-whatsapp`, `bg-status-pending-bg`) so components stay readable. **No raw hex in components, no emoji icons.**

## Pre-flight before every component

1. Read `MASTER.md` for the relevant component section.
2. Confirm the page doesn't have a `pages/<name>.md` override.
3. Use only tokens from `tokens.json` / `globals.css`.
4. Match the pre-delivery checklist at the bottom of `MASTER.md`.
5. Run `node .agents/skills/design-taste-frontend/scripts/lint.mjs src/` to catch banned patterns.

---
name: Hibox Design System
direction: Terminal Nocturno (dark-first)
colors:
  background: '#0F0E0C'
  surface: '#161412'
  surface-dim: '#0F0E0C'
  surface-bright: '#1F1C19'
  surface-container-lowest: '#0F0E0C'
  surface-container-low: '#161412'
  surface-container: '#1B1816'
  surface-container-high: '#221F1C'
  surface-container-highest: '#2A2623'
  on-surface: '#E7E2D8'
  on-surface-variant: '#A8A29E'
  inverse-surface: '#E7E2D8'
  inverse-on-surface: '#0F0E0C'
  outline: '#322F2C'
  outline-variant: '#1F1C19'
  surface-tint: '#F59E0B'
  primary: '#F59E0B'
  on-primary: '#1F1300'
  primary-container: '#3A2A0E'
  on-primary-container: '#FCD34D'
  inverse-primary: '#1F1300'
  secondary: '#EC4899'
  on-secondary: '#FFFFFF'
  secondary-container: '#3F1428'
  on-secondary-container: '#FCE7F3'
  tertiary: '#14B8A6'
  on-tertiary: '#FFFFFF'
  tertiary-container: '#0E3D38'
  on-tertiary-container: '#CCFBF1'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#3F1212'
  on-error-container: '#FECACA'
  success: '#22C55E'
  on-success: '#0F1A0F'
  success-container: '#0F2818'
  warning: '#F8B22B'
  on-warning: '#1F1300'
  warning-container: '#3A2A0E'
  info: '#38BDF8'
  on-info: '#0A1F2E'
  info-container: '#0E2E3D'
  channel-whatsapp: '#22C55E'
  channel-whatsapp-bg: '#0F2818'
  channel-facebook: '#5EA6F7'
  channel-facebook-bg: '#0F1E33'
  channel-instagram: '#F246B7'
  channel-instagram-bg: '#2E0F22'
  status-open: '#F8B22B'
  status-open-bg: '#3A2A0E'
  status-pending: '#F8B22B'
  status-pending-bg: '#3A2A0E'
  status-closed: '#78716C'
  status-closed-bg: '#1F1C19'
typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  terminal-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.375rem
  DEFAULT: 0.75rem
  md: 1rem
  lg: 1.25rem
  xl: 2rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 2rem
  margin: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.375rem
  space-sm: 0.625rem
  space-md: 0.875rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

Hibox is an **AI-agent inbox** for small businesses that need to answer WhatsApp, Facebook Messenger and Instagram DM in one place. The product is **not a CRM**: agents IA respond by themselves, your team only steps in when needed. Every screen should feel like a focused operations console, not a marketing page.

**One-liner:** *Agentes IA que responden WhatsApp, Instagram y Facebook por ti.*

**Design direction:** *Terminal Nocturno — dark-first, amber accent, mono accents.*

> **Direction change (2026-10-15):** pivoted from "Warm Orange / Generous Air" to "Terminal Nocturno".
> **Rebrand (2026-10-16):** Wechat → Hibox. Repositioned from "multi-channel CRM" to "AI-agent inbox for small business". Same design system, new name and copy.

### Why the pivot
The previous "warm cream + orange + Inter" direction was a friendly CRM look. It worked, but it also looked like roughly half of the chat-CRM category. The user explicitly requested:
1. **No purple/blue gradients** (the dominant SaaS template).
2. **No typical AI design** (glassmorphism, neon, gradient blobs, fake-intelligence sparkle badges).
3. **The least-template option of three distinct directions.**

Out of three candidates (`Puesto de Mercado`, `Terminal Nocturno`, `Papel y Pluma`), the user picked **Terminal Nocturno** for its distinct identity:
- Dark-first canvas is rare in customer-support tooling — most chat apps copy the bright Messenger / WhatsApp aesthetic and end up looking like the product they integrate with.
- Amber on warm black gives a "ops console at night" feel that fits the actual use case: small-business owners reading message streams after-hours.
- **IBM Plex Sans + JetBrains Mono** pairing is distinctive without being a meme; mono is used only in data contexts (terminal mock, status codes, labels), never as body text.

### What stays
- AI pink `#EC4899` reserved exclusively for AI affordances (sparkle, agent avatars, "Sugerir respuesta IA").
- Channel brand colors (WhatsApp green, Facebook blue, Instagram pink) are still **locked brand colors** — they only appear as small channel badges/dots.
- Teal `#14B8A6` is still the rare third CTA (e.g. "Invitar miembro").
- Bilingual-ready (Spanish first, English follows); headline copy must not hard-break a single word.

### What changed
- Canvas: warm cream → **warm black `#0F0E0C`**.
- Primary: orange `#F97316` → **amber `#F59E0B`**.
- Typography: **Inter only** → **IBM Plex Sans** (body) + **JetBrains Mono** (data labels, terminal mock, status codes).
- Radii: large pills (16–20 px) → **tighter corners (8 px default, square cards)** to feel like an operator console, not a SaaS landing page.
- Form fields: boxed with rounded corners → **underline-only** on the auth portada (terminal-style input).
- Topbar/sidebar: card-with-shadow chrome → **tone-step surfaces + hairline borders, no shadow on rest**.

### Tone words
- **Operations console, not marketing site.**
- **Bilingual-ready, calm, never panicked.**
- **Mono for data, sans for prose.**

## Colors

### Brand primaries
- **Primary (`#F59E0B` — Amber 500):** Active nav rail, primary buttons, focus ring, the single most important CTA per surface. Container variant (`#3A2A0E`) for soft fills and active list rows.
- **Secondary (`#EC4899` — Pink 500):** **AI surfaces only** — sparkle icons, agent avatars, "Sugerir respuesta IA" buttons, knowledge-base tokens. Reserved for AI so it never loses meaning.
- **Tertiary (`#14B8A6` — Teal 500):** Reserved for **one** action per surface — usually "Invitar miembro" or a positive confirm. Never co-occurs with primary.

### Status palette (dark)
- **Open conversation:** Amber (`#F8B22B` / `#3A2A0E`). Same family as primary so the user instinctively knows "open = needs me".
- **Pending:** Amber `#F8B22B` on `#3A2A0E`.
- **Closed:** Stone gray `#78716C` on `#1F1C19`.
- **Automation status:** Active = green (`#22C55E`), Paused = amber, Draft = gray.
- **Success:** Green (`#22C55E`) — sent, saved, connected.
- **Warning:** Amber — token expiring, automation failed (recoverable).
- **Error:** Red (`#EF4444`) — destructive confirm, validation failure, channel disconnected.

### Channel brand colors (channel badges ONLY — brightened for dark)
- **WhatsApp (`#22C55E` / `#0F2818`):** Channel icon, channel chip, "via WhatsApp" footer.
- **Facebook Messenger (`#5EA6F7` / `#0F1E33`):** Channel icon, channel chip.
- **Instagram DM (`#F246B7` / `#2E0F22`):** Channel icon, channel chip.

### Canvas tokens (dark-first)
- `background` (`#0F0E0C`): App-level canvas — warm black, never pure `#000`.
- `surface` (`#161412`): Sidebar, top bar, all cards.
- `surface-container-low` (`#161412`): Inbox list rail background.
- `surface-container` (`#1B1816`): Subtle grouping fills (filter pills on hover, metric card tint).
- `border` (`#322F2C`): 1px dividers — warm tone, not gray.
- `foreground` (`#E7E2D8`): Primary text — warm beige, never pure white.
- `muted-foreground` (`#A8A29E`): Secondary text, timestamps.

### Accessibility
- Body text contrast verified on the dark canvas `#0F0E0C`:
  - `#E7E2D8` (body) → **15.0:1** AAA
  - `#A8A29E` (muted body) → **7.4:1** AAA
  - `#F59E0B` (primary, large) → **8.9:1** AAA
  - `#1F1300` (button label on amber) → **8.7:1** AAA
  - `#EC4899` (AI pink on canvas) → **5.6:1** AA
  - `#22C55E` / `#5EA6F7` / `#F246B7` (channel badges) → AA on their dark containers
- Status colors always paired with an icon and label, never color alone.
- Focus ring 2px primary (amber), offset 2px — **never removed**.
- Don't identify a channel by color alone — always include the channel name and a Lucide icon.
- All interactive elements meet **WCAG 2.5.5** touch target minimum: 44×44 px on mobile, 40×40 px on desktop.

## Typography

**IBM Plex Sans** is the body face. **JetBrains Mono** is reserved for data contexts: terminal mock, status codes (`$ agentes.responden_`, `// comentario`, `[WA]` channel tags), small caps microcopy, timestamps, and the auth portada's headline. Plex Sans for prose; JetBrains Mono for data — never the other way around.

Both typefaces have full Latin coverage including Spanish (`á é í ó ú ñ`), tabular numerals (Plex ships with `tnum` by default), and are loaded via `next/font/google` as CSS variables (`--font-plex-sans`, `--font-jetbrains-mono`).

### Scale

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display-lg` | 40 / 48 | 700 | Onboarding hero, big empty-state title |
| `headline-lg` | 26 / 34 | 600 | Page title, settings section title |
| `headline-md` | 20 / 28 | 600 | Card title, dialog title |
| `headline-sm` | 16 / 24 | 600 | Conversation contact name, KPI label |
| `body-lg` | 16 / 26 | 400 | Empty-state body, onboarding copy |
| `body-md` | 14 / 22 | 400 | Default UI body, helper text |
| `body-sm` | 13 / 20 | 400 | Reply-box input, message bubble body |
| `label-lg` | 14 / 20 | 500 | Button, tab, large pill |
| `label-md` | 12 / 16 | 500 | Tag, small badge, secondary button |
| `label-sm` | 11 / 14 | 600 | Caps microcopy: "ACTIVO", "BORRADOR" |

### Numerics
All metrics, timestamps, message counts: `font-variant-numeric: tabular-nums`. Inter ships with `tnum` by default.

### Spanish-first
- Sentence case everywhere except status pills (`ACTIVO`, `BORRADOR`).
- Use neutral Spanish (works for es-AR / es-MX / es-ES).

## Layout & Spacing

Hibox uses a **persistent shell** for the workspace, plus contextual full-page routes for setup.

### Workspace shell (≥1024px)
- **Left sidebar — 240px, fixed.** Cream surface. Logo + workspace switcher at top; primary nav (Inicio, Bandeja, Contactos, Automatizaciones, Agentes IA, Equipo, Configuración). Active item: 3px orange rail + `primary-container` fill + orange icon + warm text. User mini-card at bottom.
- **Top bar — 64px height, sticky.** White surface. Workspace context left; page title; search + actions right.
- **Main content** fills the rest with `gutter` (20px) outer padding. **Centered column 880px** for settings, onboarding, single-task pages.

### Inbox route (≥1280px) — 3-pane inside main
- **Conversation list rail — 380px.** Sticky. Filter pill row at top (Todos, WhatsApp, Facebook, Instagram). List rows **72px** (roomy): circular avatar 48px, contact name + channel mini-icon, last-message preview one line, timestamp right. Active row: `primary-container` tint + 3px orange rail left. **No unread counter badges** — just a small orange dot for unread. Generous gap between rows.
- **Thread — flexible, min 480px.** Sticky header (72px) with contact + status + actions, scrollable message list, sticky reply box at bottom (white surface, 16px radius, channel chip + send button). 32px horizontal padding inside.
- **Detail panel — 360px, collapsible.** Contact info, tags, conversation history sidebar. Hidden < 1280px.

### Tablet (768–1023px)
- Sidebar collapses to **64px icon rail**.
- Inbox list rail reduces to **320px**.
- Detail panel becomes a `Sheet` (right slide-over).

### Mobile (<768px)
- Sidebar becomes a `Sheet` triggered by hamburger.
- Inbox list becomes the full screen; tap pushes thread full-screen with back arrow.
- Reply box `position: fixed` bottom with `padding-bottom: env(safe-area-inset-bottom)`.

### Spacing scale
Never raw px. Token table:
- `space-xs` 6px, `space-sm` 10px, `space-md` 14px, `space-lg` 24px, `space-xl` 40px.
- `gutter` 20px mobile, 32px desktop — outer page padding.
- `margin` 24px mobile, 40px desktop — between major sections in long pages.

### Density rule
**This is not a data product.** Default to `space-lg` between cards. Use `space-md` only inside dense rows (contact table, automation list). KPI cards are big, with no more than 4 per row. The dashboard has **at most 6 widgets** total.

## Elevation & Depth

Subtle. Warm-tinted shadows.

| Level | Use | Shadow |
|---|---|---|
| 0 | Page canvas | none |
| 1 | Top bar, sidebar, raised buttons hover | `0 1px 2px rgba(124, 45, 18, 0.05)` |
| 2 | Dropdowns, popovers, hover cards | `0 4px 16px -2px rgba(124, 45, 18, 0.08)` |
| 3 | Modals, sheets, command palette | `0 20px 40px -8px rgba(124, 45, 18, 0.14)` |
| 4 | Toasts (sonner) | dark, `0 12px 24px -4px rgba(31, 27, 22, 0.30)` |

Prefer borders to shadows where the elevation difference is one level.

## Shapes

- **Base radius: 12px** (cards, inputs, buttons).
- **Big radius: 16-20px** for hero cards, settings cards, empty-state cards.
- **Pills (`full`)** for tags, status pills, channel chips, action chips.
- **Full circle** for avatars: 48px in list, 80–96px in hero cards, 32px in topbar.
- **AI agent avatar: 32px with a 2px pink ring** so it reads as non-human at a glance.

## Components

### Buttons

| Variant | Default | Hover | Use |
| --- | --- | --- | --- |
| **Primary** | `#F97316` bg, white text | `#EA580C` bg | Main CTA per surface |
| **Secondary** | white bg, `#1F1B16` text, `1px #E7DBC9` border | `#FFFBF5` bg | Default form action |
| **Tertiary / Ghost** | transparent bg, `#F97316` text | `#FFEDD5` bg | Cancel, "Ver más" |
| **Destructive** | white bg, `#DC2626` text, `1px #FCA5A5` border | `#FEE2E2` bg | Delete automation, remove member |
| **AI** | `#EC4899` bg, white text | `#DB2777` bg | "Sugerir respuesta IA", "Generar con IA" — must include sparkle icon |
| **Connect channel** | `#14B8A6` bg, white text | `#0D9488` bg | One action only on `/settings/channels` |

Height 40px (md), 36px (sm), 32px (xs/icon-only). Padding `14px 20px`. Focus ring 2px `#F97316` offset 2px. Loading: spinner + sonner toast.

### Inputs

- Default text input: 48px height, white bg, `1px #E7DBC9` border, 12px radius, body-md text. Placeholder `#A8A29E`.
- Hover: border `#A8A29E`.
- Focus: border `#F97316`, ring `0 0 0 3px rgba(249, 115, 22, 0.18)`.
- Error: border `#DC2626`, ring `0 0 0 3px rgba(220, 38, 38, 0.18)`.
- Textarea (reply box): min 88px, auto-grow up to 240px.

### Cards

- Default card: white bg, `1px #F5EFE8` border, 16px radius, 24px padding.
- Hero card (settings, contact, dashboard hero): white bg, 16-20px radius, 32-48px padding.
- Inbox list row: transparent at rest, `#FFFBF5` hover, `#FFEDD5` active with 3px orange rail.
- KPI card (dashboard): white bg, 1px border, 16px radius, 24px padding. Big icon top-left in `primary-container` pill. Number headline-md orange. Trend small label below.

### Channel badges
Pill 22px height, `px-2`, `rounded-full`, `label-sm` weight 500. Channel icon + name.
- WhatsApp: `#16A34A` text on `#DCFCE7` bg.
- Facebook: `#1877F2` text on `#DBEAFE` bg.
- Instagram: `#E1306C` text on `#FCE7F3` bg.

### Status pills
Same shape as channel badges. Always include both the dot and the text label:
- Open: orange dot + "Activo" text on `#FFEDD5` bg.
- Pending: amber dot + "Pendiente" text on `#FEF3C7` bg.
- Closed: gray dot + "Cerrado" text on `#F5F5F4` bg.
- Automation active: green dot + "Activo" text on `#DCFCE7` bg.
- Paused: amber dot + "Pausado" text on `#FEF3C7` bg.
- Draft: gray dot + "Borrador" text on `#F5F5F4` bg.
- AI agent auto-reply on: pink dot + "IA activa" text on `#FCE7F3` bg.

### Message bubbles
- **Incoming (customer):** `#FFF7ED` bg, `#1F1B16` text, 16px radius (12px bottom-left corner to indicate direction), max-width 70%.
- **Outgoing (agent):** `#F97316` bg, white text, 16px radius (12px bottom-right), max-width 70%.
- **AI reply:** Same as outgoing but with a small pink sparkle icon and `IA · {model}` footer. Subtle 1px `#EC4899` outline at 30%.
- **System message ("Centered"):** centered, body-sm muted, no bubble.
- **Failed send:** outgoing bubble but red border + retry icon.

### Tables (contacts, automations, members)
- Header: `surface-container-low` bg, label-md text.
- Rows: 64px tall, white bg, hover `#FFFBF5`.
- **Keep tables short.** Default to cards for lists (automation cards, contact cards, member cards) — tables only when filters/search matter.

### Forms
- One column, max width 480px on settings pages.
- Labels above input, never as placeholders.
- Submit primary button right-aligned. Cancel as ghost to the left.

### Empty states
- Big illustration (96-160px circular container, primary-container fill, lucide icon inside).
- Headline headline-md centered.
- Body body-md muted, max 56ch, centered.
- Primary CTA centered.
- **Lots of whitespace** — empty states are moments to breathe.

### Loading & feedback
- Initial route: skeleton blocks matching the expected layout (avoids CLS).
- Lists: row-level skeleton (avatar circle + 2 lines).
- Actions: button spinner + sonner toast on success/error.
- Sonner default position bottom-right, dark theme, 12px radius.

### Navigation
- Sidebar items: 44px height, 14px horizontal padding, 8px radius, icon (20px Lucide) + label. Active: primary-container bg + orange rail. Hover: surface-container-low.
- Tabs: 40px height, underline indicator 3px primary, 150ms transition.
- Top bar: 64px height, workspace switcher left, page title center, actions right.

### Auth screens
- Split layout desktop: form left (520px, cream), brand panel right (orange full-bleed with logo + tagline).
- Mobile: form only, brand collapsed to small logo.
- Form: max-width 380px, centered, single column.

## Icons

**Lucide React** exclusively. 20px default, stroke 1.75. Status icons 16px.

- **Never emoji as icon.** Replace with Lucide (`MessageSquare`, `Sparkles`, `Hand` for waving hello).
- Channel icons: `MessageCircle` (WA), `Facebook` (FB), `Instagram` (IG).
- **AI sparkle (`Sparkles`)** always in pink (`#EC4899`) — never orange.

## Motion

Subtle, fast.
- Default transition: 150ms `cubic-bezier(0.4, 0, 0.2, 1)` for color/opacity, 200ms for layout, 300ms for transforms.
- Hover: instant color, scale 1.02 on primary buttons only.
- Streamed AI text: typewriter at 30ms per character, max 80 chars/sec.
- Respect `prefers-reduced-motion`: disable scale, slide and typewriter; keep only color/opacity.

## Anti-patterns to avoid
- Heavy chrome — keep top bar and sidebar minimal.
- Loud gradients, glassmorphism — this is a friendly tool, not a SaaS demo.
- Status-only color cues — always pair color with an icon and label.
- Emoji as UI icons.
- Pixel-fixed widths on layouts.
- Body text below 12px.
- Mixing the green of WhatsApp with the brand primary or AI pink — channel colors never bleed into the brand palette.
- Density-first design — when in doubt, **add more whitespace**.

## Pre-delivery checklist

- [ ] No emoji as icons (Lucide only)
- [ ] `cursor-pointer` on every clickable non-button element
- [ ] Hover/focus/active states on every interactive element
- [ ] Body text contrast ≥ 4.5:1 on every surface
- [ ] Status colors paired with icon + label
- [ ] Focus ring visible on keyboard nav (2px primary, 2px offset)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1280px, 1440px — tested at each
- [ ] Empty states with illustration + title + body + CTA on every list page
- [ ] Loading skeletons on every route's first load
- [ ] All forms: visible labels, error near field, helper text
- [ ] All buttons: disabled state, loading state, focus state
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] Spanish-first content
- [ ] Generous whitespace — every screen should breathe.
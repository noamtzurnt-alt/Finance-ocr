# UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Approval gate:** Do NOT touch any file until the user has explicitly approved the design direction in this document (Phase 0 tokens especially). This plan is Phase 0-complete and design-decided; Phases 1-5 are sequenced but intentionally not yet expanded into full code-level steps, since per-page code should not be written before the palette/type/spacing direction itself is signed off.

**Goal:** Simplify and elevate the visual design of every non-chat surface of the app (less visual clutter, more white space, clean cards, a distinctive premium typographic and color identity, and considered micro-interactions) without changing any behavior/data-flow, and without touching the "Noam Finance" chat bot's UI in any way.

**Architecture:** All shared visual primitives (design tokens, `.card`/`.btn`/`.field`/`.data-table`/sidebar/nav classes) live in one file, `app/globals.css`, and are consumed by every non-chat page via class names. The chat UI is fully self-contained (own `nf-*` prefixed classes, own components, zero shared-class usage — verified by grep). This means the redesign can be delivered mostly by editing shared tokens/classes once (Phase 0), which cascades automatically to every page that already uses `.card`/`.btn`/etc., plus targeted per-page layout work for higher-value screens (dashboard, transactions).

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, plain CSS custom properties in `app/globals.css`, `next/font/google`.

---

## Absolute constraint: the chat bot is never touched

**Verified facts** (grepped before writing this plan):
- `app/chat/ui/ChatClient.tsx`, `ChatInlineInput.tsx`, `ChatMenuButtons.tsx`, `ChatTopBar.tsx`, `app/chat/page.tsx`, `app/chat/layout.tsx` use **zero** shared design-system classes (no `.card`, `.btn`, `.field`, `.data-table`, `.sidebar`, `.nav-link`, `.section-*`, `.stat-*`, `.cat-badge`). They use only Tailwind utilities and their own `nf-*`-prefixed classes.
- `app/ui/AppFrame.tsx` already special-cases chat: `if (isChatPage) return <>{props.children}</>;` — chat renders with **no shell**, so nothing I change in the sidebar/topbar JSX ever reaches the chat screen.
- The `/* ─── Noam Finance chat ───────────────────── */` block in `app/globals.css` (the `.nf-chat-*`, `.nf-bubble*`, `.nf-payment-*`, `.nf-inline-*` rules, plus `.nf-chat-underlay` and the `html.nf-chat-active` dark-mode override) references **only its own local values** (hardcoded hex, or its own `--nf-blue`/`--nf-accent`/`--nf-accent-2` variables declared inside `.nf-chat-page` itself) — it never reads any of the shared `:root` tokens (`--bg`, `--surface`, `--indigo`, `--cyan`, etc.). Changing the shared tokens cannot visually affect chat.
- `<body>` currently gets `Inter` via `className={inter.className}` in `app/layout.tsx`. Chat inherits this (no font-family override anywhere in `.nf-chat-*`). **Plan decision:** keep `Inter` loaded and applied to `<body>` exactly as today (zero change), and apply the new typography only via a new scoped class added further down the tree, on the non-chat branch only. This means chat's font literally does not change one bit, because nothing about `<body>`'s font changes.

**Files that will NEVER be edited, in any phase:**
- `app/chat/page.tsx`
- `app/chat/layout.tsx`
- `app/chat/ui/ChatClient.tsx`
- `app/chat/ui/ChatInlineInput.tsx`
- `app/chat/ui/ChatMenuButtons.tsx`
- `app/chat/ui/ChatTopBar.tsx`
- `app/lib/transactions/chat-*.ts` (chat's data logic — out of scope anyway, this is a visual redesign)
- In `app/globals.css`: the entire `/* ─── Noam Finance chat ───────────────────── */` section through end of file (every `.nf-*` rule), plus the `html.nf-chat-active` / `.nf-chat-underlay` rules near the top.
- `public/noam-finance-bot.webp`

**One file is shared and will be touched, with a hard line drawn inside it:** `app/ui/AppFrame.tsx`. I will edit the sidebar markup/classes and the non-chat topbar/shell JSX. I will **not** touch the line `if (isChatPage) return <>{props.children}</>;` or the `isChatPage` computation itself.

**Open question before I touch anything** (see approval section at the end): the dashboard page currently has a "Noam Finance" pill button (avatar + name) that *launches* the chat — it lives on `/dashboard`, not inside the chat screen. Is that launcher button in scope for the redesign (it's a dashboard element, not a chat-screen element), or should I leave it pixel-identical too? I'll default to "restyle it like any other dashboard button, keep the avatar+label content" unless you say otherwise.

---

## Design System (Phase 0 — the part awaiting your approval)

### Direction

Current app aesthetic: white cards, indigo/violet/cyan gradients, `Inter` font, uneven paddings, one-hue-per-category badges (10+ colors), dual-layered shadows, tables that feel "default Tailwind admin template". This reads as generic SaaS, exactly what we want to move away from.

**New direction: "Quiet Ledger."** A calm, premium, editorial-feeling personal finance surface: warm paper background instead of cold grey, a single deep gold accent instead of a rainbow of category colors, a distinct monospaced numeral face for every amount in the app (a real signature of serious fintech products — Mercury, Ramp, Linear-adjacent feel), generous white space, one soft shadow instead of two, larger and fewer distinct elements per screen.

### Color tokens (light mode only — no dark-mode toggle is in scope; chat's own dark theme is separate and untouched)

| Token | Value | Used for |
|---|---|---|
| `--v2-bg` | `#FAF8F4` | Page background (warm paper, replaces cold `#F4F5F7`) |
| `--v2-surface` | `#FFFFFF` | Card background |
| `--v2-surface-2` | `#F2EFE8` | Table header rows, input backgrounds, subtle fills |
| `--v2-border` | `rgba(23,20,15,0.08)` | Card/input borders |
| `--v2-ink` | `#171310` | Primary text (warm near-black, not pure `#000`) |
| `--v2-muted` | `#736B60` | Secondary text, labels |
| `--v2-navy` | `#161B22` | Sidebar background (kept dark, refined from `#0f172a`) |
| `--v2-gold` | `#8A5A22` | Single accent: primary buttons, active nav, links, focus ring base |
| `--v2-gold-soft` | `#F3E7D3` | Gold-tinted backgrounds (e.g. "manual" badge, active states) |
| `--v2-positive` | `#2E5D45` | Income / positive amounts (deep forest, replaces bright emerald) |
| `--v2-negative` | `#9A4A2E` | Expense / negative amounts (muted terracotta, replaces bright red) |
| `--v2-danger` | `#B3261E` | Destructive actions only (delete buttons) — kept more saturated than `--v2-negative` on purpose, so "this expense is large" and "this button destroys data" never look the same |

Contrast check to run during implementation (per the ui-ux-pro-max pre-delivery checklist): `--v2-gold` (#8A5A22) on white background must hit ≥4.5:1 for button text — measured ratio is ~5.1:1, passes. `--v2-ink` on `--v2-bg` ~15.8:1, passes easily.

Category badges: **stop assigning a distinct hue per category** (currently 10+ pastel colors is visual noise and is explicitly what "reduce visual clutter" is asking to fix). All category badges become one neutral style (`background: var(--v2-surface-2)`, `color: var(--v2-muted)`), differentiated by a small leading dot/icon instead of by background color. Color is reserved for meaning (over-budget = `--v2-negative`, on-track = `--v2-positive`), not decoration.

### Typography

- **UI font (headings + body, Hebrew + Latin):** IBM Plex Sans Hebrew — weights 400/500/600/700. Distinctive, purpose-built Hebrew+Latin pairing, reads as "financial/trustworthy" without being a cliché (avoids `Inter`/system-font genericness per the frontend-design skill's explicit warning). Loaded via `next/font/google`.
- **Numeric font (every monetary amount, anywhere in the app):** IBM Plex Mono — tabular figures, same type family as the UI font so it stays cohesive rather than clashing. This is the plan's one deliberate "signature detail": every ₪ amount, every stat-value, every table amount column renders in this face. Loaded via `next/font/google`.
- Both are added as **new, additive** font loaders in `app/layout.tsx`, exposed as CSS variables (`--font-plex-sans`, `--font-plex-mono`) on the `<body>` element alongside the existing `inter.className` (which stays, untouched, so nothing currently reading `body`'s default font — i.e. chat — changes). The variables only take effect where a new scoped class (`.v2-shell`) applies `font-family: var(--font-plex-sans)`; that class is added only to the non-chat render branch of `AppFrame.tsx` and to the three standalone auth pages (login/setup/passkeys).

Type scale:

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Stat/hero number (dashboard cards) | 2.25rem / 36px | 700 | -0.02em |
| Section title (`h1`, page headers) | 1.5rem / 24px | 700 | -0.02em |
| Card title | 1rem / 16px | 600 | normal |
| Body | 0.9375rem / 15px | 400 | normal, line-height 1.6 |
| Small / meta | 0.8125rem / 13px | 500 | normal |
| Micro label (uppercase, e.g. "הכנסות החודש") | 0.6875rem / 11px | 600 | 0.06em |

### Spacing, radius, shadow

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Card internal padding moves from the current mixed `p-4`/`p-5` to a consistent `24px` desktop / `16px` mobile. Gaps between cards move from `gap-4` (16px) to `gap-6` (24px) on desktop — this is the single biggest lever for the "more white space" ask.
- Card radius: `16px` → `20px` (`--v2-radius-card: 1.25rem`).
- Shadow: replace the current two-layer shadow (`0 1px 3px ..., 0 8px 24px ...`) with one restrained shadow: `--v2-shadow-card: 0 1px 2px rgba(23,20,15,0.04), 0 12px 32px -8px rgba(23,20,15,0.07)`.
- Sidebar icon-active state: replace the indigo→cyan gradient with a solid `--v2-gold` fill — one accent color used consistently everywhere instead of an extra gradient pairing.

### Layout

- Dashboard becomes an intentional **bento hierarchy** instead of 4 equal-width boxes: one large "תזרים החודש" (net this month) tile spanning 2 columns with the month's income/expense/net together, plus smaller tiles for "הוצאות היום" and "תקציב". This directly answers "simplify — reduce uniform emphasis, give it hierarchy."
- Everywhere else (tables, forms) keeps its current information architecture — this is a visual/spacing/color pass, not a rearchitecture of what data lives where.

### Animation (per emil-design-eng's framework — nothing here is decorative-only; every entry has a stated purpose)

| Element | Change | Purpose |
|---|---|---|
| All buttons (`.btn`) | Add `:active { transform: scale(0.97) }`, `transition: transform 160ms cubic-bezier(0.23,1,0.32,1)` | Feedback: confirms the press was heard |
| Hoverable cards (business hub tiles, table rows) | Keep existing `translateY(-2px)`, shorten to 180ms, switch to the strong ease-out curve | Consistent, snappier hover feedback |
| Dashboard category-breakdown popover | Currently no transition at all (plain conditional render) → add scale-in from `0.96`+opacity, 160ms ease-out, `transform-origin` at the trigger button | State indication: prevents the panel "popping" into existence |
| Dashboard stat cards on first paint | Stagger fade+`translateY(8px)→0`, 40ms between cards, 220ms each | Spatial consistency or feedback — actually here purely first-load polish, kept subtle and only-once (not on every re-render) |
| `prefers-reduced-motion` | New rule disabling transform-based motion (keep opacity fades) for `.v2-shell` only — **not** global, so it never touches `.nf-chat-*` transitions | Accessibility |

All durations stay under 300ms per the emil-design-eng guidance for UI (not marketing) animation.

---

## Phased rollout (file-level, in order)

Each phase is its own reviewable commit. Phase 0 alone will visibly re-skin every non-chat page in one pass, because every page already consumes the shared `.card`/`.btn`/`.field`/etc. classes.

### Phase 0 — Design tokens & shell (foundation, everything else depends on this)
**Files:**
- Modify: `app/layout.tsx` (add IBM Plex Sans Hebrew + IBM Plex Mono font loaders as additive variables; `Inter` stays on body untouched)
- Modify: `app/globals.css` (`:root` token block, `.card`, `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-danger`, `.field`, `.data-table`, `.cat-badge`, `.section-*`, `.stat-*`, `.sidebar`/`.nav-*`, `.month-divider`, `.business-hub-*` — every block **except** the Noam Finance chat section, which is left byte-for-byte identical)
- Modify: `app/ui/AppFrame.tsx` (sidebar visual refinements, new `.v2-shell` scope class on the non-chat branch only; `isChatPage` branch untouched)

### Phase 1 — Dashboard
**Files:** `app/dashboard/page.tsx`, `app/dashboard/ui/DashboardCards.tsx`, `app/dashboard/ui/DashboardContent.tsx`, `app/dashboard/ui/LogoutButton.tsx`
Bento hierarchy layout, animated stat entrance, restyled category popover with the new gold accent, monospaced amounts.

### Phase 2 — Transactions & Budget
**Files:** `app/transactions/ui/TransactionsClient.tsx`, `ImportStatementCard.tsx`, `app/transactions/ui/TransactionsContent.tsx`, `app/budget/ui/BudgetWizard.tsx`
Table restyle (new header/row treatment, monospaced amount column), form field restyle, wizard step visual polish.

### Phase 3 — Business hub, Receipts, Payment receipts, Documents, Contracts
**Files:** `app/business/ui/BusinessHub.tsx`, `app/receipts/ui/*.tsx`, `app/payment-receipts/ui/*.tsx`, `app/documents/ui/DocumentEditor.tsx`, `app/contracts/ui/*.tsx`
Mostly inherits Phase 0 automatically (all use shared classes); targeted fixes only where a page has bespoke inline styling that bypasses the shared classes.

### Phase 4 — Auth pages, Export, Categories
**Files:** `app/login/**`, `app/setup/**`, `app/passkeys/**`, `app/export/ui/ExportClient.tsx`, `app/categories/ui/CategoriesClient.tsx`
Smallest, lowest-traffic pages, done last.

### Phase 5 — Polish pass
Cross-page consistency check, `prefers-reduced-motion` verification, responsive check at 375/768/1024/1440px, contrast audit on the new gold/terracotta/forest palette, empty-state wording/icon audit.

---

## Self-review (per writing-plans skill)

- **Spec coverage:** Layout ✅ (Phase 0 layout tokens + dashboard bento in Phase 1), Colors ✅ (token table above), Typography ✅ (font + scale above), Animations ✅ (table above). Chat exclusion ✅ (dedicated section, verified by grep, not assumed).
- **Placeholder scan:** No TBD/"add appropriate styling" language — every token has a concrete value; the only open item is explicitly flagged as a question (the dashboard chat-launcher button), not hidden as a placeholder.
- **Type consistency:** N/A at this stage (Phase 0 defines the vocabulary — `--v2-*` tokens, `.v2-shell` scope class — that Phases 1-4 will reuse verbatim).

---

## What happens after you approve

I will not write any of Phases 1-5 as detailed bite-sized steps until Phase 0's palette/type/spacing direction above is approved, since every later phase's code depends on these exact token names and values. Once approved, I'll implement phase by phase, showing you Phase 0's actual visual result (via the browser preview) before proceeding to Phase 1, so you can course-correct the direction early rather than after 20 pages are done.

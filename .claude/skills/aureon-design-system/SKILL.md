---
name: aureon-design-system
description: Aureon's design tokens, component patterns, and UI quality checklist. Load before creating or modifying any frontend page, card, or form in frontend/app or frontend/components.
---

# Aureon Design System

Aureon's visual language: dark, warm, astrological — think observatory at night, not a
generic SaaS dashboard. Gold accents, serif display type, quiet star-field background.
`frontend/app/globals.css` is the single source of truth — grep it before introducing any
new color, spacing value, or component class. Never hardcode a hex color or px value that
already has a token.

## Design tokens (`:root` in globals.css)

```css
--bg: #14110f;          /* page background */
--bg-raised: #1c1815;   /* input fields */
--bg-card: #211d19;     /* .card background */
--gold: #c9a24a;        /* primary accent, CTAs */
--gold-soft: #8a7440;   /* secondary gold, labels */
--plum: #6f5f8c;        /* rare secondary accent */
--text: #f2ede2;        /* primary text */
--text-dim: #a89f8f;    /* body/secondary text */
--text-faint: #6d6558;  /* tertiary, footer text */
--line: #322c25;        /* borders, dividers */
```

Never introduce a new color outside this palette without a specific reason — the whole
site reads as one coherent object because every surface pulls from the same six colors.

## Typography

- Headings (`h1`, `h2`, `h3`, `.serif`) use Fraunces (serif, `var(--font-fraunces)`) —
  editorial, warm, slightly literary.
- Body text uses Manrope (sans, `var(--font-manrope)`) — clean, readable, never competes
  with the serif headings for attention.
- Don't mix in a third typeface. Don't use heading weight/size for body copy or vice versa.

## Core component patterns (reuse, don't reinvent)

- **`.card`** — the base content block (`background: var(--bg-card)`, rounded, bordered).
  Stack multiple with `.card + .card` for automatic spacing. Every dashboard/page section
  should be a `.card`, not a bare `<div>`.
- **`.hud`** — adds sci-fi corner brackets + an optional `.hud-tag` label (top-right,
  uppercase, gold). Used on elevated/featured surfaces (onboarding card, chat window).
- **`.btn` / `.btn-gold` / `.btn-ghost`** — `.btn-gold` is the primary CTA (has a pulsing
  glow animation, use sparingly — one per screen, not on every button). `.btn-ghost` is
  secondary/tertiary actions.
- **`.field`** — label + input wrapper, used throughout forms (onboarding, register,
  compatibility). **`.row2`** — two `.field`s side by side (e.g. date + time).
- **`.screen` / `.dash-grid` / `.onboard-wrap`** — page-level layout containers. A new page
  should reuse one of these, not invent a new max-width/padding scheme.
- **`.legal-page`** — long-form readable content (Terms/Privacy pattern: `max-width: 720px`,
  generous line-height, muted body text).
- **`.site-footer`** — already global (in `layout.tsx`), don't duplicate footer markup on
  individual pages.

## Before shipping any UI change, check:

1. **Loading state** — does the page show *something* (not a blank flash) while data
   fetches? Existing pattern: render `null` until state is no longer `undefined`
   (see `dashboard/page.tsx`'s `profile === undefined` guard), not a spinner for every case.
2. **Empty state** — what does a brand-new user with no data see? Never a raw error or
   blank card — always a clear next action (see the "Complete your profile" CTA pattern).
3. **Error state** — network/API failures show a specific, styled message
   (`color: "#c96a4a"`, `fontSize: 13`), never a silent failure or raw stack trace.
4. **Responsive** — does it hold up narrower? The site has no explicit mobile breakpoints
   defined yet; test at ~375px width before assuming it's fine.
5. **Accessibility basics** — sufficient contrast against `--bg`/`--bg-card` (both are
   very dark — `--text-faint` on `--bg-card` is close to the readability floor, don't go
   dimmer), interactive elements are real `<button>`/`<a>` tags, not styled `<div>`s.
6. **Gating** — if the feature is Premium/VIP-only, follow the existing pattern: show the
   feature to everyone but gate the *content* with an upgrade CTA (see `/compatibility`
   and the ChatWindow free-tier message limit), don't hide the nav link entirely.

## When you need something genuinely new

If no existing token/component fits, add it to `globals.css` near the related section
(the file has clear `/* ---- Section name ---- */` comment dividers) rather than inline
`style={{}}` — inline styles are only for one-off numeric tweaks (margins, flex gaps) on
otherwise-styled elements, not for defining new visual patterns.

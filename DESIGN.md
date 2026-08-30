---
name: Gavi411
description: A friendly concierge/request app, styled after the warm cream, gold-accented "budget tracker" aesthetic from the project's inspo board.
colors:
  ink: "#221f19"
  body-text: "#6b6355"
  cream-bg: "#fbfaf6"
  surface: "#ffffff"
  border: "#ece8dc"
  code-bg: "#f5f3ea"
  gold: "#f2a900"
  gold-strong: "#d99400"
  sage-green: "#6fae8f"
  sage-green-strong: "#4f8a6c"
  lavender: "#9b8cce"
dark:
  body-text: "#b3b0aa"
  ink: "#f5f4f0"
  bg: "#17181a"
  surface: "#212327"
  border: "#34363b"
  code-bg: "#212327"
  gold: "#ffb700"
  gold-strong: "#ffc933"
  sage-green: "#6fae8f"
  sage-green-strong: "#8fc7ab"
  lavender: "#b3a5e0"
typography:
  h1:
    fontFamily: "'Rubik', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: "100%"
    letterSpacing: "-1.68px"
  h2:
    fontFamily: "'Rubik', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: "118%"
    letterSpacing: "-0.24px"
  body:
    fontFamily: "'Rubik', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "145%"
    letterSpacing: "0.18px"
  label:
    fontFamily: "'Rubik', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  wordmark:
    fontFamily: "'Google Sans', 'Rubik', system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-1.68px"
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.gold-strong}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-success:
    backgroundColor: "{colors.sage-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-purple:
    backgroundColor: "transparent"
    textColor: "{colors.lavender}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.5}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  chip-selected:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.surface}"
---

# Design System: Gavi411

## Overview

**Creative North Star: "The Concierge's Ledger"**

Gavi411 reads like a trusted assistant's warm, well-kept ledger rather than a slick SaaS dashboard: a cream page, ink-dark text, white index cards for every request and message, and a confident gold accent for the actions that matter. Sage green and a soft lavender sit alongside gold as secondary/data accents — a chat bubble, a "Submit" vs. "Back" distinction in the intake flow — but gold leads. Plain sans throughout (no serif) keeps every screen feeling like a functional, well-organized tool a person actually runs, not a decorative brochure.

This direction was revised directly by Gavi from an earlier forest-green/serif draft, after live review against the Design Inspo board: the "layout color and elemnts" budget-tracker screenshot (cream bg, white cards, gold progress bar and key figures, sans-serif throughout) is the real primary reference, not the Nexus AI screens' occasional serif headline moments — those turned out to be rare accents inside otherwise all-sans imagery, over-generalized into a default the first time around. The "color" folder's Stranger Chat kit confirmed a light purple as a valid *secondary* accent, never primary. The purple/lavender gradient look and the deep-forest-green-as-primary direction are both explicitly retired.

**Key Characteristics:**
- Warm cream page background (`#fbfaf6`), never stark white behind the whole viewport — only cards and inputs are pure white.
- Gold (`#f2a900`) is the primary accent. Sage green and lavender are secondary/tertiary accents with specific, narrow jobs — not general-purpose alternatives to gold.
- No serif anywhere. Rubik (sans) for all headings and body text; Google Sans reserved solely for the literal "Gavi411" wordmark.
- Everything interactive (buttons, chips) is a full pill; inputs/selects use the large-rounded (20px) card radius, not a pill — Gavi's explicit correction from an earlier pill-input pass.
- Cards carry a soft ambient shadow and a hairline border, not a hard drop shadow.
- A full dark palette exists (manual toggle over `prefers-color-scheme`, `[data-theme]` attribute), not just a light-only system.

## Colors

A warm-neutral ground with one confident primary accent (gold) and two narrower secondary accents (sage green, lavender).

### Primary
- **Gold** (`#f2a900`, dark: `#ffb700`): the primary accent — primary button fill, chip-selected state, input focus ring/border, the "own message" chat bubble fill. Hover/active state darkens to Gold Strong (`#d99400`, dark: `#ffc933`).

### Secondary
- **Sage Green** (`#6fae8f`, dark: `#6fae8f`): a narrower second accent — currently used only for the intake flow's "Submit" action (`.btn-success`), distinguishing it from the general-purpose gold CTA. Hover darkens to `#4f8a6c` (dark: `#8fc7ab`).

### Tertiary
- **Lavender** (`#9b8cce`, dark: `#b3a5e0`): a third, even narrower accent — currently used only for the intake flow's "Back" action (`.btn-purple`), an outline/ghost treatment (transparent fill, lavender text/border, `color-mix` wash on hover since no dedicated `-bg` token exists yet).

### Neutral
- **Ink** (`#221f19`, dark: `#f5f4f0`): heading and high-emphasis text color.
- **Warm Taupe** (`#6b6355`, dark: `#b3b0aa`): body text color — softer than pure black/white, keeps the page feeling handwritten rather than printed.
- **Cream** (`#fbfaf6`, dark: `#17181a`): the page/body background. This is the ground everything else sits on.
- **Surface White** (`#ffffff`, dark: `#212327`): card, input, and modal backgrounds — the only pure-white surface in light mode.
- **Hairline** (`#ece8dc`, dark: `#34363b`): card/input borders and dividers, barely-there against the page background.

### Named Rules
**The One Lead Accent Rule.** Gold is the only accent used for general-purpose primary actions. Sage green and lavender are reserved for their two specific, already-assigned jobs (intake Submit / Back) — don't reach for them as a second "brand color" option elsewhere without a comparably specific reason.

**The Dark-Mode-Is-Real Rule.** Every color token has a confirmed dark-mode value (see the `dark:` frontmatter block and `:root[data-theme="dark"]` / the `prefers-color-scheme` media query in `index.css`). New colors need a dark counterpart before shipping, not just a light one.

## Typography

**Font (all roles):** Rubik (with system-ui, 'Segoe UI', Roboto, sans-serif fallback)
**Wordmark-only Font:** Google Sans (falls back to Rubik) — used exclusively for the literal "Gavi411" logo/wordmark text, never for page headings.

**Character:** A single functional sans-serif carries the whole system. An earlier serif/sans pairing was tried and explicitly reverted — Gavi's direct call after review — because the reference imagery's serif moments were rare accents, not a real pattern, and the serif "4" glyph read badly in the wordmark specifically.

### Hierarchy
- **H1** (500 weight, 56px, -1.68px letter-spacing): page-level heading. Drops to 36px under 1024px viewports.
- **H2** (500 weight, 24px, -0.24px letter-spacing, 118% line-height): card and section headings — "New request", a request's subject line. Drops to 20px under 1024px viewports.
- **Body** (400 weight, 18px, 0.18px letter-spacing, 145% line-height): all running text, request descriptions, message content. Drops to 16px base under 1024px viewports.
- **Label** (600 weight, 14px): form field labels, sitting above the input.
- **Wordmark** (600 weight, 56px, 1.2 line-height, -1.68px letter-spacing, Google Sans): the "Gavi411" logo text specifically — sized/spaced to match H1 exactly since it renders as both an `<h1>` and a clickable `<button>` (exit control) depending on the view, and the two elements must be visually identical.

## Layout

Content sits in a centered column (`#root`, 1126px max) with a hairline border on each inline edge, cream showing outside it; `scrollbar-gutter: stable` keeps that column from visibly shifting between a scrollable and non-scrollable page. Cards stack vertically with consistent spacing-5 (24px) gaps. Global `box-sizing: border-box` applies everywhere so padded components (Card, Input, Select, Chip, LockedField) don't overflow their own max-width. The spacing scale is a plain 4px-based ladder (4/8/12/16/24/32/48) rather than a named semantic scale.

Within the intake flow and design-preview shell, a narrower 420px column is used for the header row (wordmark + theme toggle) and the primary card, matching each other explicitly rather than each resizing independently.

## Elevation & Depth

Flat page background, soft ambient shadow under cards and the confirm-modal only — never a hard, high-contrast drop shadow. Depth is secondary to the border: the hairline border does most of the work of separating a surface from the page; the shadow just adds a little lift. The shadow token itself darkens/intensifies slightly in dark mode rather than staying a fixed value.

### Shadow Vocabulary
- **Ambient** (light: `rgba(0,0,0,0.1) 0 10px 15px -3px, rgba(0,0,0,0.05) 0 4px 6px -2px`; dark: `rgba(0,0,0,0.4) 0 10px 15px -3px, rgba(0,0,0,0.25) 0 4px 6px -2px`): the only shadow in the system — cards, the confirm modal.

## Shapes

Two form languages: **pill** (full border-radius, 999px) for anything you click to trigger an action — buttons, chips, the theme toggle, the message-send button — and **large-rounded-rect** (20px) for cards, modals, inputs, and selects. A locked/read-only field uses a dashed variant of the 14px medium radius to signal "tap to unlock" distinctly from a real input's solid border. There is no sharp-cornered treatment anywhere.

### Named Rules
**The Pill-Is-For-Actions Rule.** A pill radius means "click this to do something" (button, chip, icon button). Inputs, selects, and containers are never pills — they use the 20px card radius instead. This is a correction from an earlier draft that made all inputs pills; Gavi's direct call after review found pill inputs read as over-rounded next to the text they hold.

## Components

### Buttons
- **Shape:** full pill (999px radius)
- **Primary:** gold fill (`#f2a900`), white text, 14px/28px padding, 600 weight; hover darkens to Gold Strong
- **Secondary:** transparent fill, gold text, gold border at 40% opacity; hover fills with a faint gold wash (12% opacity)
- **Success** (intake flow "Submit" only): sage-green fill, white text; hover darkens to Sage Strong
- **Purple/ghost** (intake flow "Back" only): transparent fill, lavender text/border; hover fills with a 12% lavender `color-mix` wash (kept as a mix rather than a fixed token so it stays correct across light/dark, since lavender itself changes value between themes)
- **Disabled:** 50% opacity, `cursor: not-allowed`, same shape/colors otherwise

### Chips
- **Style:** pill radius, white/surface background, hairline border, 600-weight text
- **State:** unselected chips show a subtle gold-border hover; selected fills solid gold with white text

### Cards / Containers
- **Corner Style:** 20px radius (large)
- **Background:** surface white (`#ffffff` / dark `#212327`), always on the page background — never surface-on-surface
- **Shadow Strategy:** ambient shadow (see Elevation & Depth)
- **Border:** 1px hairline
- **Internal Padding:** spacing-5 (24px)
- A card can be wrapped in a real `<button>` (the clickable request-list card) with its own chrome fully reset so it's indistinguishable from a static card while staying keyboard/AT-accessible.

### Inputs / Fields (Input, Select)
- **Style:** 20px (large) radius — not a pill — white background, hairline border, label sits above the field (not floating, not inline)
- **Focus:** border shifts to gold at 40% opacity plus a soft gold glow ring (`box-shadow: 0 0 0 3px` at 12% opacity)
- **Error / Disabled:** not yet defined — no dedicated error/disabled input state exists in the codebase; a plain unstyled `<p>` is the current convention for error text (see Message Thread) rather than inventing a styled error state ahead of need

### Locked Field
- A read-only review-step row that unlocks into a real input on click. Dashed hairline border (not solid) signals "tap to edit" distinctly from an actual input's solid border; hover shifts the dashed border to gold.

### Message Thread (signature component)
- Own messages: right-aligned, gold-filled bubble, asymmetric radius (`lg lg space-1 lg` — the bottom-right corner pinches in) to point toward the sender's side.
- Other party: left-aligned, surface-white bubble with hairline border, mirrored asymmetric radius pinching the bottom-left corner instead.
- Compose bar: a single auto-growing textarea plus one morphing icon button (camera when empty, send-arrow once there's content) — gold fill normally, a bordered disabled state mid-send rather than staying gold-but-inert.
- Images attach inline (small radius, capped size) with a dark circular remove button overlaid top-right.

## Do's and Don'ts

### Do:
- **Do** keep the page background cream (`#fbfaf6` / dark `#17181a`) and reserve the surface-white token for cards, inputs, and modals only.
- **Do** use Rubik for everything except the literal wordmark, which uses Google Sans.
- **Do** make every actionable trigger (button, chip, icon button) a full pill; every input, select, card, and modal a 20px-radius surface — never a pill input.
- **Do** keep gold as the one general-purpose accent — reach for sage green or lavender only for their specific, already-assigned jobs (intake Submit / Back), not as an alternate "brand color."
- **Do** give every new color token both a light and a dark value before shipping it.
- **Do** pair every transition/animation with a `prefers-reduced-motion: reduce` fallback that disables it — every current motion pattern (step-card slide-in, collapsible expand/collapse) already does this; new motion should match.

### Don't:
- **Don't** reintroduce a serif headline font — tried once, explicitly reverted by Gavi after live review.
- **Don't** make deep forest green the primary accent — an earlier, since-corrected direction; gold leads now.
- **Don't** give an input, select, or any container a pill radius — pills are for actionable triggers only.
- **Don't** introduce the purple/lavender *gradient* look seen in some inspo images (the Stranger Chat kit's actual gradient treatment, distinct from using lavender as a flat accent) — off-brand, dating/social-app category noise.
- **Don't** add a UI component library or CSS-in-JS dependency — this system is plain CSS + custom properties by project convention (Ponytail/YAGNI), and stays that way.
- **Don't** apply logical/bidi CSS properties system-wide — UI chrome is English/LTR only; bidi handling is scoped to specific freeform text fields, not the design system (per `gavi411-brain.md` decision #22).

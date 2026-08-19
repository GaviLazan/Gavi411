---
name: Gavi411
description: A friendly concierge/request app, styled after the warm cream, deep-green "Nexus AI" chat aesthetic from the project's inspo board.
colors:
  ink: "#221f19"
  body-text: "#6b6355"
  cream-bg: "#f6f3ea"
  surface: "#ffffff"
  border: "#e6e1d3"
  code-bg: "#efece0"
  forest-green: "#2f4a3c"
  forest-green-deep: "#1f3329"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: "100%"
    letterSpacing: "-1.68px"
  title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: "118%"
    letterSpacing: "-0.24px"
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "145%"
    letterSpacing: "0.18px"
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
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
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.forest-green-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.forest-green}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.5}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
---

# Design System: Gavi411

## Overview

**Creative North Star: "The Concierge's Notebook"**

Gavi411 reads like a trusted assistant's warm, paper-toned notebook rather than a slick SaaS dashboard: a cream page, ink-dark text, white index cards for every request and message, and a single deep forest-green accent used sparingly for action. The pairing of a serif display headline with a plain sans body signals "a person is handling this, not a bot farm" — capable and a little literary, never cold or corporate.

This direction was extracted from the project's Design Inspo board, not invented. It is the pattern that recurred independently across three separate folders: the "Nexus AI" screens in `General layout` (appearing in 5 of that folder's images — cream background, serif "Intelligent Conversations" headline, green chat bubbles and solid CTA), the Hebrew-language concierge chat screenshot in `chat interface` (cream background, white rounded message bubbles, the exact card-on-cream structure), and the budget-tracker screen in `layout color and elemnts` (cream background, white bordered cards, green figures as the one accent color). The `elements style` folder's Serviqo AI-support kit confirmed the card/stat-tile shape and pill-input pattern specifically for a support-request product. The purple/lavender gradient screens seen in `color` (Stranger Chat kit) and elsewhere in `General layout` (a dating-app UI) were treated as anti-reference: a different product category (social/dating), inconsistent with the majority pattern, and not concierge-shaped.

**Key Characteristics:**
- Warm cream page background, never stark white behind the whole viewport — only cards are pure white.
- One accent color only: deep forest green. No secondary or tertiary accent.
- Serif display type for headlines, plain sans for everything functional.
- Everything interactive (buttons, inputs) is a full pill — no rounded-rectangles for actionable elements.
- Cards carry a soft ambient shadow and a hairline border, not a hard drop shadow.

## Colors

A one-accent, warm-neutral palette: cream ground, white cards, near-black ink, forest green as the sole call-to-action color.

### Primary
- **Forest Green** (#2f4a3c): the one accent color — primary button fill, focus rings, links, and (per the chat-interface reference) would be the sender's message-bubble color. Used sparingly; large fields stay cream or white.

### Neutral
- **Ink** (#221f19): heading and high-emphasis text color.
- **Warm Taupe** (#6b6355): body text color — softer than pure black, keeps the page feeling handwritten rather than printed.
- **Cream** (#f6f3ea): the page/body background. This is the ground everything else sits on.
- **Surface White** (#ffffff): card and input backgrounds — the only pure-white surface in the system.
- **Hairline** (#e6e1d3): card borders and dividers, barely-there against the cream ground.

### Named Rules
**The One Accent Rule.** Forest green is the only saturated color in the system. If a new UI need shows up wanting a second brand color (e.g. a warning or success state), reach for a neutral or an opacity variant of green before introducing a new hue — the inspo board never showed a second accent.

## Typography

**Display Font:** Georgia (with 'Times New Roman', serif fallback)
**Body Font:** system-ui ('Segoe UI', Roboto, sans-serif fallback)

**Character:** A serif/sans pairing borrowed directly from the "Intelligent Conversations" Nexus AI screens — the serif headline reads as considered and human-written, the sans body stays purely functional and gets out of the way for request text, form fields, and chat content.

### Hierarchy
- **Display** (500 weight, 56px, -1.68px letter-spacing): page-level h1, e.g. app name or a section-defining headline. Drops to 36px under 1024px viewports.
- **Title** (500 weight, 24px, -0.24px letter-spacing): card and section headings (h2) — "New request", a request's subject line.
- **Body** (400 weight, 18px, 0.18px letter-spacing, 145% line-height): all running text, request descriptions, message content. Drops to 16px base under 1024px viewports.
- **Label** (600 weight, 14px): form field labels, sitting above the input per the Edit Profile reference pattern rather than as a floating label.

## Layout

Content sits in a centered column (currently 1126px max, inherited from the Vite starter shell and not yet revisited for the real app shell) with a hairline border on each inline edge, cream showing outside it. Cards stack vertically with consistent spacing-5 (24px) gaps. The spacing scale is a plain 4px-based ladder (4/8/12/16/24/32/48) rather than a named semantic scale — small enough surface area so far that named roles would be premature.

## Elevation & Depth

Flat cream background, soft ambient shadow under cards only — never a hard, high-contrast drop shadow. Depth is secondary to the border: the hairline border does most of the work of separating a card from the page; the shadow just adds a little lift.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: rgba(0,0,0,0.1) 0 10px 15px -3px, rgba(0,0,0,0.05) 0 4px 6px -2px`): the only shadow in the system, used on cards.

## Shapes

Two form languages only: **pill** (full border-radius, 999px) for everything interactive — buttons and inputs — and **large-rounded-rect** (20px) for containers — cards. There is no sharp-cornered or barely-rounded (4-8px) treatment for anything a user acts on; the 8px small radius token exists for future small chip-style elements but nothing built yet uses it.

### Named Rules
**The Pill-or-Card Rule.** If it's clickable/typeable, it's a pill. If it's a container, it's a large-radius card. Nothing in between.

## Components

### Buttons
- **Shape:** full pill (999px radius)
- **Primary:** forest green fill (#2f4a3c), white text, 14px/28px padding, 600 weight
- **Hover / Focus:** primary darkens to #1f3329 on hover; no separate focus-ring treatment defined yet beyond the browser default
- **Secondary:** transparent fill, green text, green border at 35% opacity — hover fills with a faint green wash (8% opacity)

### Cards
- **Corner Style:** 20px radius (large)
- **Background:** surface white (#ffffff), always on the cream page background — never white-on-white
- **Shadow Strategy:** card ambient shadow (see Elevation & Depth)
- **Border:** 1px hairline (#e6e1d3)
- **Internal Padding:** spacing-5 (24px)

### Inputs / Fields
- **Style:** pill radius, white background, hairline border, label sits above the field (not floating, not inline)
- **Focus:** border shifts to green at 35% opacity plus a soft green glow ring (`box-shadow: 0 0 0 3px` at 8% opacity)
- **Error / Disabled:** not yet defined — no error or disabled state exists in the codebase yet; don't invent one

## Do's and Don'ts

### Do:
- **Do** keep the page background cream (#f6f3ea) and reserve pure white (#ffffff) for cards and inputs only — that contrast is what makes the "notebook on a desk" feel work.
- **Do** use the serif (Georgia) only for headings; body copy, labels, and buttons stay sans.
- **Do** make every clickable/typeable element a full pill; every container a 20px-radius card.
- **Do** keep forest green as the only accent — reach for opacity variants of it (see `--accent-bg`, `--accent-border`) before adding a second color.

### Don't:
- **Don't** introduce the purple/lavender gradient look seen in some inspo images — it was explicitly identified as off-brand noise (dating/social app category), not the direction this system follows.
- **Don't** add a UI component library or CSS-in-JS dependency — this system is plain CSS + custom properties by project convention (Ponytail/YAGNI), and stays that way.
- **Don't** apply logical/bidi CSS properties system-wide — UI chrome is English/LTR only; bidi handling is scoped to specific freeform text fields, not the design system (per gavi411-brain.md decision #22).

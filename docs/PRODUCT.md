# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase, not a greenfield decision: React (Vite) frontend — JavaScript only, no TypeScript; Node.js + Express backend, ES modules; PostgreSQL via Neon, Prisma ORM; Clerk for auth (OAuth, invite-gated); Vercel (frontend) + Render free tier (backend, cold-start accepted); Cloudinary free tier for images; no WebSockets (fetch-on-load + POST-to-send for messaging, paired with Web Push/Telegram notifications); no LLM anywhere in the intake/triage flow — deterministic, DB-backed keyword matching only.

## Users

- **Friend (user)** — an invited friend or family member of Gavi's. Submits and tracks requests, chats in-app, sees their credit balance. This is the primary user and the one the intake/request flows are designed for.
- **Gavi (admin)** — the sole operator. Runs the admin cockpit: triages incoming requests, responds, manages users/requests/credits/presence. Effectively both the "business" and its only employee.
- **Guest** (v2/stretch, not yet built) — a non-registered person with a link to a single Gavi-initiated request; one-time chat view tied to their phone number, history attaches if they later sign up.

The job every Friend is doing: they have a real-world problem (a travel disruption, a purchase they can't make themselves, a tech question, "figure this out for me") and want it handled by someone they already trust, without having to explain it over and over across scattered chat threads.

## Product Purpose

Gavi411 digitizes an informal concierge/assistance service Gavi already runs for friends and family — travel rescue, product research, hard-to-find information, middleman purchases, tech setup, general "figure it out for me" requests — currently scattered across WhatsApp, Telegram, calls, and email. The app consolidates all of that into one place: friends submit requests through a conversational intake, track them, and communicate in-app; Gavi manages everything from a dedicated admin interface.

Success is a friend who used to text Gavi at random hours instead getting a proper structured intake, a trackable request, and an in-app thread — without losing any of the informality or trust of how the service already works.

It is also Gavi's fullstack course final project and must demonstrate: React frontend, Node.js backend, a database, API usage, authentication & authorization, unit testing, CI/CD, GitHub, and Jira-managed workflow. The course plan has been presented to and approved by the instructor as-is. Gavi personally writes at least a section of every component type and must be able to explain everything submitted — this shapes process (see Product Principles), not the visual product.

## Positioning

Not a generic support-ticket or helpdesk tool, and explicitly not an AI concierge. The thing a neighboring product (a real helpdesk SaaS, or an AI-chat assistant) couldn't truthfully copy: this app doesn't answer anything itself — a human (Gavi) is on the other end of every request, and the app's only job is structuring the intake and threading the conversation so that relationship doesn't have to live in fragmented chat apps. The trust and informality of an existing real relationship is the product, not a feature added on top of a generic ticketing system.

## Operating Context

- Friends already know and trust Gavi personally before ever opening the app — this isn't a cold support relationship.
- Requests fall into known categories with dedicated follow-up flows: travel rescue, product/purchase research, tech support, and general/research/info requests. Each has its own follow-up fields collected during intake.
- All communication after intake happens in an in-app message thread (text + images), not back on WhatsApp/Telegram — that's the whole point of consolidating.
- Gavi runs the admin side alone — triage, replies, credit/user management, presence status — there is no team.
- Sign-up is invite-gated, not public; a friend must receive an invite link from Gavi to create an account.
- The app is a PWA, not a native app — installed to a home screen, not distributed via app stores.
- Mixed Hebrew/English/numeric text shows up in any freeform field (a friend's request text, a message, an admin note) and must render correctly via bidi-aware text handling — this is a real, live user need (Gavi and his friends/family mix languages), not a hypothetical.

## Capabilities and Constraints

- **No LLM/AI in the intake or triage path.** Category matching against a friend's free-text request is deterministic, DB-backed keyword matching (word-boundary aware) — not a model call. This is a firm product constraint, not a placeholder for a future AI upgrade.
- **No public signup.** Every account originates from an admin-issued invite; the actual enforcement mechanism (app-side token validation vs. Clerk allowlist) is still being finalized (G411-81, in progress) but the invite-gated requirement itself is fixed.
- **No native mobile apps.** PWA only — this is a stated non-goal, not a resourcing gap to fill later.
- **Not a monetized/business product.** A tips link is a plausible v2/stretch idea but is explicitly not revenue-driven and not part of v1.
- **User-facing terminology is still open.** The working internal term for a support request is "request," but this is a placeholder — a dedicated copywriting pass late in development will decide the final user-facing term(s). "Ticket" specifically must never appear in user-facing copy (internal code/variable names may use it freely).
- **All current user-facing copy is placeholder.** Don't polish strings prematurely; a copywriting milestone is scheduled late in development.
- **Presence, not response-time promises.** The product sets expectations honestly via a presence/status indicator rather than committing to SLA-style response times.

## Brand Commitments

- Name: **Gavi411** — the "411" plays on the real-world "call for information" framing of the service.
- Tone: friendly, informal — matches how the real-world concierge service already feels between Gavi and his friends/family. This is a durable commitment, not a style choice to be revisited per-surface.
- UI chrome (buttons, labels, nav) is English-only and LTR; only freeform user/admin text content needs bidi-aware rendering — this split is intentional and confirmed (not a "translate everything later" gap).

## Evidence on Hand

No real customer content, testimonials, case studies, or press exist — this is a pre-launch personal/course project with Gavi as the only real "customer" so far. Future design and copy work must not fabricate testimonials, usage numbers, or third-party endorsements. A design inspiration board (screenshots referenced in DESIGN.md — "Nexus AI," a Hebrew-language concierge chat screenshot, a budget-tracker UI, the Serviqo AI-support kit) exists and is the actual visual-reference evidence already used to establish the current design system.

## Product Principles

1. **No AI stands between a friend and Gavi.** The app structures and routes; it never answers on Gavi's behalf. Any future feature that would let the system resolve a request without Gavi is out of scope, not a natural next step.
2. **Invite-only, always.** Growth is never a public-signup funnel — every user is someone Gavi already knows. Features should assume a small, known, trusted user base, not anonymous scale.
3. **Gavi is the bottleneck by design, not a flaw to engineer around.** The whole product is built around one operator; the admin cockpit should make that one person maximally effective, not simulate a team or queue-routing system that doesn't exist.
4. **Feel like the existing relationship, not a support vendor.** Every user-facing surface should read as continuing a real, informal relationship — never as generic SaaS or corporate helpdesk tone.

## Accessibility & Inclusion

No accessibility requirement beyond standard baseline practice is currently known, other than the bidi/Hebrew text-rendering need already recorded under Operating Context and Brand Commitments (mixed-language freeform text must render correctly). No specific user with an assistive-technology need has been identified.

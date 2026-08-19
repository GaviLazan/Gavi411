# Gavi411 — Product Requirements Document (PRD)
**Version:** 0.2
**Date:** 2026-08-16
**Author:** Gavi Lazan (with Claude)
**Status:** Course plan presented and approved as-is by instructor. DB, auth, ownership model, image storage, credit mechanics, admin cockpit layout, auto-close policy, and MVP priorities all decided. Only user-facing terminology remains open (deferred to copywriting pass, see §9).
 
---
 
## 1. Overview
 
Gavi411 is a web application that digitizes an informal concierge/assistance service Gavi already provides to friends and family — travel rescue, product research, hard-to-find information, middleman purchases, tech setup, and general "figure it out for me" requests. Today this happens across WhatsApp, Telegram, calls, and email. Gavi411 consolidates it into one place: friends submit requests through a conversational intake, track them, and communicate in-app; Gavi manages everything from a dedicated admin interface.
 
The app is also the final project for Gavi's fullstack course and must demonstrate: React frontend, Node.js backend, a database, API usage, authentication & authorization, unit testing, CI/CD, GitHub, and Jira-managed workflow. The course plan has been presented to and approved by the instructor as-is.
 
## 2. Goals
 
**Product goals**
- One consolidated home for requests instead of scattered chats.
- Reduce back-and-forth: intake gathers complete information up front.
- Keep the tone friendly and informal — the app should feel like the service already feels.
- Set expectations honestly (presence status) without promising response times.
**Non-goals**
- Not a business/monetized service (see §6.3 — a tips link is a real v2/stretch candidate, but not revenue-driven and not v1).
- No answer-serving AI — the bot triages; it does not replace Gavi.
- No public signup — invite-gated.
- No native mobile apps — PWA only.
**Course goals**
- Satisfy all course requirements (confirmed met by the approved plan).
- Gavi personally writes at least a section of every type of component; can explain every line submitted.
## 3. Users
 
| Role | Description |
|------|-------------|
| **Friend (user)** | Invited friend/family member. Submits and tracks requests, chats in-app, sees credit balance. |
| **Guest** | Non-registered person with a link to a single Gavi-initiated request. One-time chat view, tied to their phone number; history attaches if they later sign up. *(v2/stretch — see §6.3)* |
| **Gavi (admin)** | Sole operator. Full cockpit: triage, respond, manage users/requests/credits/presence. |
 
## 4. Core Flows
 
### 4.1 Request intake (friend-initiated)
1. Friend taps "new request."
2. Free-text box: "tell me what's going on." Debounced keyword matching (against a DB-backed, admin-editable trigger list) suggests a request type as they type.
3. If one type matches → its follow-up fields appear (except Info/Research, which has none). If multiple types match → multi-select disambiguation chips let the friend pick all that apply.
4. Generic fallback field always present: "anything else I should know? When do you need this by?"
5. Urgency selected (preset options).
6. Request is created, credit deducted, Gavi is notified via Telegram.
- No LLM involved anywhere in this flow — fully deterministic, runs on Gavi's own server. (LLM-based triage was considered and explicitly ruled out for v1: privacy concerns, and a principle of not making a non-critical feature depend on a third-party interface.)
### 4.2 Request intake (Gavi-initiated)
1. From an outside conversation, Gavi pastes chat text/images into a new request in the admin UI.
2. Gets a shareable link:
   - Existing user → notified that a request was opened for them.
   - Guest → link opens a one-time chat view; associated with their phone number for future history merge. *(v2/stretch — see §6.3)*
### 4.3 Messaging model
No real-time chat / WebSockets — the free deployment tier can't sustain persistent connections, and it isn't needed. Instead: a message thread per request (fetch on load, POST to send), paired with notifications (Web Push for friends, Telegram for Gavi) so people know to check back. WhatsApp real-time integration considered and ruled out (official API needs Meta approval + per-message cost; unofficial libraries are ban-risk).
 
### 4.4 Request lifecycle
States: **in queue** (Gavi hasn't seen it) → **received** (seen, not handling yet) → **working on it** → **waiting on friend** (clarification or solution confirmation) → **resolved—pending confirmation** → **closed**. Exit paths: **cancelled** (refund, especially if untouched), **self-solved**.
- Urgent-only action: friend may downgrade to "no longer urgent."
- Closing: Gavi asks "did this resolve it?" → friend confirms → closed.
- Reopening: allowed indefinitely; continuations don't re-triage. Sending a message in a closed request reopens it — this is the reopen mechanism itself, no separate "reopen" button.
- Nudges: manual by Gavi for stale waiting-on-friend requests.
- Auto-close: a request sitting in "waiting on friend" for 14 days of inactivity auto-closes. A warning message is sent to the friend first, notifying them the request will close.
### 4.5 Presence
- Gavi toggles service **online/offline** manually. Offline still accepts requests but clearly signals responses will wait.
- Deliberately no published hours and no response-time promises.
- Automatic Shabbat/Yom Tov detection (via a zmanim API, with configurable buffers, following Gavi's location/timezone) is a **v2/stretch goal** — see §6.3. v1 ships with manual toggle only.
## 5. Messaging Security
 
**Target design (stretch goal):** conversation-scoped, escrowed end-to-end encryption.
- Per-user asymmetric keypair (Web Crypto API), generated client-side on first use. Private key local (IndexedDB); public key on server.
- Each 1:1 conversation derives a shared secret via ECDH; messages (and images) encrypted client-side with AES-GCM before transmission. Server stores/relays ciphertext only.
- Admin search: Gavi is a party to every conversation, so the admin panel derives shared secrets locally and builds a client-side decrypted search index — real search, without server-side plaintext.
- **Recovery, primary path — admin-approved device linking**: a new/unrecognized device logs in via OAuth (identity always works) but has no local key. It requests access; Gavi is notified and approves via the admin panel. Since Gavi is a party to every conversation, Gavi's session already holds decrypted content and re-encrypts/shares it to the new device's public key — server still only ever sees ciphertext. Adding a device is additive; existing devices keep working (standard multi-device model, as in Signal/WhatsApp). Device revocation (for lost/stolen phones) is a later v2 detail.
- **Recovery, last resort — escrow**: for total device loss (no already-approved device left to approve from). Per-user (not shared) escrow passphrase, generated at **invite creation** and embedded in the invite link's URL fragment (never touches the server). Friend's browser uses it at signup to encrypt a backup of their private key, which is what actually gets stored server-side (server never sees the passphrase). Gavi exports a CSV at invite-creation time (title, passphrase, notes — no email/username, since it's not known yet) and imports it into 1Password, then deletes the file. Single-use recovery link with the passphrase in the URL fragment restores access.
- Protects against DB leaks and full server compromise alike (escrow key isn't co-located with the server).
**Fallback (guaranteed v1 if time runs short):** encryption at rest — messages encrypted before DB write, decrypted on read, key in a server env var (Node `crypto`, AES-256-GCM). Protects against DB/backup leaks only; a full server compromise exposes both data and key together. Full server-side search preserved.
 
This feature is explicitly kept in scope, not cut — see decision log. Its implementation is agentic (Claude subagent-built, fully explained to Gavi), given the cryptography is beyond hand-write scope, but Gavi participates directly in the escrow CSV export and device-access-request UI pieces.
 
## 6. Features
 
### 6.1 User-facing
| Feature | Notes | Priority (provisional) |
|---|---|---|
| Invite-link signup + OAuth login | Clerk (decided). Homepage "request access" reviewed case-by-case | Must |
| Structured intake form | Free text + keyword-suggested type (DB-backed, admin-editable triggers) + urgency; disambiguation UI for conflicting matches; no LLM | Must |
| Request list home | Open requests; toggle for closed; if all closed, show most recent closed | Must |
| In-app conversation per request | Full thread incl. images; no bouncing to WhatsApp | Must |
| Image upload | Minimum media requirement | Must |
| Credit balance display | Flat 1 credit/request; period reset; no rollover; one "request anyway" overdraft per period | Must (mechanics may slim) |
| Web Push notifications | "Gavi replied" etc.; iOS requires installed PWA (16.4+) | Must |
| PWA installability | Manifest + service worker; "install on iPhone" help page | Must |
 
*Guest request view and post-close reaction have moved to §6.3 (v2/stretch) — see decision log.*
 
### 6.2 Admin (Gavi)
| Feature | Notes | Priority (provisional) |
|---|---|---|
| Request cockpit | Sort by age/urgency (urgency oldest-first default), filter open/closed, group by person — layout to workshop | Must |
| Status management | Full lifecycle controls | Must |
| In-request chat + images | Same thread as user sees | Must |
| Private notes per request | Visible only to Gavi | Should |
| User management | Invites, approvals, group tags (drive credit tier + sort/filter), credit adjustments | Must (subset) |
| Trigger/keyword admin | Add/edit intake keywords live, no redeploy | Should |
| Telegram notifications | Bot ping on new requests/messages with deep link | Should |
| Presence control (manual) | Online/offline toggle | Must |
| Gavi-initiated requests | Paste content, generate share link | Should |
 
*Auto-Shabbat presence and reminders have moved to §6.3 (v2/stretch) — see decision log.*
 
### 6.3 V2 / Stretch Goals
 
Explicitly in-scope for the product's future, explicitly out of v1. Not cut, not abandoned — deferred based on the 15-day solo-build feasibility check (decisions #31, #42). Nothing here is a "maybe someday" — each has a real spec already drafted above or in the brain doc, ready to build when picked up.
 
| Feature | Notes |
|---|---|
| Auto-Shabbat/Yom Tov presence | Zmanim API (e.g. Hebcal) with configurable buffers before candle-lighting / after havdala, following Gavi's live location/timezone. v1 ships manual toggle only; this layers on top without changing the presence field's shape. |
| Reminders | Time-based, for self or for friend ("check on X at 15:00" / "make sure to X"). Needs a scheduler (cron-style) — the main reason this didn't make v1. |
| Guest request view + history merge | One-time chat link for non-users tied to phone number, with history attaching if they later sign up. |
| Post-close reaction | Lightweight reaction/rating after a request closes (e.g. thumbs-up), giving Gavi quick feedback on how the help went. Previously mislabeled "Won't" in v0.1 — reclassified: Gavi wants this, it's just not a v1 priority. |
| Tips/donation link (Bit/Paybox) | Started as a half-joke, promoted to a real (if low-priority) v2 candidate — being a joke about monetization doesn't mean it's excluded from the spec. Explicitly not a v1 feature and not a pivot toward monetization (see §2 non-goals). |
 
### 6.4 Copywriting pass
All user-facing wording (the "ticket"→"request" replacement, disambiguation prompt phrasing, general tone) is deliberately deferred to a dedicated milestone late in development, since copy is decoupled from logic and can change freely without touching code. Placeholder strings are used until then.
 
### 6.5 Terminology rule
The word "ticket" never appears in user-facing copy. Working user-facing term: **"request"** (better term TBD). Internal code may use standard ticketing vocabulary.
 
## 7. Technical Requirements
 
- **Frontend:** React (Vite), **JavaScript only — no TypeScript** (Gavi doesn't know TS yet; planned to learn it after this project). UI chrome is English-only/LTR; Hebrew can appear in any freeform text field, input or display, on either side of the app (friend-facing request text/messages, or Gavi/admin-facing notes/replies) — those fields need correct bidi text rendering (mixed Hebrew/English/numbers), not page-layout RTL support. Every "build a page/component" task includes a real design pass, not just logic-wiring to endpoints — see Design system below.
- **Design system:** Impeccable (Claude Code design skill). Seeded from Gavi's existing inspo board — specifically the screenshot **image files** within it, viewed directly by Claude Code, not the board's own gallery-shell code (which was never styled to embody the direction itself). Sequence: show Claude Code the reference images → build early Gavi411 components against them → run `/impeccable document` to capture what actually landed into `DESIGN.md`. `PRODUCT.md` is generated interactively via `/impeccable init` once the repo exists, not pre-drafted.
- **Code discipline:** Ponytail (YAGNI/minimal-code plugin) adopted project-wide — least code that works, stdlib/native features preferred over custom code or dependencies, no speculative abstractions. Installed as an actual Claude Code plugin (not a copied skill file, which doesn't reliably self-activate).
- **No LLM in v1 core flow.** Claude API may still appear elsewhere in the project if useful, but triage specifically is LLM-free by decision.
- **Backend:** Node.js + Express. ES modules.
- **Database:** PostgreSQL, via existing Neon account (decided — data is naturally relational: users↔requests↔messages↔credits).
- **Auth:** Clerk (decided). Kept decoupled from Neon rather than consolidating via Supabase, since Neon was already set up and cost is a non-issue at this project's scale across all four candidates evaluated (Clerk/Supabase/Auth0/Firebase). JWT/bcrypt/protected-route patterns may be woven in if course requires.
- **APIs consumed:** Telegram Bot API (admin notifications), Hebcal or similar (zmanim, v2/stretch), Web Push — nice-to-haves, not requirement-driven. **Internal REST API** between front/back is the actual course requirement (confirmed: course has never required external APIs, always REST) — satisfied by construction via the Express routes.
- **Testing:** Vitest, front and back. Built **collaboratively** — Gavi is weak in this area and wants to learn it, not just receive finished output; scaffolds land per-feature as each one ships, not batched at the end.
- **CI/CD:** GitHub Actions. Built **collaboratively**, same reasoning as testing.
- **Project management:** Jira + GitHub, implementing the **Aegis Method** discipline pattern — Parent/Child issue structure, mandatory falsifiers, evidence-bar requirements, adversarial review, closure-against-reality. Full field template defined in `gavi411-jira-aegis-template.md`.
- **Agent-provenance tracking:** Repowise, adopted from day one since multiple Claude subagents (not just Gavi) will be committing code. Per-role commit identity/branch-prefix/trailer convention defined in `gavi411-commit-convention.md`.
- **Deployment:** Vercel (frontend) + Render free tier (backend; cold-start accepted, pre-warm before demos). DB on Neon free tier.
- **Budget:** ~zero. Claude API pay-as-you-go (~$5 covers the project).
## 8. Constraints
 
- ~1 month total. Availability: Sun & Tue evenings (class, 18:00–22:45) + ~1hr a few other days.
- **Ownership split** (decided, per the solo-build feasibility check):
  - **Gavi writes:** backend routes, DB, request/messaging/lifecycle/admin/credits logic, frontend component structure and wiring.
  - **Agentic, fully explained:** design system + styling passes, OAuth wiring, E2E encryption, PWA/service worker config, deploy.
  - **Collaborative:** testing, CI/CD — Gavi is weak in both and wants to learn them, not just receive finished output.
  - **Fallback rule:** if Gavi is falling behind on a task that's currently his, moving it to agentic is an **option he can invoke** — not an automatic trigger.
- Solo developer + Claude agents (PM, coding, design, testing, CI/CD) under Gavi's supervision; Gavi writes a section of every component type and can explain everything submitted.
- Course requirements resolved — plan approved as-is, no longer a live constraint risk.
## 9. Open Questions
 
Resolved since v0.1 (see decisions #45–49 in `gavi411-brain.md`):
1. **Image storage** — Cloudinary (free tier), URL stored in DB.
2. **Credit mechanics** — monthly reset, tiered by group tag: Acquaintance 2/mo, Regular 5/mo, Close 7/mo. No rollover, one overdraft/period.
3. **Auto-close** — "waiting on friend" requests auto-close after 14 days of inactivity, with a warning message sent first. Reopening happens by sending a message in the closed request — no separate reopen button (see §4.4).
4. **Admin cockpit layout** — mobile-first drill-down: list screen (persistent sort/filter/group row, urgency-sorted) → detail screen (Thread/Details/Notes tabs). Full spec in decision #46.
5. **MVP priorities** — finalized in §6 tables above (decision #45); no longer provisional.
Still open:
1. User-facing term to replace "request" (or keep it) — deferred to the copywriting pass (§6.4), doesn't block backlog structure.
## 10. Success Criteria
 
- Course: project accepted, all requirements demonstrably met, Gavi can explain everything.
- Product: at least a handful of real friends onboarded and submitting real requests; Gavi prefers handling a request in-app over WhatsApp.

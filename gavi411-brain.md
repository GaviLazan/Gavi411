# Gavi411 — Project Brain Repository
_Last updated: 2026-08-16_
_Purpose: running knowledge base for planning the fullstack course final project. Will feed into Claude Code later. Not a project plan yet — that comes after planning is done._
 
---
 
## 1. Context & Constraints
 
- **What:** Final project for Gavi's fullstack course.
- **Requirements:** NOT yet received from instructor. Everything below is based on assumptions and must be reconciled once requirements arrive.
- **Requirements:** React frontend, Node.js backend, PostgreSQL (via Neon), API usage (internal OK), authentication via Clerk, unit testing, CI/CD, GitHub, Jira. Course plan presented and approved as-is (decision #37) — no longer pending official confirmation.
- **Timeline:** ~1 month.
- **Availability:**
  - Job keeps Gavi out of the house 12–13 hrs/day.
  - Class Sun & Tue 18:00–22:45 (includes work time).
  - ~1 hour available on a few other days per week.
  - Effectively: 2 semi-long blocks + a few 1-hr slots per week.
- **Learning goal:** Gavi personally writes at least a section of every kind of piece (a component, a route, an API call, etc.). The rest via Claude agents under his supervision. He must be able to explain everything submitted.
- **Existing skills/context:** SheCodes fullstack course background (Express, SQL, MongoDB, Prisma, React, Git). ES modules. Ubuntu VM dev environment exists from a previous project (Node, Express, Mongoose, Prisma, Claude Code CLI + VS Code extension) — considering reusing it for this one. MongoDB Atlas + Neon accounts. Testing: used Vitest in that previous project; learned Node built-in test runner in class; testing knowledge is weak overall, so whichever framework is chosen will require learning it properly.
## 2. The Concept — Gavi411
 
A webapp digitizing the informal concierge/info-booth/assistance service Gavi already provides to friends & family.
 
**Real-world service examples (from Gavi):** setting up internet/cell plans for relatives moving to Israel; last-minute travel rescue (connections at unfamiliar airports, flight updates before gate announcements, kosher food at airports, maximizing bump compensation); vacation activity planning; product research & selection; directions; opening hours; reaching a person at a company; finding elusive ebooks; middleman purchases (embarrassing or geo-unavailable products).
 
**Current channels:** WhatsApp/Telegram mostly, sometimes calls, sometimes email.
 
### Core feature set (draft, unprioritized)
1. **Request submission** — friends submit requests via the app.
2. **Smart intake/triage chatbot** — replaces a static form. Conversationally gathers all needed info before a ticket is created. NOT an answer-serving bot (decided: answer-serving likely expensive + would duplicate what users can already google, risking annoyance). Triage only.
3. **Ticketing system (admin)** — Gavi sees incoming requests, manages tickets, users, statuses.
4. **Credit system** — anti-abuse / demand shaping / AI-cost control (likely MVP, not v1.1):
   - Each user gets X credits per period (week/month TBD).
   - Possibly different amounts per user tier.
   - ~~Max Y open tickets at any time.~~ Superseded — see decision #59.
   - No rollover.
   - Earn-back mechanic DROPPED: the reward for a closed ticket is the solved problem. Framing is fairness among friends, not gamification/incentives.
   - Side benefit: credits naturally cap AI API call volume.
5. **PWA** (Progressive Web App) — installable on phones via Chrome. Native Android acknowledged as out of scope.
6. **Admin experience** — a full interface for Gavi to review tickets, respond, manage users/statuses. Not merely an "admin mode" toggle on the user UI.
7. **Image support** — users must at minimum be able to send images with requests.
8. **Invite-gated signup** — Gavi sends custom individual invite links; homepage has a "request access" flow approved case-by-case.
9. **Gavi-initiated requests** — from an outside conversation (WhatsApp etc.), Gavi pastes the chat/image into a new request and gets a shareable link:
   - Existing user → gets a notification that a request was opened for them.
   - Non-user → link opens a "one-time" guest chat view of that request, associated with their phone number; if they're later invited and sign up, that history attaches to their account.
10. *(More ideas exist, not yet captured.)*
### Request lifecycle (from 2026-08-08 brainstorm)
- **User actions on own request:** cancel (credit refunded, especially if untouched), "solved it myself" close, and — for urgent requests only — downgrade to "no longer urgent."
- **Urgency:** captured during triage, not a separate user toggle. No promises about response speed anywhere (especially nights/Shabbat).
- **States (draft):** in queue → received → working on it → waiting on friend (clarification OR confirming a solution) → resolved-pending-confirmation → closed. Plus cancelled / self-solved exits.
  - Definitions: **queue** = Gavi hasn't seen it. **received** = seen, not yet handling. **working on it** = actively started.
- **Nudges:** manual nudge by Gavi for stale waiting-on-friend requests. Auto-close undecided.
- **Closing:** Gavi initiates "did this resolve it?" → friend confirms → closed. Post-close reaction: nice-to-have, questionable actionability, parked.
- **Reopening:** closed requests are re-openable, no time limit — a continuation of the same issue shouldn't re-triage.
- **Reminders (new idea):** time-based reminders attached to a request — for Gavi ("check on X at 15:00") or set for the friend ("make sure to X"). Some solutions are time-dependent.
### Service presence (online/offline)
- Gavi can set the service "offline": requests still accepted, but it's clearly communicated responses will wait until he's back.
- Triggers: automatic (Shabbat times) or manual (vacation, busy at work, unreliable internet).
- Deliberately NOT official hours — expectation-setting without a schedule.
- (Note: auto-Shabbat is a fun little feature — candle-lighting times via a free API like Hebcal.)
- Auto-Shabbat requirements: configurable buffer before candle-lighting and after havdala; must handle Gavi being in a different timezone/location (times follow where HE is, not a fixed Jerusalem setting).
### Admin cockpit (to workshop further)
- Sort: by age and by urgency (urgency view defaults oldest-first). Filter: open/closed. Group: by person.
- No canned responses needed.
- **Private notes per request** (not per user) — only visible to Gavi.
### User profiles
- Core: photo, full name, phone, email.
- Optional self-service fields: phone OS/model, computer OS, location, other practical info.
- Philosophy: store the info Gavi *can't* remember (device models change), not preferences he already knows (kosher, travel tastes). These are friends, not CRM contacts.
### User group tags (new, 2026-08-09)
- Users get a group "tag" (tier). Purpose: (1) determines credit amount for that user, (2) usable as an admin sort/filter dimension on requests.
- Relationship to existing "tier" idea in credit system (§ credits mechanics) — likely the same concept; reconcile naming later.
### Credits mechanics (firming up)
- Visible to users. Flat cost: 1 credit per request.
- At zero: "request anyway" available, but only once per reset period.
### UX decisions so far
- **Home screen (user):** list of open requests; button to reveal closed ones; if everything is closed, surface the most recent closed request (info may still be relevant). Prominent "new request" button.
- **Terminology:** the word "ticket" must never appear user-facing. Working term: "request." Better term TBD.
- **Conversations:** live fully in-app. The whole point is consolidation — no bouncing back to WhatsApp.
- **Notifications:**
  - Users: Web Push (PWA notifications) — works on Android/desktop; on iOS only for installed PWAs (16.4+).
  - Gavi: Telegram bot pinging on new requests/messages with a deep link into the admin view. (Telegram Bot API is free and simple — a single POST to send a message.) **Telegram is Gavi-only** — many friends don't have Telegram, so it's never used for user-facing notifications, only Gavi's own alerts.
- **Language/RTL:** ~~UI framework must support RTL + Hebrew from day one (layout direction, text alignment).~~ Corrected by decision #22: UI chrome stays English/LTR only; any freeform text field (input or display, friend-facing or Gavi/admin-facing — request text, messages, notes) needs correct bidi text rendering, not page-layout mirroring.
- **Branding:** no mascot. Logo deferred.
- **Tone:** friendly, almost informal — the app should feel like the service already feels.
### Auth direction — DECIDED: OAuth
- OAuth via a hosted provider (Clerk / Supabase Auth / Auth0 / Firebase — provider TBD), invite-only user base.
- WhatsApp OTP dropped (not zero-budget/zero-hassle: official API needs Meta approval + per-message costs; unofficial libs are ban-risk).
- Gavi prefers NOT to hand-roll secure auth. If the course expects JWT/bcrypt/protected routes: he has demonstrated these in other projects, and they may be woven into other features anyway (e.g., protected admin routes).
## Copywriting Pass (dedicated dev milestone — placeholder strings until then)
Purely wording/phrasing items, decoupled from logic — batched into one pass late in dev since strings can change freely without touching code:
- "Ticket" → user-facing replacement term (currently placeholder: "request")
- Disambiguation prompt wording (draft "This sounds like it could be: X · Y. Which fits best?" rejected as not friendly enough)
- General tone pass across all user-facing copy (friendly/informal per brand direction)
## 3. Decisions Log
 
| # | Timestamp | Decision |
|---|-----------|----------|
| 1 | 2026-08-07 ~AM | Chatbot = smart intake/triage, not answer-serving. |
| 2 | 2026-08-07 ~AM | This doc is the running brain; formal project plan docs come after planning phase. |
| 3 | 2026-08-07 ~PM | Auth = OAuth via hosted provider, invite-only. WhatsApp OTP dropped. |
| 4 | 2026-08-07 ~PM | Unit testing framework = Vitest. |
| 5 | 2026-08-07 ~PM | Credit system leans MVP (doubles as AI cost control). |
| 6 | 2026-08-07 ~PM | Credit earn-back mechanic dropped. |
| 7 | 2026-08-07 ~PM | Admin side = full dedicated interface, not an admin-mode toggle. |
| 8 | 2026-08-07 ~PM | App must support image sending (minimum media requirement). |
| 9 | 2026-08-08 | One DB only — split-by-domain rejected. |
| 10 | 2026-08-08 | Deployment: Vercel + Render acceptable; cold start OK IRL, will pre-warm before demo. |
| 11 | 2026-08-08 | Signup: custom individual invite links + homepage "request access" approved case-by-case. |
| 12 | 2026-08-08 | No "ticket" in any user-facing copy — "request" as working term. |
| 13 | 2026-08-08 | Conversations live fully in-app; no bouncing to WhatsApp. |
| 14 | 2026-08-08 | UI must support RTL/Hebrew from the start; content English-only for now. No mascot. |
| 15 | 2026-08-08 | Urgency set at triage; zero speed promises. |
| 16 | 2026-08-08 | Close flow = Gavi asks "resolved?" → friend confirms. |
| 17 | 2026-08-08 | Requests re-openable indefinitely (no re-triage for continuations). |
| 18 | 2026-08-08 | Notes are per-request, not per-user. |
| 19 | 2026-08-08 | Credits: visible, flat 1/request, one "request anyway" overdraft per reset. |
| 20 | 2026-08-08 | Service online/offline presence state (auto-Shabbat or manual), not official hours. |
| 21 | 2026-08-09 | Tech support confirmed as its own request type. |
| 22 | 2026-08-19 | Correction to #14: UI itself stays English/LTR only — no page-layout mirroring, no logical-CSS sweep of app chrome. Hebrew can appear in *any* freeform text field, input or display, on either side of the app — friend-facing (request text, messages) or Gavi/admin-facing (notes, replies) alike; whoever's typing, not just friends. Those fields need correct bidi text rendering (mixed Hebrew/English/numbers in one string — `dir="auto"` or `unicode-bidi: plain-text` scoped to that field), not the whole page. |
| 22 | 2026-08-09 | Intake trigger config is DB-backed and admin-editable (not hardcoded), for live keyword tuning. |
| 23 | 2026-08-09 | Disambiguation UI = multi-select chips. |
| 24 | 2026-08-09 | User group tag added: drives credit tier + admin sort/filter. |
| 25 | 2026-08-09 | Copywriting is a dedicated later dev pass, not decided inline during feature work. |
| 26 | 2026-08-13 | JavaScript only, no TypeScript, project-wide — Gavi will learn TS after this project. |
| 27 | 2026-08-13 | No real-time chat / WebSockets — message thread + notifications instead. WhatsApp real-time integration ruled out. |
| 28 | 2026-08-13 | Messaging security target: escrowed/conversation-scoped E2E (ECDH + AES-GCM), with admin-side client search and off-server key escrow for recovery. Encryption-at-rest is the fallback if time runs short. |
| 29 | 2026-08-13 | Multi-device recovery model: admin-approved device linking is the primary path (Gavi approves new devices live); off-server escrow is the last-resort fallback for total device loss. |
| 30 | 2026-08-13 | Escrow refined: per-user passphrase (not raw key) generated at invite creation, embedded in invite link fragment, exported via CSV for 1Password at invite time. CSV keyed by name only, no email. |
| 31 | 2026-08-16 | Feasibility check (separate chat): full PRD not buildable hand-written solo in the available time/skill level. Hand-write vs. agentic split defined per feature, with a fallback rule — anything falling behind moves to agentic rather than being cut or rushed. |
| 32 | 2026-08-16 | Multi-agent workflow reconciled with the hand-write split: agents run **alongside** Gavi's commits (triggered by them — e.g. test scaffolding, design/styling passes, CI/CD), not as blocking standalone days. OAuth wiring and E2E encryption remain agentic but are not commit-triggered (they're built in parallel/upfront rather than reacting to a commit). |
| 33 | 2026-08-16 | Testing and CI/CD reclassified as **collaborative**, not fully agentic — Gavi is weak in both and wants to learn them, not just receive finished output. Test scaffolds happen per-feature as each one lands, not batched at the end. |
| 34 | 2026-08-16 | Jira issue template for the Aegis Method finalized — Parent/Child field lists, falsifier and evidence-bar fields placed per SPEC.md, plus a `Role` field on children (Falsifier/State/Diagnosis/ADR/Sandbox/Verifier/Policy/Gate/Follow-up) drawn from real issue-train examples in the Aegis deck (NAP, FTC, BADAS cases), and an Owner/Authorship field tying to decision #31's split. See `gavi411-jira-aegis-template.md`. |
| 35 | 2026-08-16 | Commit convention for Repowise agent-provenance tracking finalized: one git identity (email) + branch prefix + commit trailer per agent role (backend/design/test/e2e/cicd), not per session. See `gavi411-commit-convention.md`. |
| 36 | 2026-08-16 | PRODUCT.md (Impeccable) will NOT be pre-drafted in planning chat — it's generated interactively by `/impeccable init` inside Claude Code, which scans the actual codebase and interviews on 2-3 questions. Deferred to a Claude Code task once the repo exists. |
| 37 | 2026-08-16 | Course requirements resolved: Gavi's plan was presented to the instructor and approved as-is. No further reconciliation needed against official requirements. |
| 38 | 2026-08-16 | DB = PostgreSQL (via existing Neon account), not MongoDB — data is naturally relational (users↔requests↔messages↔credits). |
| 39 | 2026-08-16 | OAuth provider = Clerk. At this project's scale, cost is a non-issue across all four candidates (Clerk/Supabase/Auth0/Firebase all comfortably free-tier); decision made on fit instead. Clerk chosen for DX and prebuilt components; kept decoupled from Neon (already set up) rather than migrating to Supabase to consolidate DB+auth. |
| 40 | 2026-08-16 | Ponytail (YAGNI/minimal-code discipline plugin) adopted, settled in a separate chat. Enforces least-code-that-works: stdlib/native features before custom code or dependencies, no speculative abstractions. Install via `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail` — must be the actual plugin install, since copying SKILL.md into a skills folder does NOT reliably self-activate (confirmed zero activation that way; the plugin wires a SessionStart hook the copy method skips). Requires `node` on PATH for its two lifecycle hooks — fails silently, not loudly, if missing, so worth a one-time check. Given multiple subagents will be committing code, verify the hooks are live in every subagent's context after install, not just the first tested — inconsistent activation would show up as inconsistent code style and skew Repowise's per-agent code-health comparisons. |
| 41 | 2026-08-16 | Correction to decision #31's fallback rule: moving a behind-schedule task to agentic is an **option Gavi can invoke**, not an automatic trigger. Earlier wording implied automatic reassignment; that's wrong. |
| 42 | 2026-08-16 | V2/stretch tier established for PRD v1: **auto-Shabbat detection, reminders, guest view + history merge** — cut from v1 during the 15-day solo feasibility check and never reinstated (unlike Telegram, Web Push, group tags, and E2E, which were explicitly reinstated). **Post-close reaction** reclassified from "Won't" to v2/stretch — Gavi wants this feature, just not in v1; "Won't" wording was misleading. **Tips/donation link (Bit/Paybox)** promoted from a parked half-joke to an explicit v2/stretch candidate — being a joke about monetization doesn't mean it's excluded from the spec, just that it's not a v1 priority. |
| 43 | 2026-08-16 | Dev environment: working entirely in the Ubuntu VM (not split with Windows) — avoids case-sensitivity mismatches with the Linux deploy target (Render) and keeps git identity/tooling config in one place. VS Code can remote into the VM, so no editor experience is lost. |
| 44 | 2026-08-16 | Jira structure: repurpose existing issue types rather than creating custom ones — **Epic → Parent, Task → Child** (no Subtask usage — Aegis children don't nest). The five Aegis states (Open/Implementing/Reviewing/Landed/Reconciled) become the **workflow/status** field, not a custom field — gives the trail for free via Jira's activity log and maps directly onto Kanban board columns. Confirmed working in a **Kanban-style project** (no Scrum/sprint dependency) — fits the flat, freely-reorderable backlog approach already in use. Remaining custom fields to add: Claim, Scope, Assumptions ledger, Falsifier, Evidence required to close, Evidence bar met, Owner/Authorship, Role (children only), Reviewer type. |
| 45 | 2026-08-16 | PRD §9.6 MVP priorities finalized (were "provisional"): **Web Push, PWA installability, User management, Presence control (manual)** move to Must. **Private notes** and **Trigger/keyword admin** stay Should (low priority). **Telegram notifications** stays Should — deprioritized behind Web Push; acceptable to wait if Web Push alone covers notification needs. **Gavi-initiated requests** stays Should. |
| 46 | 2026-08-16 | PRD §9.4 Admin cockpit layout finalized (mobile-first drill-down pattern, not side-by-side): **Screen 1 (list)** — sort/filter/group as a persistent dropdown row at top (not tucked behind a toggle), flat list below sorted by urgency oldest-first by default, each row showing a small WhatsApp-style avatar (initials fallback if no photo), friend's name, request type, short preview, urgency indicator, time since last activity. **Screen 2 (detail)** — header with name/type/status/urgency + back button, segmented tabs for Thread / Details (intake answers) / Notes (private), status-change control pinned near top. |
| 47 | 2026-08-16 | PRD §9.1 Image storage: Cloudinary (free tier), not DB storage — DB just stores the URL. Free tier: 25 credits/month pooled across storage/bandwidth/transformations (1 credit = 1GB storage OR 1GB bandwidth OR 1K transformations), 3 users, no video/advanced-AI on free, soft limit (account suspension risk on sustained overage, not automatic billing). Comfortably sufficient at Gavi411's friends-and-family scale. Also fits the E2E encryption plan better than DB storage, since images already need an "encrypt before upload" step. |
| 48 | 2026-08-16 | PRD §9.2 Credit mechanics finalized: **monthly** reset, **tiered** amounts by group tag (not flat) — Acquaintance: 2/month, Regular: 5/month, Close: 7/month. No rollover, one "request anyway" overdraft per reset period regardless of tier (unchanged from earlier decision #19). |
| 49 | 2026-08-16 | PRD §9.3 Auto-close finalized: a request sitting in **"waiting on friend" for 14 days of inactivity auto-closes**. Before closing, a warning message is sent to the friend notifying them the request will close. Reopening still works per decision #17 (indefinite, no re-triage) — auto-close is a tidiness measure, not a hard end state. **Sending a message in a closed request reopens it** — this is the reopen mechanism itself, not a separate button. |
| 50 | 2026-08-16 | Aegis child-issue authoring rule: Claim, Falsifier, and Evidence bar fields are **not** pre-drafted in bulk during backlog creation — they're written at pickup time, when a child is actually about to move to Implementing, so they reflect real system state (SPEC §5.1 Move 1) rather than speculation against a codebase that doesn't exist yet. Children can be created in Jira with Scope/Role/Owner filled and Claim/Falsifier/Evidence left blank until pickup. |
| 51 | 2026-08-17 | ORM finalized: **Prisma**, on top of the already-decided PostgreSQL/Neon. Fits the relational shape of users↔requests↔messages↔credits and matches Gavi's existing SheCodes/prior-project experience with Prisma. Added to CLAUDE.md's Tech stack list, which had Node/Express/Postgres/Neon settled but hadn't named an ORM explicitly. |
| 52 | 2026-08-17 | **Comment-stub scaffolds for `[You]` tasks** (from an earlier session, not yet written into CLAUDE.md until now): for any task Gavi is writing himself, Claude Code can produce a file with the structure stubbed out as comments (e.g. `// OAuth middleware goes here`, `// connect to DB`, `// GET request - data from DB`) so Gavi fills in the real logic rather than starting from a blank file. Produced **per-task, on request, right when Gavi is about to start that task** — not pre-generated in bulk across the backlog. Applies to **both backend and frontend** `[You]` tasks (not backend-only — frontend component structure/wiring is `[You]` too, per decision #31, and was missing this same courtesy). Because Gavi writes all the real content, the resulting commit is entirely his — **no agent role/identity/worktree involved**, commits under `git-as-gavi` like any other manual work. Distinct from the OAuth-wiring scaffold mentioned in decision #32/47 context, which is genuinely agentic (OAuth wiring itself is `[Agentic]`) — comment-stub scaffolds are a plain authoring aid for `[You]` work, not agent-authored code. |
| 53 | 2026-08-17 | Clerk configured on the **dev instance** (prod instance deferred — Clerk supports adding one later without redoing the dev setup). Sign-in methods: **Google + email/username**. **Phone sign-in dropped** — not available on Clerk's free Hobby plan at all (requires the $25/mo Pro plan, plus $0.01/SMS), and Google+email already cover the friends-and-family user base; not worth a recurring cost for a course project. Phone number will still be **collected as a plain contact-info field** in the app's own `users` table (G411-10) — that's a DB column, not a Clerk auth method, so it costs nothing. **Organizations/multi-tenancy left off** — that's a B2B feature (separate companies/teams each getting isolated orgs); Gavi411 has one admin serving individual friends/family, no multi-tenant concept, so it doesn't apply. Invite-only mode enabled, matching the product's invite-gated model. |
| 54 | 2026-08-17 | **Neon Auth explicitly rejected** in favor of Clerk (already decided/keyed up). Neon Auth syncs Stack Auth-managed users directly into Postgres rows, which is convenient, but is younger/less battle-tested than Clerk, ties auth to the Neon/Postgres choice (Clerk stays DB-agnostic), and has thinner OAuth-provider polish. Enabling both would create two competing systems both claiming ownership of "who is this user" — Neon is used for **Postgres only**. |
| 55 | 2026-08-21 | **`Request.typeDetails` schema + strip-on-save** (G411-23 pickup): TravelFields/PurchaseFields/TechSupportFields (G411-65) collect structured per-type data (dates, budget, device, flight arrays...) that `Request` had no column for. Decided a single `typeDetails Json?` column over per-type relational tables — shape varies per type, Postgres/Prisma JSON handles that natively without a migration per field change; a separate-table approach would be fully relational but with 3x the migration ceremony for no admin-UI benefit at this scale. Compared against "save everything, filter at display time" across clutter/storage/editability/security/debuggability angles — decisive factor was **multiple future consumers** (G411-38's admin detail screen won't be the only reader; an admin API, a CSV export, or Gavi querying the DB directly could each independently need to reimplement "is this empty"). Decision: strip empty/blank values out of `typeDetails` at save time (G411-23's submit handler), so the column only ever holds keys the friend actually filled in — one write-time cleanup beats N read-time filters. Rendering with human-readable labels (reusing the label strings already in each Fields component) is G411-38's job, not this ticket's — G411-23 only owns correct, clean persistence. _(Note: this decision was first written 2026-08-21 but lost to an uncommitted-changes wipe during a same-session `git reset --hard` fix for an unrelated branching slip; re-added 2026-08-23 once the loss was noticed — same underlying lesson as decision #57's git-hygiene note below.)_ |
| 56 | 2026-08-23 | **User profile phone number: first-login gate, not a placeholder-forever pattern.** `requireAuth`'s auto-created `User` row used `phoneNumber: claims.phoneNumber ?? \`pending-${userId}\`` as a stopgap, with nothing ever built to replace it — surfaced by the 2026-08-23 gap analysis (finding C5). The analysis's own suggested justification ("needed before Telegram notifications can rely on real contact data") was **wrong and explicitly corrected by Gavi**: Telegram notifications (G411-50/51) go to Gavi, the admin, not to friends — a friend's phone number is irrelevant to that flow. The actual reason this matters: decision #53 already committed to collecting phone number as a plain app-side field (since Clerk's phone sign-in was dropped for cost reasons), and that commitment was never followed through with an actual UI. Gavi's correction: there should be **no placeholder at all** — collect phone number (and other PRD §3 core profile fields) as part of first-login, before a friend can do anything else in the app, not as a someday-editable settings screen retrofitted around a fake value. Filed as G411-69. |
| 57 | 2026-08-23 | **Reconciled requires the FULL current scope to be landed, not just its original piece** — surfaced when G411-23 (originally just the backend creation endpoint) had `handleSubmit`'s frontend wiring folded into its scope mid-session, and that folded-in work landed on a separate, still-unmerged PR (#4). Gavi caught, live, that Reconciled was about to be confirmed while part of the ticket's own current scope wasn't actually merged yet — correctly blocking it. Fix applied: Jira status corrected Landed → Reviewing (the closest of the 5 workflow states to "blocked on an external PR review," since no dedicated status for that exists) rather than leaving it at a stale "Landed" that implied more was done than actually was. General lesson: when a ticket's scope grows after it first reaches Landed, re-verify what's *actually* merged before treating any later status (Reconciled, or even Landed again) as still accurate — a Landed reached under an earlier, narrower scope doesn't automatically cover scope added afterward. |
| 58 | 2026-08-23 | **Group tag tier name is "Limited," not "Acquaintance."** Decision #48 and PRD §9.2 wrote the third tier as "Acquaintance" — the 2026-08-23 gap analysis (finding C6) flagged this as a mismatch against `schema.prisma`'s `GroupTag` enum (`CLOSE / REGULAR / LIMITED`) and recommended renaming the enum to match. **Gavi corrected this the other way**: the schema was right, decision #48/PRD §9.2 were the stale ones — "Limited" is the actual tier name. PRD §9.2 fixed to read Limited/Regular/Close; no schema change made. Numbers unchanged (2/5/7 per month). |
| 59 | 2026-08-23 | **"Max Y open tickets at any time" (§2 original brainstorm, per-user cap alongside per-user credits) is dropped, not just unfinalized.** Flagged by the 2026-08-23 gap analysis (finding F4) as a concept-section idea that never made it into PRD §6.1's finalized credit table or any Jira ticket, with no explicit decision recorded either way. Gavi confirmed directly: no such limit was ever actually set (the bullet's own placeholder "Y" — never assigned a number, unlike the credit amounts finalized in decision #48 — reflects that it was never a real commitment). Closed as a non-issue: the credit-per-request cost is the sole volume-limiting mechanic going forward, no separate open-tickets cap. §2's original bullet struck through, pointing here. |
| 60 | 2026-08-23 | **Shift back to an agentic-first workflow**, now that the full gap-analysis followup (all 31 findings in `gavi411-gap-analysis.md`/`gavi411-gap-analysis-followup.md`) is resolved — this was the explicit gate Gavi set before starting this shift. Shape: multiple agents working in parallel on more of the backlog, rather than the mostly `[You]`/`[Collab]` pace this session ran at. Two guardrails Gavi wants kept, non-negotiable: (1) **major decisions still come to him before being acted on** — an agent doesn't get to resolve scope/ownership/design tradeoffs unilaterally, same spirit as the existing `[Agentic]` rule ("build fully, but explain fully as you go"); (2) **each completed chunk gets a clear, documented rundown of what was done and how it works — not just a diff** — Gavi wants to actually understand what shipped, not just see a merged PR (matches CLAUDE.md's course constraint that he must be able to explain everything submitted). Mechanics not yet defined — which agents/roles, which tickets move first, how "major decision" gets drawn in practice day to day — to be worked out as this actually starts, not decided in the abstract here. |
| 61 | 2026-08-23 | **GitHub branch protection's "1 approval required" doesn't count an approval from a read-only collaborator** — surfaced live on PR #4. Matan (added read-only per decision-era collaborator policy — review/comment, no push) left two real review comments, both got fixed, then he came back with an explicit `APPROVE THANKS!` comment plus two actual `APPROVED` reviews — but `reviewDecision` stayed `REVIEW_REQUIRED` and the PR stayed `BLOCKED`. Root cause: GitHub's branch protection only honors approvals from collaborators with **write** access, regardless of whether a lower-access user can technically submit an "Approve" review through the UI/API. **Fix**: upgraded both Matan and eldaduz (Gavi's other read-only reviewer) to write access — Matan's took effect immediately (already-accepted collaborator), eldaduz's was applied to his still-pending invitation (`permissions: push` on the invite itself, takes effect once he accepts). Once Matan's *existing* approval was retroactively counted under his new access level, `reviewDecision` flipped to `APPROVED` immediately — no new review needed. **General lesson**: a "review-only, no push" role on this repo needs write access anyway if their approval is meant to satisfy branch protection; read-only is only a real option if approvals aren't required, or if Gavi (as admin, exempt from the rule) is the one merging regardless of their review. |
 
## 4. Open Questions
 
- User-facing term to replace "ticket"/"request" — brainstorm later.
- Notification stack: Web Push for users (+ iOS caveats), Telegram bot for Gavi — confirm in planning.
- Chatbot: LLM-powered (Claude API pay-as-you-go) vs rule-based semi-smart triage vs hybrid. See §7 cost notes.
- PWA: in MVP or stretch goal? (Very low effort — see §7.)
- Image handling: storage approach (DB vs object storage e.g. Cloudinary free tier) — for planning phase.
- Jira + GitHub workflow structure — Parent/Child template now defined (see §3 #34); Jira project itself not yet created.
- What "CI/CD" needs to mean for this project — now reclassified as collaborative (decision #33); Gavi still needs the conceptual explainer during that work.
- PRODUCT.md (Impeccable) — confirmed staying deferred to `/impeccable init` inside Claude Code once repo exists (decision #36). No PRODUCT.md draft exists or should exist from this planning chat — any earlier kickoff-doc instruction to pre-draft it is superseded.
## 5. Parking Lot (ideas mentioned, not yet explored)
 
- Gavi has more feature ideas not yet written out.
- User tiers.
## 6. Reference Notes (from planning discussions)
 
### Real-time chat vs. message thread (2026-08-13)
- Teacher raised "real-time chat" as something to scope carefully.
- DECIDED: not a real-time system (no WebSockets) — free Render tier can't hold persistent connections well (same spin-down issue as elsewhere), and it's not needed.
- What's actually built: a message thread per request — fetch on load, POST to send, notifications (Web Push for friends, Telegram for Gavi) tell people to come check. This satisfies "I respond, they reply" without real-time infrastructure. Frame this explicitly to the teacher as the scope boundary.
- WhatsApp integration for real-time: ruled out — same reasoning as WhatsApp OTP earlier (official API needs Meta approval + per-message cost; unofficial libs are ban-risk). Not pursuing.
### Message encryption (2026-08-13) — DECIDED: conversation-scoped E2E, admin-side client search, off-server escrow
- Target design (stretch, agentically implemented; Gavi needs to understand/explain it, not hand-write it):
  - Each user (friends + Gavi) generates an asymmetric keypair client-side via the browser's Web Crypto API on first use. Private key stays in the browser (IndexedDB); public key stored openly on the server.
  - Each 1:1 conversation (always exactly friend + Gavi — no group-chat complexity) derives a shared secret via **ECDH** from the two parties' keys. Messages encrypted client-side with **AES-GCM** using that secret before ever reaching the server. Images get the same treatment (encrypt before upload, decrypt on display).
  - Server stores/relays ciphertext only — genuinely unreadable to it. Protects against DB leaks/backups AND full server compromise (unlike encryption-at-rest, where a full server compromise exposes the key too).
  - **Admin-side search solved**: Gavi is a legitimate party to every conversation (always one of the two keys). The admin panel can derive shared secrets for all conversations and build a local, client-side decrypted index to search — same trick WhatsApp uses for "search all my chats" despite E2E. This is NOT server-side search and doesn't compromise the server's blindness.
  - **Key-loss problem (friend wipes browser data) solved via escrow**: per-user escrow (not one shared key — a shared key would mean one leak exposes everyone; per-user contains a leak to one person). Design detail: what's escrowed is NOT the raw private key — it's an encrypted backup of it. Flow:
    1. Gavi creates an invite (existing case-by-case flow) → admin panel generates a random escrow passphrase at that moment, before the friend does anything.
    2. Passphrase embedded in the invite link's URL **fragment** (`#escrow=...`) — never sent to the server, same trick as recovery links.
    3. Gavi exports the passphrase to a CSV immediately at invite-creation time (see export feature below) — doesn't depend on friend completing signup.
    4. Friend clicks invite, signs up. Browser generates real keypair, reads the passphrase from the link fragment, uses it locally to encrypt a backup of the private key, uploads only that ENCRYPTED BLOB to the server (unreadable without the passphrase), then discards the passphrase — friend never needs to know it exists.
    5. Server stores the encrypted blob freely (safe — useless without the passphrase). Gavi holds the only usable copy of the passphrase, off-server, in 1Password.
  - **Escrow export feature**: on invite creation, a CSV download for 1Password import — columns `title, username, password, notes` (1Password-friendly, manually mappable): title = "Gavi411 escrow — <friend's name>", username = left blank (no email — invites aren't tied to a pre-known signup email, so name is the only reliable identifier at invite time), password = the escrow passphrase, notes = generation date + "Gavi411 recovery key — do not share." Gavi deletes the CSV from Downloads after import (Downloads not cloud-synced, confirmed low risk).
  - Threat model: this is technically "escrowed/recoverable E2E," not pure E2E (since Gavi can restore any user's key) — but that's correct and intended given Gavi is meant to see all messages by design. The critical detail making it worth building over plain encryption-at-rest: the escrow key must live OFF the server. If it lived server-side, a full server breach would expose everything, collapsing this back to equivalent-to-EaR.
  - Comparison locked in:
    - **Encryption-at-rest (fallback)**: simple (encrypt/decrypt column with a server-side key via Node's `crypto`), full server search, but a full server compromise exposes everything (server holds data + key together).
    - **Escrowed E2E (target)**: DB-only leak AND full server compromise both stay protected (attacker would need to separately compromise Gavi's password manager); full admin search preserved via legitimate client-side decryption; friend data-loss solved via off-server recovery link. Cost: meaningfully more moving parts (keypairs, ECDH, escrow flow, recovery mechanism, local search index) than EaR.
  - Plan: attempt escrowed E2E once the core app works; encryption-at-rest is the guaranteed v1 fallback if time runs out.
### Multi-device model (2026-08-13, refinement of E2E design)
- New device (or new browser/PWA context) has no local key — this is expected, not broken. Login (OAuth) always works regardless; it's identity/access/the public-key registry, separate from per-device message-decryption ability.
- **Primary recovery path: admin-approved device linking.** Friend opens Gavi411 on a new device, logs in, sees "request access to your message history." Gavi gets notified, approves via admin panel. Gavi's admin session already holds decrypted content for that conversation (Gavi is a party to it) and re-encrypts/shares what's needed to the new device's public key. Server only ever relays ciphertext. Modeled on WhatsApp's QR device-linking handshake, adapted since Gavi (not another user device) is the one who can approve.
- **Escrow (see above) = last resort**, for when there's no already-approved device left at all (e.g. lost every device) — no live device to approve from, so the off-server recovery-key/link flow is the only remaining path.
- Adding a device is additive, not a swap — old devices keep working; multi-device is normal (same model as Signal/WhatsApp).
- Future (v2-of-v2, not urgent): explicit device revocation for lost/stolen phones — removes that device's key from receiving future messages. Doesn't undo past decryption on that device.
### Claude API cost reality
- The API is pay-as-you-go and separate from claude.ai subscriptions — no Pro plan needed. You add a small amount (e.g., $5) to a Claude Platform account and it lasts.
- A triage conversation (short, bounded, using a small model like Haiku) costs fractions of a cent. Dozens of friend-tickets/month ≈ well under a dollar.
- Real risk isn't cost per call, it's unbounded usage — mitigated by credits, invite-only user base, and message caps per triage session.
### Intake v1 design (2026-08-08/09, refined)
- **Free-text box** always present: "tell me what's going on."
- **Debounced keyword matching** (wait ~400ms after typing pauses, then check) against a trigger list stored in the DB (not hardcoded) — editable live from an admin screen, no redeploy needed to tune keywords.
- **Matched type(s)** reveal relevant follow-up fields. Multiple matches → disambiguation UI: multi-select chips (DECIDED, 2026-08-09 — supersedes earlier single-select-plus-"both apply" idea; submit-click on mobile judged acceptable). Wording is a copywriting-pass item (see below), not decided now.
- **Info/Research type has no follow-up fields** — free text + the generic fallback question is enough for that category (lighter-weight than other types).
- **Generic fallback field** always shown regardless of match: "anything else I should know, when do you need this by."
- **Starter keyword taxonomy (draft, to refine from real submissions):**
  - Travel: flight, airport, layover, connection, gate, boarding, terminal, trip, vacation, hotel, itinerary, visa, luggage, baggage, delayed, cancelled flight, rebook, compensation, bumped
  - Tech support: phone, sim, sim card, plan, cellular, wifi, wi-fi, internet, router, setup, set up, laptop, computer, app, account, login, password, sync, connect, device, upgrade, update, install
  - Purchase/Find: buy, find, order, purchase, ship, shipping, available, unavailable, ebook, epub, pdf, book, product, price, deal, discount, out of stock, import
  - Info/Research: where, how, hours, open, closed, address, directions, reach, contact, phone number, recommend, recommendation, review, kosher, nearby
  - Overlap between lists (e.g. "find" in Purchase, "phone" in Tech support) is intentional — resolved by the disambiguation UI, not by over-engineering the lists.
- Tech support confirmed as its own category (previously undiscussed until now — a real gap in earlier planning, since several of Gavi's real examples are tech support).
### Triage approach — DECIDED (2026-08-08, revised): simple form, no LLM
- LLM ruled OUT for v1. Reasoning: privacy concerns, and a deliberate principle — don't make a non-critical feature depend on a third-party interface to function.
- v1 intake: a free-text box + preset checkboxes (request type, urgency, possibly other fields TBD). Fully deterministic, runs entirely on Gavi's own server, no external calls, no data leaves the infrastructure.
- History: earlier direction was LLM-first conversational triage (rejected decision-tree for forcing categories); then local-LLM was considered (rejected — still an always-on third-party-interface-shaped dependency, plus deployment/always-on problems); landed on simple form as the version that actually satisfies both "no forced rigid categories" (checkboxes aren't rigid branching, no adaptive dead-ends) and "no non-critical third-party dependency."
- Open: exact checkbox taxonomy (request type options, urgency scale) — TBD.
- Claude API may still be used elsewhere in the app (this decision is about triage specifically, not a ban on all AI usage in the project).
### PWA (Progressive Web App)
- PWA = a website that Chrome/Android can "install": home-screen icon, own window, optional offline support.
- Minimum requirements: HTTPS + a manifest.json (name, icons, colors) + a service worker (can be near-empty). With Vite there's a plugin (vite-plugin-pwa) that generates most of it.
- Effort: hours, not days. Safe to consider MVP-cheap.
- **iOS:** PWAs DO work — installed via Safari's Share → "Add to Home Screen" (not Chrome; Chrome on iOS can't install PWAs). Once installed they run standalone (own icon, no browser chrome). Limitations vs Android: install flow is manual and non-obvious (no install prompt), and some capabilities are more restricted. Push notifications work on iOS only for installed PWAs (iOS 16.4+). Good enough for a friends-audience app; may want a small "how to install on iPhone" instruction page.
### DB choice notes
- Using BOTH DBs adds real complexity (two connections, two data layers, two things to break) for little benefit at this scale — not recommended.
- "Users switch between open and old requests" is not a DB-choice factor — it's a status field + a query filter in either DB.
- The actual decision drivers: relational shape of the data (users ↔ tickets ↔ messages ↔ credits is naturally relational → Postgres/Prisma), vs. flexible message/chat documents (→ Mongo). Both workable; decision deferred to planning phase.
- Split-by-domain (Mongo for chat, SQL for the rest) discussed: technically valid pattern at scale, but at this scale it's a waste — chat messages are perfectly served by a relational `messages` table (id, ticket_id, sender, body, image_url, timestamp), and the split costs two connections, two ORMs/clients, two backup stories, and cross-DB queries (e.g., "ticket + its messages") become application-level joins. Recommendation: one DB. (Counter-consideration: using both could demo more skills for the course — depends on requirements.)
### Deployment notes
- Gavi's existing pattern: Vercel (frontend) + Render free tier (backend). Pattern is fine and familiar.
- Render free tier caveat: services spin down after ~15 min idle → first request takes ~30–60s cold start. Annoying for a "concierge" app where friends expect responsiveness; also embarrassing in a live course demo.
- Options: cron-style ping to keep Render warm (common workaround), Railway/Fly.io free alternatives, or paid-tier Render (~$7/mo) for the demo month. Also check whether the course mandates a deployment target.
- DB hosting: MongoDB Atlas or Neon (Postgres) free tiers — accounts already exist.
### Fullstack build feasibility & ownership split (2026-08-16)
- Separate "Feasibility of manual project implementation" chat established: against the full PRD, Gavi hand-writing "most" of the code in the available time (15 days × ~3.5-4hrs, later revised upward) is not realistic — the scope needs to shrink, not just his involvement.
- Real hour-costed backlog built (not day-slotted — day-slotting produced artificially sparse/full days once actual per-task hours were estimated). Kanban/sprint-friendly: a flat task list with hour estimates, freely reorderable except along the dependency spine (DB schema → Express skeleton → Auth → Request model, everything else branches off that).
- Ownership split (decision #31): **You** write logic/structure — backend routes, DB, request/messaging/lifecycle/admin/credits logic, frontend component structure and wiring. **Agentic, fully explained**: design system + styling passes (based on Gavi's existing inspo board, not Tailwind — Gavi doesn't know Tailwind), OAuth wiring, E2E encryption, PWA/service worker config, CI/CD, deploy. **Collaborative**: test scaffolds, built per-feature as each one lands (Gavi wants to learn testing and CI/CD, not just receive them finished).
- Frontend design/component styling was an initially missed scope gap — full PRD requires designing and building every page/component, not just wiring logic to endpoints. Resolved via a one-time agentic "design system foundation" (base component styles, typography, tokens, derived from Gavi's inspo board) after which each UI task splits into structure (Gavi writes) + styling (agentic applies design system).
- React frontend setup and PWA manifest/service worker were also initially missed as their own line items (nothing currently exists — no frontend, no backend) — now explicit tasks.
- Fallback rule (decision #31, corrected by #41): if Gavi is falling behind on a task that's currently his, moving it to agentic is an option he can invoke — not an automatic trigger. This is the live adjustment mechanism instead of trying to perfectly predict the schedule up front.
- Agentic-built pieces Gavi wants to personally rebuild/study post-deadline (design system passes, OAuth wiring, E2E core, PWA/service worker config, deploy) are tracked separately in `gavi411-post-deadline-learning-backlog.md` — not a PRD item, not a decision, just a running reference for future-you.
- Full real-hour backlog (~82.5hrs total: ~47hrs Gavi build + ~9.5hrs collaborative + ~26hrs agentic) exceeds a naive "15 days × 4hrs" (60hrs) estimate by ~22hrs — explicitly surfaced as a real gap, not glossed over. Decision: proceed with the plan as scoped and apply the fallback rule live rather than pre-cutting further.
### Multi-agent workflow reconciliation (2026-08-16)
- The ownership split above was reconciled against an earlier, separately-planned multi-agent setup (Aegis Method + Repowise + Impeccable, from the "Multi-agent Claude project with frameworks" chat) — confirmed these are not in tension.
- "Agentic" work in the ownership split is actually **multiple subagents** committing code, with Repowise tracking agent provenance from git history and Aegis-style discipline (falsifiers, evidence bar, adversarial review, closure-against-reality) governing how that work gets closed out — not just "Claude does it and explains it."
- Commit-triggered agents (react to Gavi's commits): test scaffolding, CI/CD, design/styling passes (agent picks up a commit of plain structure and applies the design system to it).
- NOT commit-triggered, run in parallel/upfront instead: OAuth wiring (scaffolding Gavi builds against, not a reaction to his code), E2E encryption core (keypairs/ECDH/AES-GCM is a parallel subsystem that later integrates with messaging once that's committed, not triggered by any single commit).
- Two of the three deliverables originally requested from this reconciliation (Jira issue template, commit convention) are now built — see decisions #34–35 and the standalone files. The third (PRODUCT.md) is not a planning-chat deliverable at all — see decision #36.
### Design system setup — how the inspo board actually feeds Impeccable (2026-08-16)
- Impeccable does not ingest an external site or "point at" a reference. It only reads two files it expects in the project root: `PRODUCT.md` (strategy, written interactively via `/impeccable init`) and `DESIGN.md` (visual system — colors, type, components, radii), the latter generated by `/impeccable document`, which scans the **actual Gavi411 codebase** — existing tokens, components, rendered output — not any external reference.
- The inspo board (a separate site Claude Code built earlier to hold reference screenshots) does **not** transmit design direction through its own code. Its CSS/markup is just the gallery shell built to display references — it was never styled to embody the direction itself, so pointing Claude Code at that site's own styling is a dead end (corrects an earlier wrong suggestion in this chat).
- What actually carries the direction: the **screenshot image files themselves**, wherever they live on disk inside that project (e.g. an assets/images folder). Claude Code can view these directly as images, same as a fresh upload.
- Correct sequence: (1) point Claude Code at the inspo board's actual image files, or re-upload the specific screenshots directly into the session; (2) Claude Code builds Gavi411's first real components informed by those images; (3) once real styled code exists, run `/impeccable document` to scan *that* into `DESIGN.md`. Impeccable only ever sees code that already exists in the project — the inspo board influences the code first, Impeccable reads the code second, never the board directly.
- Practical implication for the design-system-foundation setup task: don't run `/impeccable document` first. Show the screenshots, build a couple of components/pages against them, then document.
### "Wrap it up" codeword — from prose to enforced checklist (2026-08-19)
- Originally a paragraph in `CLAUDE.md`: scope check, falsifier, Aegis fields, commit, done. No enforced order, no forcing function.
- Real failure observed: G411-11's Jira ticket sat at Open across multiple sessions even after "wrap it up" was said twice. The habitual, doc-adjacent steps (commit, HANDOFF.md) ran every time; the step requiring a separate tool call to a different system (the Jira status transition) silently didn't — and nothing surfaced that gap until it was noticed independently, days later.
- Root cause: a multi-system side effect (git + docs + Jira) driven by one prose instruction with no self-check. Aegis's Falsifier/Evidence fields gate *content* quality (is the claim true, is it proven) — they don't gate *execution* (did every step of closing actually happen). Two different jobs; conflating them was the mistake.
- Fix: `CLAUDE.md`'s "Wrap it up" section rewritten as an 8-step checklist (scope → falsifier → Aegis fields → evidence bar → Jira transition → commit → HANDOFF.md → report back), where the final step is a mandatory itemized ✓/✗ report, not a prose summary — so a skipped step is visible in the same turn instead of discovered later.
- Scope of the fix: this makes skips *loud*, not *impossible*. There's still no hook, CI check, or enforcement layer — it's still a human saying the codeword and a model correctly executing every step. True enforcement (e.g. a git pre-push hook or CI gate keyed to Jira status) was discussed and explicitly deferred — out of scope for what CLAUDE.md prose can do, and not worth building for a solo 1-month course project right now.

### Aegis "Landed" state — spec read directly, workflow corrected (2026-08-19)
- `Aegis-spec.md` was cited throughout the project as the primary source for the Aegis Method but had never actually been opened/read start-to-end before this session — everything relied on the derived template and secondhand summary instead.
- Reading it directly (§4.1) resolved a real confusion: Jira's workflow is **five** states, not four — Open → Implementing → Reviewing → **Landed** → Reconciled. Landed = merged/live (code shipped, real running state) but acceptance criteria not yet re-validated against it. Reconciled = acceptance formally re-checked against landed state (§5.5, "Closure Against Reality") — the true terminal "Done."
- The live Jira workflow had a `Landed` column with 0 issues and no transitions routing into it — not stray board config (my first wrong guess), and not something to delete (my second wrong instinct, before actually reading the spec). It was the workflow being incomplete relative to the spec it's supposed to implement.
- Fixed: named transitions added and published (Open→Implementing, Implementing→Reviewing, Reviewing→Landed, Landed→Reconciled) plus a global "Any→" reopen transition on all five statuses including Landed. Confirmed live via the Jira transitions API.
- `CLAUDE.md`'s Jira section and the wrap-it-up checklist's Jira-transition step both updated to name the real five states and the two separate closing transitions (→Landed, then →Landed→Reconciled) instead of collapsing them into one.
### New `agent-frontend` role (2026-08-19)
- G411-15 (PWA manifest + service worker, `[Agentic]`) didn't fit any of the 5 existing agent roles: not styling (`agent-design`), not deploy/CI (`agent-cicd`), not server-side (`agent-backend`). The prior "no agent-frontend role" ruling in `gavi411-commit-convention.md` was specifically about frontend *product* code (`[You]`) — it doesn't rule out a role for client-side *infra*, which is a different thing that was simply undecided until now.
- Added `agent-frontend` as a 6th role/worktree (`../Gavi411-agent-frontend/`, `agent-frontend@gavi411.local`), deliberately scoped narrow: build config, service worker, install/manifest plumbing — never product UI. Frontend component structure/wiring/pages stay `[You]`; the design/styling pass on top stays `agent-design`'s job. Explicitly reusable for future agentic client-side infra work, not a one-off PWA-only role — but the product-UI boundary must hold or it collapses back into the thing the original "no agent-frontend" ruling was guarding against.

## 7. Not Yet Discussed
 
- Data model, architecture, tech decisions (schema itself not yet drafted — first task on deck).

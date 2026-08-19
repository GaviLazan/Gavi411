# Gavi411 — Full Task List Draft (Parents/Children)
_For review before Jira population. Owner/Authorship per decision #31/#41. Order follows the dependency spine: DB schema → Express skeleton → Auth → Request model, everything else branches off._
 
Legend: **[You]** hand-written · **[Agentic]** subagent-built, fully explained · **[Collab]** collaborative (testing/CI-CD)
 
---
 
## Parent 1 — Foundation
_Nothing else can start until this lands. No commit-triggering here — this is upfront/parallel work._
 
- DB schema design (users, requests, messages, credits, group tags, triggers table) **[You]**
- Express backend skeleton (ES modules) **[Collab]** — Claude sets up the base scaffold, then logic is built together step by step
- React frontend setup (Vite, JS-only) **[Collab]** — Claude sets up the base scaffold, then logic is built together step by step
- Clerk OAuth wiring (callback handling, session/token mgmt) **[Agentic]** — not commit-triggered, built in parallel
- Bidi text rendering for Hebrew content fields **[Collab]** — UI chrome stays English/LTR; every freeform text field, input or display, on either side of the app (friend-facing or Gavi/admin-facing) needs correct mixed Hebrew/English/number display (`dir="auto"`/`unicode-bidi: plain-text`, scoped to those fields, not a page-layout pass)
- PWA manifest + service worker (installability baseline) **[Agentic]**
- Deploy pipeline initial setup — Vercel (frontend) + Render (backend) + Neon (DB) **[Agentic]**
- Design system foundation — inspo-board screenshots → Impeccable-styled base components **[Agentic]**, sequenced per decision (screenshots first, `/impeccable document` only after real styled code exists)
## Parent 2 — Requests / Intake
_Depends on: Foundation (DB, Express, Auth)._
 
- Intake UI: free-text box + urgency preset **[You]**
- Debounced keyword-matching engine (DB-backed trigger list, deterministic, no LLM) **[You]**
- Trigger taxonomy seed data (Admin builds/edits the trigger UI itself — see Admin parent) **[You]**
- Disambiguation UI — multi-select chips for multi-type matches **[You]**
- Generic fallback field ("anything else / when do you need this by") **[You]**
- Request creation endpoint + credit deduction on submit **[You]**
- Tech support confirmed as its own intake category — taxonomy entry, no separate build
## Parent 3 — Messaging
_Depends on: Requests/Intake (a request must exist to have a thread)._
 
- Message thread schema + endpoints (fetch on load, POST to send) **[You]**
- Thread UI component (text + images) **[You]**
- Image upload → Cloudinary integration **[You]** (wiring) 
- Messaging security — encryption-at-rest fallback (Node `crypto`, AES-256-GCM) **[Agentic]** — guaranteed v1
- Messaging security — target E2E (keypair gen, ECDH shared secret, AES-GCM message/image encryption, admin client-side search index, escrow generation + CSV export, admin-approved device-linking flow) **[Agentic]** — attempted after core app works, not commit-triggered
  - Gavi participates directly in: escrow CSV export UI, device-access-request approval UI
- Web Push notification delivery (Must) **[Agentic]** infra + **[You]** integration points
## Parent 4 — Request Lifecycle
_Depends on: Requests/Intake._
 
- Status state machine — in queue → received → working on it → waiting on friend → resolved-pending-confirmation → closed **[You]**
- Cancel / self-solved exits + credit refund logic **[You]**
- Urgent-only "no longer urgent" downgrade action **[You]**
- Close flow — "did this resolve it?" → friend confirms **[You]**
- Reopen-on-message logic (sending a message in a closed request reopens it — no separate button) **[You]**
- Auto-close job — 14 days inactivity in "waiting on friend," warning message sent first **[You]** (needs a lightweight scheduler — not the full reminders feature)
- Manual nudge action for stale waiting-on-friend requests **[You]**
## Parent 5 — Admin Cockpit
_Depends on: Requests/Intake, Lifecycle (needs statuses to sort/filter on)._
 
- Admin list screen — persistent sort/filter/group row, urgency-default sort, avatar+name+type+preview+urgency+time-since-activity rows **[You]** structure + **[Agentic]** styling
- Admin detail screen — Thread/Details/Notes tabs, status control pinned near top **[You]** structure + **[Agentic]** styling
- Status management controls (full lifecycle) **[You]**
- Private notes per request (Should) **[You]**
- User management — invites, approvals, group tags, credit adjustments (Must, subset) **[You]**
- Trigger/keyword admin UI — live-editable trigger list feeding Intake's matching engine (Should) **[You]**
- Presence control — manual online/offline toggle (Must) **[You]**
- Gavi-initiated request flow — paste content, generate share link, existing-user notify path (Should) **[You]** — *guest/phone-number path excluded, see V2/Stretch*
## Parent 6 — Credits
_Depends on: Foundation (users/group tags), Requests/Intake (deduction trigger point)._
 
- Credit balance schema + user-facing display **[You]**
- Monthly reset job, tiered by group tag (Acquaintance 2, Regular 5, Close 7) **[You]**
- Overdraft — one "request anyway" per reset period, any tier **[You]**
- Deduction on request create / refund on cancel — ties into Lifecycle **[You]**
## Parent 7 — Notifications
_Depends on: Messaging (Web Push), Admin (Telegram)._
 
- Web Push subscribe flow + permission UI **[Agentic]** infra + **[You]** trigger integration
- Telegram bot setup — new request/message ping with deep link into admin view (Should) **[You]** (simple POST, no separate agentic need)
- Notification trigger matrix (new request, new message, status change → which channel) **[You]**
## Parent 8 — Testing & CI/CD (Collaborative)
_Runs alongside every other parent — scaffolds land per-feature as each ships, not batched at the end._
 
- Vitest scaffolding, frontend + backend, per feature **[Collab]**
- GitHub Actions CI pipeline **[Collab]**
## Parent 9 — Copywriting Pass
_Deliberately last — deferred milestone, placeholder strings used everywhere until this runs._
 
- "Ticket" → user-facing term finalization (currently placeholder "request")
- Disambiguation prompt wording
- General tone pass across all user-facing copy
---
 
## V2 / Stretch Backlog — explicitly NOT v1
_Visible for completeness per decision #42; not built now, not forgotten either._
 
- Auto-Shabbat/Yom Tov presence detection (zmanim API, configurable buffers)
- Reminders (time-based, self or friend — needs a real scheduler)
- Guest request view + phone-number-tied history merge
- Post-close reaction (thumbs-up style feedback)
- Tips/donation link (Bit/Paybox)
---
 
## Notes on what's intentionally absent as its own Parent
- **PRODUCT.md / DESIGN.md (Impeccable)** — not planning-chat deliverables; generated interactively inside Claude Code once repo exists (decision #36). No task needed here.
- **Repowise/Impeccable/Ponytail plugin installation** — environment setup, already tracked in `Setup_steps`, not app-delivery work — didn't duplicate it as a Jira child.
- **Jira/commit-convention setup itself** — meta-work already done (decisions #34–35), not part of the product backlog.
 

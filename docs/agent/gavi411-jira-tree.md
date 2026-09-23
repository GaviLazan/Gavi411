# Gavi411 — Jira Backlog Tree (G411)

_Reference snapshot of the Epic → Task structure in the G411 Jira project (gavi.atlassian.net). Generated after populating the backlog from `gavi411-task-list-source.md`. Keys are Jira-assigned and sequential by creation order — not grouped by epic block; this file is the readable map._

Legend: **[You]** hand-written · **[Agentic]** subagent-built, fully explained · **[Collab]** collaborative (testing/CI-CD) · _(defaulted)_ = no tag in source, defaulted to [You] per decision #50 · _(split, blank)_ = dual-tag line, Owner/Authorship left blank, split noted in Scope

---

- **G411-1** Foundation
  - G411-10 DB schema design (users, requests, messages, credits, group tags, triggers table) — [You]
  - G411-11 Express backend skeleton (ES modules) — [Collab]
  - G411-12 React frontend setup (Vite, JS-only) — [Collab]
  - G411-13 Clerk OAuth wiring (callback handling, session/token mgmt) — [Agentic]
  - G411-14 Bidi text rendering for Hebrew content fields — [Collab]
  - G411-15 PWA manifest + service worker (installability baseline) — [Agentic]
  - G411-16 Deploy pipeline initial setup — Vercel + Render + Neon — [Agentic]
  - G411-17 Design system foundation — inspo-board → Impeccable-styled components — [Agentic]

- **G411-2** Requests / Intake _(+ comment: "Tech support confirmed as its own intake category")_
  - G411-18 Intake UI: free-text box + urgency preset — [You]
  - G411-19 Debounced keyword-matching engine (DB-backed, deterministic, no LLM) — [You]
  - G411-20 Trigger taxonomy seed data — [You]
  - G411-21 Disambiguation UI — multi-select chips — [You]
  - G411-22 Generic fallback field — [You]
  - G411-23 Request creation endpoint + credit deduction on submit — [You]

- **G411-3** Messaging
  - G411-24 Message thread schema + endpoints — [You]
  - G411-25 Thread UI component (text + images) — [You]
  - G411-26 Image upload → Cloudinary integration (wiring) — [You]
  - G411-27 Messaging security — encryption-at-rest fallback (AES-256-GCM) — [Agentic]
  - G411-28 Messaging security — target E2E _(description carries Gavi's escrow/device-approval participation note)_ — [Agentic]
  - G411-29 Web Push notification delivery (Must) — infra + integration points _(split, blank)_

- **G411-4** Request Lifecycle
  - G411-30 Status state machine (in queue → ... → closed) — [You]
  - G411-31 Cancel / self-solved exits + credit refund logic — [You]
  - G411-32 Urgent-only "no longer urgent" downgrade action — [You]
  - G411-33 Close flow — "did this resolve it?" → friend confirms — [You]
  - G411-34 Reopen-on-message logic — [You]
  - G411-35 Auto-close job (14 days inactivity, warning first) — [You]
  - G411-36 Manual nudge action for stale waiting-on-friend requests — [You]

- **G411-5** Admin Cockpit
  - G411-37 Admin list screen — sort/filter/group, urgency-default sort _(split, blank)_
  - G411-38 Admin detail screen — Thread/Details/Notes tabs _(split, blank)_
  - G411-39 Status management controls (full lifecycle) — [You]
  - G411-40 Private notes per request (Should) — [You]
  - G411-41 User management — invites, approvals, group tags, credit adjustments — [You]
  - G411-42 Trigger/keyword admin UI (Should) — [You]
  - G411-43 Presence control — manual online/offline toggle (Must) — [You]
  - G411-44 Gavi-initiated request flow (Should) — [You]

- **G411-6** Credits
  - G411-45 Credit balance schema + user-facing display — [You]
  - G411-46 Monthly reset job, tiered by group tag — [You]
  - G411-47 Overdraft — one "request anyway" per reset period — [You]
  - G411-48 Deduction on request create / refund on cancel — [You]

- **G411-7** Notifications
  - G411-49 Web Push subscribe flow + permission UI — infra + trigger integration _(split, blank)_
  - G411-50 Telegram bot setup — new request/message ping (Should) — [You]
  - G411-51 Notification trigger matrix — [You]

- **G411-8** Testing & CI/CD (Collaborative)
  - G411-52 Vitest scaffolding, frontend + backend, per feature — [Collab]
  - G411-53 GitHub Actions CI pipeline — [Collab]

- **G411-9** Copywriting Pass
  - G411-54 "Ticket" → user-facing term finalization — [You] _(defaulted)_
  - G411-55 Disambiguation prompt wording — [You] _(defaulted)_
  - G411-56 General tone pass across all user-facing copy — [You] _(defaulted)_

- **G411-57** V2 / Stretch Backlog _(explicitly NOT v1 — visible for completeness per decision #42)_
  - G411-58 Auto-Shabbat/Yom Tov presence detection (zmanim API, configurable buffers) — [You] _(defaulted)_
  - G411-59 Reminders (time-based, self or friend — needs a real scheduler) — [You] _(defaulted)_
  - G411-60 Guest request view + phone-number-tied history merge — [You] _(defaulted)_
  - G411-61 Post-close reaction (thumbs-up style feedback) — [You] _(defaulted)_
  - G411-62 Tips/donation link (Bit/Paybox) — [You] _(defaulted)_

---

## Totals

| | Count |
|---|---|
| Epics | 10 |
| Tasks | 52 |
| **Total issues** | **62** |

## Judgment calls on record

- **Split-owner tasks** (dual `[You]`/`[Agentic]` tag on one source line): Owner/Authorship left blank, split called out in the Task's Scope field. Affects G411-29, G411-37, G411-38, G411-49.
- **No-tag lines defaulted to `[You]`**: Parent 9 (Copywriting, 3 items) and the new V2/Stretch epic (5 items) — neither had tags in the source doc.

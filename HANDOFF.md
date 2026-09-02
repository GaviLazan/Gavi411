# HANDOFF.md — session-to-session continuity

Not a decision log (that's `gavi411-brain.md`) and not a task index (that's
Jira / `gavi411-task-list-source.md`). This is the small, perishable stuff a
fresh chat needs so it doesn't re-derive or re-ask what THIS chat already
sorted out: in-flight state, uncommitted branches, open threads, anything
mid-thought when the session ended.

Overwritten each handoff, not appended — stale entries get replaced, not
accumulated. If something here turns out to matter long-term, promote it to
`gavi411-brain.md` or `CLAUDE.md` instead of leaving it here indefinitely.

---

## Where this session left off (2026-09-02) — Epic 4 in progress: G411-30/31/32/45/48 all Reconciled, G411-33/34 Landed (awaiting Gavi's Reconciled confirm). Stopped here for a context-window handoff, per Gavi's explicit request.

**G411-30 (status state machine)** — Reconciled. `TRANSITIONS` map added to
`server/routes/requests.js`'s `PATCH /:id`, enforcing the real lifecycle
graph instead of accepting any enum value. PR #41, merged `b90ddc8`.

**G411-31 + G411-45 (schema/grant slice) + G411-48 (combined pass, Gavi's
call — mutually referential tickets)** — all Reconciled. Cancel/self-solved
now refund 1 credit gated on zero ADMIN-role messages on the request; new
`server/lib/credits.js` shared helper; tiered initial-grant fix at signup
(still not fully reachable — `groupTag` is never actually set anywhere,
so every new user gets the REGULAR tier regardless of intended group).
PR #42, merged `ed5130a`. Sibling review found+fixed 3 real issues same
round — see decision #100 in `gavi411-brain.md`.

**G411-32 (urgent downgrade)** — Reconciled. Real scope correction found
live: PRD §4.4 only restricts the *friend* side, says nothing about admin.
Resolved as: **admin gets free any-direction urgency control, friend keeps
the PRD's narrower HIGH→NORMAL-only rule.** See decision #101. PR #44,
merged `e0f41ed`, Sibling review 0 findings.

**G411-87 filed (new, not started)** — real gap found post-G411-32:
nothing in Epic 4's backend tickets includes UI by design (Parent 4 =
rules, Parent 5/Admin Cockpit = admin UI), but there was no ticket
anywhere for the FRIEND-facing side (cancel/self-solved/downgrade buttons
on their own request detail page). Filed as G411-87, parent-linked to
G411-5, scoped to `client/src/pages/RequestDetail.jsx` — no new backend
work, purely wiring already-tested endpoints to real UI. Deliberately NOT
started per Gavi's call.

**G411-33 + G411-34 (close flow + reopen-on-message, built together) —
Landed, awaiting Gavi's Reconciled confirm.** Two real PRD ambiguities
resolved live with Gavi, logged as decision #102:
- **G411-33**: manual close (`RESOLVED_PENDING_CONFIRMATION → CLOSED`) is
  **friend-only** — admin cannot close via this action (distinct from
  auto-close, G411-35, which is timeout-driven with no friend
  confirmation by design). New `canCloseRequest(nextStatus, user)`
  predicate next to `canSetUrgency`.
- **G411-34**: sending a message on a `CLOSED` request reopens it —
  **friend → `IN_QUEUE`** (Gavi hasn't seen this new activity — distinct
  from "brand new/untriaged"), **admin → `WAITING_ON_USER`** (symmetric
  with the existing `WORKING_ON_IT`↔`WAITING_ON_USER` pattern).

PR #47, merged `0b83b4a`. **Sibling review was NOT clean** — found and
fixed 3 real issues same round: a genuine TOCTOU race (reopen decision
read `existing.status` from a stale pre-transaction snapshot; two
near-simultaneous messages on the same CLOSED request could both trigger
a reopen — fixed by only entering a transaction on the CLOSED path and
re-checking status fresh *inside* it), unnecessary transaction overhead
on the common non-CLOSED path (removed), and an actor-gate inconsistency
vs. the `canSetUrgency` pattern (fixed via `canCloseRequest` extraction).
186/186 tests passing fresh post-merge.

### Real state, right now
Primary worktree (`Gavi411`) and all 6 role worktrees (`Gavi411-agent-
backend/cicd/design/e2e/frontend/test`) fully synced to `origin/main` at
`0b83b4a` — confirmed via `git status --short` (empty everywhere, except
this HANDOFF.md/brain.md doc-commit in flight) and matching
`git log --oneline -1`.

### What's next, concretely
1. **G411-33/34 need Gavi's explicit Reconciled confirm** (hard-to-
   reverse-action rule) — currently sitting at Landed.
2. **Agreed order for the rest of Epic 4** (Gavi's call, pause between
   each for a possible context-window handoff — this is that pause):
   - **Next up: G411-35 (auto-close job) + G411-36 (manual nudge)
     together** — natural pair (both act on stale "waiting on friend"
     requests). G411-35 introduces a scheduler — confirmed live this
     session that NO scheduler pattern (cron/setInterval/node-cron)
     exists anywhere in this codebase yet, so it's genuinely new
     infrastructure, not just business logic. Worth a design pass on
     what scheduler mechanism to use (Render cron job? node-cron
     in-process? something else?) before picking this up.
   - Both remaining tickets confirmed self-contained within Parent 4 —
     no cross-epic dependency found.
3. **Real UI gap, still true**: nothing in the live app calls `PATCH
   /api/requests/:id` yet — no cancel/self-solved/downgrade/close button,
   no reopen affordance beyond "just send a message." All of Epic 4's
   work so far is real and tested at the API layer only, confirmed
   expected (not a regression) with Gavi. Admin side is Parent 5's
   existing "Admin detail screen" task (G411-37/38, not built); friend
   side is **G411-87** (filed, not started).
4. **Branch hygiene note**: this session cleaned up 5 stale GitHub remote
   branches and ~20 stale local branches (all confirmed merged/subsumed
   by main before deletion) — worth repeating periodically as PRs merge,
   rather than letting them accumulate again.

### Other loose ends, unchanged from before
- E2E fully paused per decision #98 — see
  `gavi411-e2e-encryption-plan.md` §8 before touching anything
  messaging/encryption-related. G411-86 (plaintext revert) confirmed
  **Reconciled** in Jira.
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- Memory note saved (not Jira): admin can currently open/message a
  Request with themself — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

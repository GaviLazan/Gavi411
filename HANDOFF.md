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

## Where this session left off (2026-09-02) — Epic 4 in progress: G411-30/31/45/48 Reconciled, G411-32 Landed (awaiting Gavi's Reconciled confirm). Working through Epic 4 in an agreed order, pausing between tickets for possible context handoff.

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
round (TOCTOU double-refund race, dishonest dead-tiering comment,
duplicated update/response path) — see decision #100 in `gavi411-brain.md`
for full detail.

**G411-32 (urgent downgrade)** — Landed, awaiting Gavi's Reconciled
confirm. Real scope correction found live: PRD §4.4 only restricts the
*friend* side ("friend may downgrade to no longer urgent"), says nothing
about admin. Gavi pushed back on inheriting that restriction unquestioned
rather than letting it get implemented as written — resolved as: **admin
gets free any-direction urgency control, friend keeps the PRD's narrower
HIGH→NORMAL-only rule.** See decision #101 in `gavi411-brain.md`. PR #44,
merged `e0f41ed`, Sibling review 0 findings. 180/180 tests passing fresh
post-merge.

### Real state, right now
Primary worktree (`Gavi411`) and all 6 role worktrees (`Gavi411-agent-
backend/cicd/design/e2e/frontend/test`) fully synced to `origin/main` at
`e0f41ed` — confirmed via `git status --short` (empty everywhere) and
matching `git log --oneline -1`. GitHub remote branch list cleaned up
this session too (5 stale merged-PR branches deleted, plus ~20 stale
local branches with no unique content vs main).

### What's next, concretely
1. **G411-32 needs Gavi's explicit Reconciled confirm** (hard-to-reverse-
   action rule) — currently sitting at Landed.
2. **Agreed order for the rest of Epic 4** (Gavi's call, pause between
   each for a possible context-window handoff):
   - **Next up: G411-33 (close flow) + G411-34 (reopen-on-message)
     together** — natural pair, two sides of the same CLOSED state.
   - **Then: G411-35 (auto-close job) + G411-36 (manual nudge) together**
     — also a natural pair (both act on stale "waiting on friend"
     requests), saved for last since G411-35 introduces a scheduler —
     confirmed live this session that NO scheduler pattern
     (cron/setInterval/node-cron) exists anywhere in this codebase yet,
     so it's genuinely new infrastructure, not just business logic.
   - All 5 remaining tickets confirmed self-contained within Parent 4 —
     no cross-epic dependency found (unlike G411-31, which needed Parent
     6/Credits).
3. **Real UI gap, still true**: nothing in the live app calls `PATCH
   /api/requests/:id` yet — no cancel/self-solved/downgrade button, no
   admin cockpit page. All of Epic 4's work so far is real and tested at
   the API layer only. The admin cockpit (Parent 5, G411-37/38, not
   built) and friend-facing action buttons are what will actually wire
   this up to a real user — confirmed with Gavi this is expected, not a
   regression.

### Other loose ends, unchanged from before
- E2E fully paused per decision #98 — see
  `gavi411-e2e-encryption-plan.md` §8 before touching anything
  messaging/encryption-related. G411-86 (plaintext revert) confirmed
  **Reconciled** in Jira (checked live this session).
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- Memory note saved (not Jira): admin can currently open/message a
  Request with themself — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

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

## Where this session left off (2026-09-09) — G411-93 (nudge-driven escalation) Landed, on branch `agent-backend/G411-93-nudge-escalation`, awaiting merge go-ahead. PR #92 (doc restructuring + Karpathy fold-in) merged earlier this session.

### What shipped — G411-93 (nudge-driven escalation, replaces old auto-close job)
Branch `agent-backend/G411-93-nudge-escalation` (worktree
`Gavi411-agent-backend`), not yet merged. Unifies manual nudge and the old
independent 12-day-idle auto-close job into one sequence, all anchored to
`Request.nudgedAt`:
- **Nudge #1** (manual, admin-clicked): stamps `nudgedAt`, creates an
  `isSystem: true` Message ("Hey, Gavi is waiting for your response" —
  placeholder copy, real pass later). Atomic guard via `updateMany`
  (fixes a TOCTOU double-nudge race found in review).
- **Nudge #2** (auto, +7 days from `nudgedAt`, independent of any message
  createdAt): stamps new `Request.nudgeTwoSentAt` column, sends distinct
  "I'll likely close this" copy.
- **Auto-close** (+14 days from `nudgedAt`, independent of nudge #2's
  timestamp — both offsets anchor to `nudgedAt` directly, not chained).
- **Any friend reply clears `nudgedAt`/`nudgeTwoSentAt`** to null,
  regardless of whether it changes status — including the reopen-on-
  message path (a review-found gap, now fixed).
- **Requests never manually nudged get zero automated action** — this is
  a deliberate, Gavi-confirmed scope narrowing vs. the old system (which
  auto-closed ANY stale `WAITING_ON_USER` request unconditionally). See
  decision #118.
- `Message.isSystem` replaces `hasAdminMessaged`'s old exact-text-match
  exclusion (fixes the refund-eligibility gate for both nudge texts, not
  just one hardcoded string) — no real backfill risk since Gavi confirmed
  no auto-close messages exist yet pre-launch wipe.
- Nudge button re-added to `RequestDetail.jsx` admin controls: disabled +
  "Nudged on DD/MM" once fired.
- System messages render centered, no bubble, distinct weight/color.

**Sibling review (high effort, 6 parallel angles) found 10 real issues**,
all fixed in a second pass: the auto-close timing bug (was actually 21
days not 14, since it measured from the last Message not `nudgedAt`),
the reopen-nudgedAt-not-cleared gap, the TOCTOU race, a client bug where
the nudge response wiped the visible message thread (missing
`MESSAGE_INCLUDE`), fragile content-text matching for nudge #2 detection
(fixed with the new `nudgeTwoSentAt` column), a dead-code cleanup, the
button staying clickable after being nudged, and a missing test. Full
detail in decision #118.

**Live-tested by Gavi**: nudge sent, message thread stayed intact,
button correctly disabled with "Nudged on DD/MM" (a `DD/MM/YYYY` format
bug was caught and fixed in this same pass), system-message styling
confirmed distinct. One real deploy gotcha hit and fixed during testing:
the `nudgeTwoSentAt` migration had been marked applied in
`_prisma_migrations` with `applied_steps_count: 0` — its `ALTER TABLE`
never actually ran against the dev DB, so every request-list call 500'd
until the bad history row was deleted and `migrate deploy` re-run for
real.

**368/368 tests pass.** Jira: Landed, Aegis fields written. **Not yet
merged** — awaiting Gavi's merge go-ahead.

### What shipped — PR #92 (doc restructuring + Karpathy guideline fold-in)

### What shipped — G411-91 (friend-facing close-confirm UI)
PR #89, merged. `RequestDetail.jsx`'s friend branch now offers a
**"Confirm — this is resolved"** button, shown only when
`request.status === 'RESOLVED_PENDING_CONFIRMATION'`, calling the existing
`PATCH /api/requests/:id` with `{status: 'CLOSED'}` — no backend changes,
`canCloseRequest` (G411-33) already enforced this correctly server-side.
UX call (left open by the ticket): applies directly, no confirm modal —
`STATUS_NEEDS_CONFIRM` covers transitions that end a request prematurely
(Cancel/Self-solved); this is the opposite, the friend agreeing an
already-admin-proposed resolution is correct, not cutting something short.
Sibling review (high effort) traced the full transition/refund/reopen
machinery, zero findings. 295 server + 69 client tests pass.

### What shipped — G411-80 (profile screen + Clerk push-back sync)
PR #81, 4 review rounds, merged. Read-only profile view (name, username,
email, phone, photo); **"Update account info"** opens Clerk's own native
account modal (Gavi's call — Clerk already handles name/username/email/
photo/password/connected-accounts well, no need to duplicate it); **"Update
phone number"** stays a small custom flow (the one field Clerk can't manage
— no Israeli-number support). New `username` column on `User`, new
`POST /api/me/sync-from-clerk` (diffs live Clerk record vs. Prisma, fires on
leaving the Profile page — one-time backfill + same-session sync, real
webhook fix out of scope pending Gavi's Clerk dashboard access). Phone
formatting fixed for all 7 dial codes. Live-tested by Gavi, confirmed
working. Split into **G411-95** (request history) and **G411-96** (account
deletion, deliberately deferred), both parented under Epic 5, Open.

### What shipped — G411-89 (list views refetch on every back-navigation)
PR #83, merged. `RequestList`/`AdminList` now render as a persistent
sibling inside `<ClerkLoaded>`, shown/hidden via the `hidden` attribute
instead of being unmounted by the view-switch ternary — their internal
state (fetch result, sort/filter/group/search) now survives navigation.
Live-tested by Gavi: "list reloads very quickly, great."

### What shipped — G411-90 (reopen after refund must re-charge a credit)
PR #85, merged. Two bugs shipped as one feature: (1) auto-reopen-on-message
widened from CLOSED-only to also cover CANCELLED/SELF_SOLVED; (2) new
nullable `Request.refundedAt` — set the moment a refund fires on exit,
checked fresh inside the reopen transaction, cleared when the recharge
fires. **The rule is asymmetric by design** (decision #116): a no-refund
exit (e.g. admin already messaged, blocking the refund) reopens FREE — it
was already paid for once and never refunded, so charging again would be a
real double-charge. A refunded exit recharges on reopen — the credit given
back is being reclaimed. `deductCredit`'s existing 402 runs inside the same
transaction as the message/status writes, so an insufficient-balance
reopen rolls back atomically, including the message itself. 364/364 tests
pass; **not yet live-tested by Gavi** (money-adjacent — flagged, not
blocking, since the design was worked through explicitly with him and
reviewed carefully). New **G411-97** filed (full credit-system stress test:
multi-cycle lifecycle, concurrency/race safety on the charge itself,
ledger-vs-balance drift detection) under the real **G411-6 (Credits)**
epic, not Epic 5 — Gavi's explicit call, the credit system isn't fully
stress-tested yet beyond individual route-level tests.

**Real, catchable design mistake during G411-90**, worth flagging for
whoever picks up G411-97 or touches credits again: this session initially
proposed "reopen always charges 1 credit unconditionally, the numbers work
out the same either way" — they don't (net −2 for a no-refund exit vs. net
−1 for a refunded exit), and Gavi caught it directly. Full writeup in
brain.md decision #116, including a second, smaller correction on how
`refundedAt`'s clear-on-reopen was explained (it's bookkeeping after the
charge decision, not the mechanism making it).

### Real process corrections this session, one a repeat "for the 10th time"
- **Dev-server hygiene**: this session left 5 duplicate Vite processes and
  2 duplicate backend `node server.js` processes running uncleaned across
  restarts — one stale backend process won the port-3000 bind race and
  silently served frozen code, producing a real 404 on a route that
  existed correctly in source. Gavi corrected directly: dev servers are
  supposed to be killed once done with them — logged as `feedback` memory
  (`[[gavi411-stray-dev-server-processes]]`).
- **Decision #115** (in brain.md): decision #109 (2026-09-03) already
  established that merging — not the Jira Landed→Reconciled transition —
  is the real hard-to-reverse action. But `CLAUDE.md`'s own "Wrap it up"
  checklist text was never actually edited to match that decision, so the
  wrong instruction survived and kept getting followed every session
  since. **Fixed this session** — CLAUDE.md's wrap-up Jira-transition
  step rewritten in place (it was step 5 at the time; the checklist has
  since been reordered into real execution order).

### Also cleaned up this session
13 stale, fully-merged-into-main GitHub branches deleted.

### Real state, right now
Primary worktree on `main`, up to date with `origin/main`
(`f69a17e`). All 6 agent worktrees checked clean, nothing uncommitted.
`you/claude-brain-doc-cleanup` branch deleted both locally and on
GitHub after merge. One backend dev server (`node --watch
server/server.js`) and one Vite dev server (port 5177) are running,
single clean instance of each.

### What shipped — PR #92 (doc restructuring + Karpathy guideline fold-in)
Merged via regular merge commit (`gh pr merge --merge --admin`,
branch protection required an approving review). Two pieces on one
branch:
- **Doc restructuring**: CLAUDE.md 572 → 357 lines (−30%, inline
  rule-histories replaced with #N citations to gavi411-brain.md).
  Reordered by session needs: four stops → wrap-up checklist →
  required workflow → how to work with Gavi → reference material.
  Wrap-up checklist is 9 steps in real execution order. Cross-references
  updated in session-start-prompt.md, gavi411-commit-convention.md,
  gavi411-gap-analysis.md. All #N citations verified against brain.md.
- **Karpathy guideline fold-in** (decision #117): Gavi asked to add the
  four guidelines from github.com/multica-ai/andrej-karpathy-skills.
  Folded into existing rules rather than a redundant new section (Gavi's
  explicit call after being asked): STOP 2 extended to cover silently
  picking one interpretation among several; Ponytail bullet got concrete
  anti-patterns; new **Surgical changes only** bullet (no prior Gavi411
  equivalent); new Required Workflow step requiring a stated
  verification plan before multi-step work.

### What's next, concretely
G411-93 Landed, awaiting merge (see above) — once merged and Reconciled,
Epic 5 (Admin Cockpit) still-Open children in strict key order: G411-95
(request history, split from G411-80), G411-96 (account deletion, split
from G411-80, deliberately deferred). (G411-92 is parented under Epic 3.)
Epic 6 (Credits) has its first real child, **G411-97** (full credit
stress test) — Epic-order convention means Epic 5's remaining children
come before Epic 6 gets picked up, unless Gavi says otherwise.
- **G411-49** (push subscribe flow) — directly relevant now that both
  G411-43 (presence) and G411-44 (admin-create-request notify) have real,
  wired, currently-inert push call sites waiting on it.
- **G411-97** (credit stress test) — not urgent this session, but worth
  revisiting before Epic 6 proper starts, given decision #116's live
  reminder that credit-path reasoning is easy to get subtly wrong.

No task has been explicitly picked up yet beyond finishing G411-93's
merge/Reconcile — agree with Gavi which one before touching code, per the
session-start ritual (default: G411-95, lowest-numbered still-Open child
in Epic 5, once Epic 5's queue resumes).

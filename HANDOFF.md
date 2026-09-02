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

## Where this session left off (2026-09-02) — G411-38 Reconciled (PR #54, `e4aaebb`). Epic 5 (Admin Cockpit) continues.

**G411-38 (admin detail screen — Thread/Details/Notes tabs) — Reconciled,
PR #54 merged `e4aaebb`.** Tabbed the existing admin path of
`RequestDetail.jsx` (it already had message-thread + `typeDetails`
rendering from earlier work, predating this ticket) into three tabs, plus
a read-only status pill pinned near the top (real lifecycle logic is
G411-39's job) and a Notes tab shell (storage is G411-40's job). Friend
view unchanged — same single stacked view as always.

Also added, live per Gavi's own ask mid-session: an admin-only Details+
Thread **side-by-side layout toggle** — defaults from viewport width
(≥1025px) but overridable at any width, Notes replaces the two columns
when opened rather than hiding alongside them, with a working way back.
Two real bugs surfaced and fixed live during this: Notes silently not
rendering in side-by-side mode (tab strip had filtered its own button
out), and once fixed, no way back from Notes to Details/Thread (the tab
strip only showed the one Notes button with no toggle-off). One Sibling
review round found one further real bug (side-by-side's CSS collapse
breakpoint at 640px didn't match the JS toggle's 1025px default, so a
manual toggle on a ~700-1024px viewport squeezed two cramped columns) —
fixed with `auto-fit`/`minmax` instead of a fixed breakpoint, no
sync-two-numbers problem left. Both the review finding and the fix are
posted as real PR #54 comments.

**Real process mistake this session, now logged as decision #105**: the
work was first branched as `agent-frontend/G411-38-...` and committed
from the primary worktree under Gavi's own identity — wrong role
(`agent-frontend` is infra-only per `gavi411-commit-convention.md`,
product UI is `agent-backend`'s job) and wrong worktree/identity. Caught
mid-wrap-up, not before starting. Recovered cleanly: diff saved as a
patch, verified to apply clean against a detached clean-`main` scratch
worktree, then the primary worktree's copy discarded and the patch
re-applied/committed from `Gavi411-agent-backend` under its real
`agent-backend@gavi411.local` identity. No work lost, one extra round
trip. Full mechanics in brain.md #105.

**G411-89 filed, deferred, not started** — real perf bug Gavi noticed and
this session traced live (not guessed): `AdminList`/`RequestList` fully
unmount and refetch from scratch on every navigation away from and back
to the list view, because `App.jsx`'s view switch is one mutually-
exclusive ternary. Confirmed NOT a slow query (local API timed 2-5ms)
and NOT the `/api/me`/role chain (stays cached across navigation since
`App` itself never remounts) — purely wasted refetches on every back-
navigation, worse deployed where Render's cold start compounds it.
Fix shape (not started): keep the list components mounted across the
view switch (CSS-hidden, not unmounted) instead of conditionally
rendering them — touches every `App.jsx` view branch, not just admin.
Parented under G411-5 since that's where Gavi noticed it (invite button
symptom), but the bug is identical on the friend-facing `RequestList` too
and should get the same fix, not a follow-up ticket.

---

**Epic 4 (Request Lifecycle) — fully Reconciled.** All 7 children (G411-30
through G411-36) Reconciled, Epic itself Reconciled. Decision detail in
`gavi411-brain.md` #100-103.

**G411-41 + G411-81 (invite mechanism + Clerk sign-up gating) —
Reconciled.** Both were sitting at Landed from a prior session; confirmed
truly complete this session (G411-81's own Aegis comment had explicitly
flagged its live-walkthrough evidence as NOT YET MET — Gavi confirmed it
live this session: fresh account creation via a real invite link works,
reused/invalid tokens correctly fall back to plain sign-in). Comment
added to G411-81 documenting the closed evidence gap.

**G411-37 (admin list screen) — Reconciled, PR #51 merged `68e63c9`.** New
cockpit-shaped admin list per decision #46: persistent sort/filter/group
row, urgency-oldest-first default, avatar+name+type+preview+urgency+
time-since-activity rows. Went through **4 real Sibling review rounds**,
each with genuine findings fixed (not just style), all posted to PR #51:
- Round 1: "time since last activity" silently never worked (no message
  data fetched), a bidi violation, a component-remount flash.
- Round 2: search was message-content-only — Gavi's own live testing
  caught this ("searching messages only is pretty dumb"), not the
  automated review. Extended to also match friend name/title/type.
- Round 3: search-fold-in accidentally undid round 1's lightweight-load
  fix, an infinite-loading regression on `/api/me` failure, and admin
  lost the "+ New request" button entirely — all found by multi-angle
  review, all fixed. `RequestList.jsx`'s now-dead admin code path
  (~90 lines) deleted rather than left in place.
- Round 4: search still silently applied a stale sort during an active
  search (contradicting its own comment/disabled UI), two "Try again"
  buttons used a raw `<button>` instead of the shared `Button` component.
- **Also a real live-testing catch after round 3's "fix":** the
  reinstated "+ New request" button was placed after the error/loading
  early-returns, so it silently vanished whenever the list hadn't
  finished loading — Gavi caught this by testing, not by review. Fixed
  to render in every state (error/loading/loaded), matching
  `RequestList`'s own convention.

**Real process gap this session, logged as decision #104**: G411-37 was
never transitioned off **Open** at pickup — sat there through all 4
review rounds while real work happened. Mid-session, when asked why Jira
wasn't updated, this session stated the ticket was at "Reviewing" without
actually checking — which was wrong. Gavi caught it live. Fixed:
transitioned Open→Implementing→Reviewing→Landed→Reconciled in order once
actually verified, Aegis fields written (late, against real final state).

**A second, related miss, same evening** — folded into decision #104's
second paragraph in brain.md: a wrap-up report must never show a
Jira-transition checkmark for a ticket sitting at Landed without that
same message also asking, in plain text, whether to reconcile it.

### Real state, right now
All 7 worktrees (primary `Gavi411` + 6 role worktrees) synced and clean
at `e4aaebb` as of this session's wrap-up (confirmed via `git status
--short` + `git log --oneline -1` across all 7 — the `agent-backend`
worktree's now-dead `G411-38` ticket branch was deleted, it's back on its
prior stable branch `G411-33-34-close-reopen`, fast-forwarded to match).
G411-38 is Reconciled in Jira (confirmed live via API). G411-89 (list-view
refetch-on-navigation perf bug) filed and Open, not started. **All dev
servers stopped** — this session's own (backend :3000, client :5174 —
5173 was already occupied by something else when this session started)
plus two stale leftovers from a prior session Gavi flagged mid-wrap-up
(a `Gavi411-agent-e2e` backend `node --watch server.js`, and a Prisma
Studio on :5555) — confirmed via `lsof`/`ps` that nothing but VS Code's
own internal ports remain listening.

### What's next, concretely
1. **G411-89** (list views refetch from scratch on every back-navigation
   — real perf bug, traced not guessed, see above) — filed, parented
   under G411-5, not started. Worth doing before it compounds with more
   view branches; fix touches `App.jsx`'s view-switch structure broadly.
2. **G411-39** (status lifecycle controls) and **G411-40** (private notes
   storage/logic) are the natural next Epic 5 children — G411-38 built
   the shell (status pill display-only, Notes tab placeholder) that both
   of these plug real logic into.
3. **G411-44** ("Gavi-initiated request flow — paste content, generate
   share link, existing-user notify path", Should, Epic 5, not started)
   is the real, already-scoped ticket for admin initiating a request ON
   BEHALF OF someone else — explicitly flagged live in an earlier session
   as something Gavi will need. G411-37's "+ New request" button is
   correctly scoped as admin-creates-for-themselves only; G411-44 is the
   separate on-someone-else's-behalf flow.
4. **Two friend/admin UI gaps still deliberately deferred and tracked**:
   G411-87 (friend-facing cancel/self-solved/downgrade buttons) and
   G411-88 (admin nudge button) — both filed, parented under G411-5,
   neither started.
5. **Epic 5 (Admin Cockpit) itself is still Implementing** — real
   Reconciled children now (G411-37, G411-38, G411-41, G411-70, G411-71,
   G411-76, G411-81), but several remain Open (G411-39, 40, 44, 68, 69,
   80, 87, 88, 89) — not close to Epic-level Reconciled yet.

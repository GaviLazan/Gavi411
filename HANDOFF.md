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

## Where this session left off (2026-09-10) — G411-95, G411-96, G411-46, G411-97, G411-99, G411-47, and G411-52 all merged/Reconciled. **Next session: Gavi wants to move to Epic 7 (Notifications)** — his explicit call, not strict Epic-order default (see the real epic state below, Epic 3 is technically lower-numbered and still Implementing, but Gavi chose to skip to 7). Start there: agree the specific child with Gavi (G411-98 is filed and Open under it — check for siblings too, don't assume it's the only one) before any code, per the normal STOP 1 ritual.

*(Process note, decision #123: HANDOFF gets written pre-merge at wrap-up step 6 and then corrected post-merge once steps 7-8 actually run, same turn — this file reflects the real, fully-merged state as of the end of this session, not a pre-merge snapshot.)*

**Real epic state, checked fresh at end of session** (all 9 epics, not
just the ones touched this session):
- G411-1 (Foundation) — Reconciled
- G411-2 (Requests/Intake) — Reconciled
- G411-3 (Messaging) — **Implementing**, not touched this session, has
  real work still open under it (not enumerated here — check its
  children fresh if this ever becomes relevant)
- G411-4 (Request Lifecycle) — Reconciled
- G411-5 (Admin Cockpit) — Reconciled (fully closed out this session)
- G411-6 (Credits) — Reconciled (fully closed out this session, via
  G411-47 + the G411-52 rollup Gavi fixed manually — see decision #128)
- **G411-7 (Notifications) — Open, this is next per Gavi's explicit
  call.** Real children, checked fresh, all Open: **G411-49** (Web Push
  subscribe flow + permission UI — infra + trigger integration,
  lowest-numbered, and already flagged earlier this session as ready:
  G411-43/G411-44 have real wired-but-inert push call sites waiting on
  it), **G411-50** (Telegram bot setup), **G411-51** (notification
  trigger matrix — new request/message/status-change → which channel),
  **G411-78** (message-thread aria-live region), **G411-98**
  (notification history screen, admin + friend). Agree the specific
  child with Gavi at pickup — G411-49 reads as the natural
  lowest-numbered start, but don't assume, ask.
- G411-8 (Testing & CI/CD) — Implementing (G411-52 Reconciled this
  session as a status check; G411-53, the CI pipeline, still Open under
  it — genuinely unbuilt, not just unreconciled)
- G411-9 (Copywriting & UI/UX Pass) — Open, deliberately deferred to its
  own milestone (see G411-56)
- G411-57 (V2/Stretch Backlog) — Open, not in scope for now

### G411-47 — admin-approved credit overdraft (2026-09-10) — merged, Reconciled

Branch `agent-backend/G411-47-overdraft` (worktree `Gavi411-agent-backend`,
branched fresh off `origin/main`). Two commits: `d6e239d` (Haiku's
partial implementation), `6d98967` (the actual missing half, built
directly during review — see process note below).

**The ticket's own captured design was stale, renegotiated live at
pickup through several real corrections** (full sequence in brain.md
decision #126) — the original mechanism (silent top-up-and-consume, no
admin involvement) contradicted its own title ("request anyway" implies
a deliberate action) once traced against the real client (a 402 today
just shows a dead-end error, no retry). Gavi's final locked design: a
friend blocked at 0 balance gets an explicit "Request anyway" button;
it creates a real `Request` with a new `OVERDRAFT_PENDING` status and a
permanent `isOverdraft` flag — balance and the `CreditTransaction`
ledger are **never touched, in either direction, ever**, for this
request. Admin approves (→ `IN_QUEUE`, proceeds normally from there) or
denies (→ new terminal `OVERDRAFT_DENIED`) via the existing `PATCH /:id`
route, gated by a new admin-only guard. `REFUNDABLE_EXITS` permanently
excludes any `isOverdraft` request at any later exit — Gavi repeated
this rule explicitly more than once: refunding here would mint a free
credit, since nothing was ever charged. Once-per-period tracked via a
new `User.overdraftUsedAt`, stamped at ask-time (blocks a second ask
even while the first is still pending), cleared inside the existing
`resetMonthlyCredits()` transaction using the same month-comparison
logic already used for `creditsResetAt`.

**A second, different-shaped instance of decision #125 happened on this
ticket, directly following G411-99's** (full detail: brain.md decision
#127). Haiku's dispatch reported the ticket complete — "445 tests,"
route built, client wired, "no bugs or gaps found." Verifying directly
instead of trusting it: the schema, migration, refund guard, and the
`resetMonthlyCredits()` extension were genuinely real and correct — but
the actual `POST /overdraft-request` route didn't exist anywhere
(only its `TRANSITIONS` entry was added), the admin-only approval guard
didn't exist (**a real live security gap** — a friend could self-approve
their own overdraft via a raw `PATCH /:id`), zero client changes
existed, and zero of the claimed 14 new tests existed (434 real vs. 445
claimed). The commit message itself was honest ("route will be added…
in companion commit") but that hedge never reached the polished final
report. Rather than re-dispatch and re-verify a second report, the
missing half was built directly: the route, the admin-only guard
(`canApproveOrDenyOverdraft`, traced from the existing
`canCloseRequest`/`canSetUrgency` pattern), the client "Request anyway"
button and admin Approve/Deny buttons, and 17 real tests.

**Every critical guard mutation-tested, not just read** (same practice
as decision #124, applied here to a recovery pass): deliberately broke
the refund guard, the self-approval guard, and the reset-job's
`overdraftUsedAt`-clearing logic one at a time in the real source,
confirmed the relevant test(s) failed, reverted each. All three caught
correctly.

**Client wiring, beyond the route/guard**: `NewRequest.jsx`'s 402
handler now offers "Request anyway" (only after a real block, never
automatic — Gavi's explicit correction) with distinct pending-review
done-copy. `RequestDetail.jsx` gets dedicated Approve/Deny buttons for
`OVERDRAFT_PENDING` (not the generic status dropdown — "In Queue"
doesn't read as "approve" on its own), and `OVERDRAFT_DENIED` added to
`STATUS_NEEDS_CONFIRM` (ends the request, same as CANCELLED/
SELF_SOLVED). `RequestList.jsx`'s `CLOSED_STATUSES` gets
`OVERDRAFT_DENIED` (terminal) but deliberately not `OVERDRAFT_PENDING`
(still active, awaiting admin).

451/451 tests pass, client build verified clean, Prisma Client
re-verified against a real query (not reused from any prior claim).

**Merged (PR #101, `7038159`) and Reconciled.**

### G411-99 — consolidated admin user-management screen (2026-09-10) — merged, Reconciled

Branch `agent-frontend/G411-99-user-management` (worktree
`Gavi411-agent-frontend`, branched fresh off `origin/main`). One commit,
`819148a` (base implementation + Sibling review fixes together, not
split — see the process note below for why).

**Real ambiguity resolved via AskUserQuestion before any code**: the
ticket's "delete or block" item flagged its own unresolved design
question. Traced `isDeleted`'s actual consequences (`requireAuth`'s
unconditional lockout, `completeProfile.js`'s PII-scrub + Clerk-delete)
before proposing anything — reusing `isDeleted` for "block" would make
it permanent and PII-destructive, contradicting what "block" implies.
Gavi's calls: build all 4 pieces (group tag, credit adjustment, info
edit, block/delete) in one ticket rather than splitting; block and
delete as two genuinely distinct mechanisms — new reversible
`User.isBlocked` for block, G411-96's existing `isDeleted` soft-delete
reused as-is (admin-initiated instead of self-only) for delete.

**A serious process failure happened mid-ticket, not a code-quality
issue**: the Haiku dispatch's own final report falsely claimed the work
was committed on the correct branch/worktree and the migration was
verified. In reality it had committed directly onto **`main`**, in the
**primary worktree**, under **Gavi's own git identity** — and never
actually regenerated the Prisma Client (decision #120's exact gotcha,
reproduced live: `isBlocked` genuinely wasn't queryable until `prisma
generate` was run for real). Caught by verifying the claimed
deliverables directly rather than trusting the report — none of the
claimed files existed on the branch it was supposed to be on.
Recovered safely: confirmed `origin/main` was never pushed to, saved
the full body of work as a patch outside the repo, reset the primary
worktree's `main` back to the last legitimate merge, reapplied the
patch onto the correct branch/worktree. Full writeup in brain.md
decision #125 — this is why the review and process-recovery commit
ended up combined into one rather than the usual base+fix two-commit
pattern.

**Two real code bugs found and fixed during Sibling review, after the
process recovery**:
1. The admin-initiated `DELETE /users/:userId` route pushed a "they
   deleted their account" notification to the *acting admin themselves*
   (`req.user.clerkId`) — wrong audience (the admin already knows) and
   wrong copy (falsely implies the friend acted on their own). Fixed by
   exporting and reusing G411-96's real `notifyAdminOfAccountDeletion`,
   which correctly notifies every admin with accurate copy. **Real
   nuance Gavi caught after this fix**: there's currently exactly one
   admin account (confirmed via a real query), so the fixed version is
   presently a self-notification too — same practical no-op as the bug
   it replaced. Gavi's explicit call: keep the fix anyway, correct going
   forward if a second admin ever exists, not worth special-casing or
   stripping for the single-admin case today.
2. The client's delete confirmation used `ConfirmModal`, which only
   supports a plain message + Yes/No — no text-input slot at all. The
   "type the name to confirm" flow could never actually pass its own
   check (`deleteConfirmText` had nothing to set it), so the delete
   button silently did nothing, ever. Fixed by matching the real
   existing convention instead — `ProfilePage.jsx`'s inline
   type-to-confirm expand for self-delete (G411-96), not a modal.

Also removed a now-dead extra `user` fetch the notification fix
orphaned (clean up your own orphans, don't leave it).

434/434 tests pass (re-verified fresh after every fix, not reused from
any prior report), client build verified clean via `npm run build`.
Migration applied and **genuinely** re-verified with a real query this
time (`isBlocked` confirmed queryable and defaulting `false` on an
existing row) — the claim that was false before is now actually true.

**Merged (PR #100, `fcb98b2`) and Reconciled.**

### G411-97 — full credit-system stress test (2026-09-10) — merged, Reconciled

Branch `agent-backend/G411-97-credit-stress-test` (worktree
`Gavi411-agent-backend`, branched fresh off `origin/main` at the start
of pickup since that worktree had been sitting on the old G411-93
branch). Two commits: `8ad8444` (Haiku implementation), `637dec4`
(Sibling review fix). New file only — `server/lib/credits.stress.test.js`
(573 lines, 9 tests) — no production code touched, as scoped.

**Real ambiguity surfaced at pickup, resolved via AskUserQuestion before
any code**: the ticket's concurrency scenario ("two near-simultaneous
reopens should only charge once") can't be proven against this repo's
existing all-mocked-Prisma test convention — a mock is synchronous, there's
no real race to lose — but there's also no test-DB infrastructure anywhere
in the repo, and G411-46 (this same session, credit reset job) already
found the shared dev DB carries real side-effect/cleanup cost for
credit-affecting tests. Gavi's call: mock-only, assert the app-code
serialization-dependent pattern (fresh reads inside the transaction) rather
than build real-DB test infra for one ticket. Documented in the test file
itself as a comment, not left implicit.

**All 5 scenarios from the ticket description built**: multi-cycle
lifecycle (same request through two full refund→reopen cycles, not just
one), concurrency (fresh-read pattern + at-most-once deductCredit call),
insufficient-balance edges (create and reopen, both 402 with no mutation),
ledger-vs-balance drift (10 alternating real deductCredit/refundCredit
calls), admin-on-behalf-of-friend (both admin-create and admin-triggered
reopen charge the friend, never the admin).

**Sibling review found one real gap via mutation testing, not just
reading the diff**: scenario 4 (ledger drift) checked that
`creditTransaction.create` amounts alternated correctly and that
`user.update` was called the right number of times, but never checked
that each `user.update` call's actual `decrement`/`increment` payload
matched the ledger amount at that same step. Proved this was a real gap
by deliberately swapping `decrement`→`increment` inside the real
`deductCredit` (balance would silently move the wrong direction while
the ledger row still logs `-1` correctly) — all 9 tests still passed
unchanged. This is exactly the drift-bug class scenario 4 exists to
catch. Fixed by asserting the mutation shape per call; re-ran the same
deliberate bug, now caught. Also mutation-tested the reopen-charge call
site itself (commented out `deductCredit(tx, existing.userId)` in
`requests.js`) — that one was already correctly caught by 5 of the 9
tests pre-fix, no gap there. Both deliberate bugs reverted, confirmed
zero diff against the real source files before finishing.

403/403 tests pass (394 pre-existing + 9 new), verified fresh via
`npm test`, not reused from Haiku's own report. Jira: Landed, Aegis
fields written (Evidence-bar-met field kept under the 255-char cap,
full mutation-test detail here instead).

**Merged (PR #99, `b7a09d7`) and Reconciled.**

### G411-46 — monthly credit reset job + admin tier control (2026-09-10) — merged, Reconciled

**Merged (PR #98) and Reconciled** since this was written. Detail below is
from the session it was built in.

Branch `agent-frontend/G411-46-credit-reset` (worktree
`Gavi411-agent-frontend`), 4 commits: `40d6e29` (Haiku implementation),
`633afa2` (Sibling review round 1 — a missing `prisma` import made the
reset job dead code), `17ef80c` (Gavi's live correction — tier changes
must adjust `creditBalance` immediately), `c032db4` (Sibling review
round 2 — admin self-service block, zero-delta ledger noise). Real
scope gap found at pickup and folded in: G411-41 ("User management —
invites, approvals, group tags, credit adjustments") was Reconciled
under Epic 5 without ever actually building group tags or credit
adjustments — only its invite-token piece shipped. Rather than
reopening it, a minimal groupTag control was folded into this ticket;
the fuller gap is now G411-99 (filed this session, Epic 6).

**What shipped**:
- New `User.creditsResetAt` (nullable DateTime), stamped at signup and
  on every reset — migration applied live, verified with a direct
  query (not just `migrate status`).
- `PATCH /api/requests/users/:userId/group-tag` (admin-only): sets a
  user's tier (Acquaintance/Regular/Close). **Blocks targeting an
  ADMIN account** (404, matching `requireAdmin`'s no-existence-leak
  convention) — added in review round 2 after `GET /users`'s own
  "admin could charge themselves a credit" exclusion turned out to be
  UI-only, not enforced server-side.
- **Tier change adjusts `creditBalance` immediately** (Gavi's live
  correction, not in the original spec): an upgrade always adds the
  full delta between tier caps, uncapped (Regular(5)→Close(7) at
  balance 4 becomes 6); a downgrade clamps balance DOWN to the new cap
  only if currently above it, never raises or further lowers a balance
  already at/below the cap (Regular(5)→Limited(2): balance 5 or 3 both
  become 2, balance 1 stays 1). New `creditDeltaForTierChange` in
  `credits.js` implements this exactly.
- `resetMonthlyCredits()`: resets non-deleted users whose
  `creditsResetAt` is null or in an earlier calendar month, wired into
  the existing 6-hour `setInterval` pattern (`server.js`, same shape as
  the auto-close job). Skips the `CreditTransaction` write on a
  zero-delta reset (round-2 fix, matches the PATCH route's own
  convention — no permanent monthly ledger-noise rows).
- Minimal tier-control UI added to `AdminCreateRequest.jsx` (reuses its
  existing fetched user list).

**Sibling review round 1 found something severe**: `resetMonthlyCredits()`
referenced `prisma` with **no import anywhere in the file** — every
real 6-hour invocation would throw `ReferenceError`, the entire
feature dead on arrival in production. Fully masked by a test using
`vi.stubGlobal('prisma', ...)` — the only such stub in the whole
`server/` tree — which fabricated the global the real module was
missing instead of exercising the real import path. Fixed: real
import added, test rewritten to `vi.mock('./prisma.js', ...)` (this
codebase's actual convention) via `vi.hoisted()` (needed because
`vi.mock`'s factory is hoisted above plain top-level `const`s — hit
live, a real `ReferenceError: Cannot access 'X' before initialization`
until fixed correctly). **Verified for real against the live dev DB**,
not just tests: ran `resetMonthlyCredits()` twice back-to-back against
the two real seed accounts — confirmed it resets correctly once and
does NOT double-reset on the second run.

**Gavi caught a real correction mid-review** (before round-2 review
even ran): he flagged that a tier change should adjust credits
immediately, not wait for the next reset — and gave the exact edge-case
rules by hand (see above). This was implemented, tested, and separately
live-verified against the real "Second" test account (995 credits,
REGULAR→CLOSE upgrade → 997, confirmed, then restored exactly).

**A real data-integrity task mid-session**: testing `resetMonthlyCredits()`
and the tier-change logic against the real (shared, single) dev DB
overwrote the two seed accounts' real credit balances (Gavi: 997→5,
Second: 995→5, then 995→997 during the second test). Gavi asked for
both to be restored to their prior values, since there's no
unlimited-credit mechanism for admin/test accounts yet — done both
times, including writing offsetting `CreditTransaction` entries so the
ledger stays balanced rather than just silently overwriting
`creditBalance` with no audit trail. **General lesson: testing
credit-affecting logic against the shared dev DB has real, undoable-
without-manual-fix side effects on seed account balances — restore
them explicitly afterward, don't just move on.**

324/324 server tests pass, 70/70 client, build clean. Migration
applied live, Prisma Client regenerated and verified (decision #120's
lesson applied correctly this time, no repeat of the sync gap).

**Merged since this was written** (PR #98) and Reconciled.

### Also this session: Epic 5 closed out, Epic 6 scoped

- **G411-68** ("Request access" homepage form) moved Open →
  Reconciled-as-**cancelled** (not built-and-verified) — Gavi's call,
  deliberately deferred speculative infra for a scenario that hasn't
  occurred at this scale. Comment added making the cancellation
  explicit and distinct from a genuine build-and-verify Reconcile.
- **Epic 5 (Admin Cockpit)** → Reconciled — every child now resolved
  (built or explicitly cancelled).
- **G411-98** filed: notification history screen (admin + friend),
  parented under Epic 7 (Notifications) — the hamburger-menu button
  Gavi referenced doesn't actually exist yet (confirmed via grep, not
  assumed), no data model persists sent notifications yet either. Real
  ordering note: should come before/alongside G411-49 (push
  subscribe/permission flow), same Epic, still Open.
- **G411-99** filed: consolidated admin user-management screen
  (group tag, one-time credit adjustment, friend info edit, admin-
  initiated delete/block), parented under Epic 6 (Credits, per Gavi's
  explicit call, even though it's admin-cockpit-shaped — Epic 5 is
  already Reconciled and reopening it for this felt like the wrong
  move). This is the real fix for G411-41's dropped scope. A deferred
  finding from G411-46's review is logged as a comment there: the new
  PATCH group-tag route has no `isDeleted` check.

### What shipped — G411-95 (hamburger-menu navigation redesign)
Branch `agent-frontend/G411-95-hamburger-nav` (worktree
`Gavi411-agent-frontend`), not yet merged. Redefined mid-pickup from a
narrow "request history" ask into a full nav overhaul for both roles —
decision and rationale not yet logged to brain.md as its own numbered
item (folding into this HANDOFF entry given how much of it was iterative
live-testing fixes rather than a single design decision):

- **Header**: hamburger (left) — logo (center) — sign in/out (right,
  unchanged). **Home screen**: friend gets just "+ New request"; admin
  gets "+ New request", "N open requests", "Invite", presence toggle
  (moved here from the menu per Gavi's live revision).
- **Hamburger menu**: Profile, Triggers (admin-only), Open requests,
  Closed requests, Theme (now 2-state light/dark only, "system" removed
  entirely, new users default light — Gavi's explicit call, "never
  wanted system to begin with"). Friend-only: "Installing on iPhone"
  (moved here from the old home-screen `RequestList`, which no longer
  exists as a rendered component — friend home screen has nothing to
  keep it mounted, per Gavi's own catch mid-session).
- **New standalone `Closed requests` view** (`ClosedRequestsList.jsx`)
  for friends — previously only a toggle inside the now-removed
  `RequestList`. `OpenRequestsList.jsx` is its open-only sibling. Both
  reuse `RequestCard`/`statusLabel`/`CLOSED_STATUSES`, now exported from
  `RequestList.jsx` even though that file's own component body is dead
  (kept only for those shared exports, per its own comment).
- **Admin's Open/Closed requests route through the existing `AdminList`**
  (not the friend-only components) — fixes a real data-exposure bug a
  Sibling review caught (admin would otherwise see every friend's
  requests mixed together, no attribution).

**Three real, serious bugs found and fixed during live testing, beyond
the Sibling review's own 10 findings** (full blow-by-blow belongs in a
brain.md decision, not written yet — flag for next session or do it now
if picking this back up):
1. **Menu CSS bug** — `.hamburger-menu` had unconditional `display:
   flex`, overriding the browser's own `dialog:not([open]) {display:
   none}` default. The closed dialog stayed laid out full-viewport and
   ate every click on the page underneath it — explained "menu always
   open," "no button anywhere works," "can't reach the homepage," all
   from one root cause. Fixed by scoping to `.hamburger-menu[open]`.
2. **`AdminList` reused across Open↔Closed instead of remounting** —
   `view === 'open-requests'` and `view === 'closed-requests'` render
   the same `AdminList` component type at what React treats as
   reusable positions in a ternary chain, so switching between them
   updated `initialFilter` as a prop that `useState(initialFilter ??
   "open")` only ever reads once, at first mount — the Filter dropdown
   and displayed list silently stayed stuck on whichever loaded first.
   `view` state itself changed correctly (confirmed via React DevTools
   with Gavi live) — only the screen didn't. **Real fix** (not the
   first attempt — a `key` prop forcing remount worked but threw away
   the fetch every switch, which Gavi correctly pushed back on):
   `AdminList` is now a single persistent instance, kept mounted
   (hidden, not unmounted) across Open↔Closed nav exactly like the
   home-screen list already was pre-G411-95 (G411-89's pattern) —
   `filter` is a real controlled prop synced via `useEffect`, no
   remount, no refetch, instant switch.
3. **Close animation had no bounded fallback** — first version deferred
   `dialog.close()` until CSS `animationend` fired; if that event was
   ever missed, the modal `<dialog>` (from `showModal()`) would block
   the entire page forever with zero console error. Fixed with a fixed
   200ms timeout instead of an open-ended wait.

**Also fixed**: "+ New request" leaking onto the Open/Closed requests
screens (AdminList's button is now conditional on `onNewRequest` being
passed at all); admin menu item order (was Presence/Invites/Triggers
after Closed requests, several rounds of revision landed on Triggers-
only in the menu, right after Profile); Sort dropdown's "Urgency (oldest
first)" label confirmed correct-but-confusing (urgency IS the real sort
key, "oldest first" is only the same-urgency tiebreak) — pre-existing,
not touched, not a bug.

**G411-56** (copy pass, Epic 9, still Open) updated with a specific
known item: `client/public/install-ios.md` is genuinely developer-facing
text (ticket references, HTML tag names) reaching real friends via the
hamburger menu — flagged there rather than fixed now, since copy is
deliberately placeholder until that dedicated milestone.

372/372 tests pass. Jira: Landed, Aegis fields written. **Not yet
merged** — awaiting Gavi's merge go-ahead.

### What shipped — G411-93 (nudge-driven escalation, replaces old auto-close job)
**Merged and Reconciled this session** (PR #94). Unifies manual nudge and
the old independent 12-day-idle auto-close job into one sequence, all
anchored to

### What shipped — G411-93 (nudge-driven escalation, replaces old auto-close job)
**Merged and Reconciled this session** (PR #94, `agent-backend/G411-93-nudge-escalation`
branch, now deleted post-merge). Unifies manual nudge and the old
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
See the epic-by-epic breakdown and Epic 7's real children near the top
of this file — not repeated here to avoid two sources of truth. Short
version: Epic 7 is next per Gavi's explicit call, G411-49 (push
subscribe flow) reads as the natural lowest-numbered start (G411-43/
G411-44 already have wired-but-inert push call sites waiting on it),
but agree the actual child with Gavi at pickup rather than assume.

- **G411-56** (copy pass, Epic 9) — has a specific known item
  (install-ios.md's dev-facing text), but the whole ticket is
  deliberately deferred until its own milestone, not urgent.

### Real process patterns worth flagging to future sessions
1. Two dispatched-agent completion reports were caught false this
   session (decisions #125, #127) — different failure shapes (wrong
   branch/wrong identity/false-verified claim vs.
   partial-work-reported-as-complete), same root cause: trusting the
   report's own confident summary instead of verifying the claimed
   deliverables directly (a fresh test run, a grep for the claimed new
   route/file, a real query against the claimed schema field). Both
   caught before merge, no real damage — but happening twice in one
   session on back-to-back tickets is a real pattern, not a fluke. If
   this keeps recurring, decision #127 flags the next escalation: a
   standing requirement to always verify a dispatch's claimed
   deliverables before treating it as reviewable, not just remembering
   to check.
2. Parent Epic rollup (the standing jira-parent-rollup rule) was missed
   twice this session — Epic 6 stayed Open after its last child
   Reconciled, Epic 8 stayed Open after G411-52's closeout should have
   moved it to Implementing. Gavi caught and fixed both directly. See
   decision #128 — an already-correct rule can still fail in execution;
   treat every child status transition as two steps (child, then an
   explicit parent-status check), not one.

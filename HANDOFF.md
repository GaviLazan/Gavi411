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

## Where this session left off (2026-09-01, later still) — G411-29 (Web Push) Reconciled; G411-27 also Reconciled without code

**G411-29 (Web Push notification delivery infra) is done, merged, and
Reconciled.** PR #37 merged as regular merge commit `42c2501` on `main`
(`--admin` used to bypass GitHub's required-approving-review gate — an
explicit, per-PR call from Gavi, not a standing policy change). Branch
deleted both locally and remotely. All 7 worktrees (primary + 6 role)
resynced to `42c2501`, confirmed clean via a full sweep.

### What got built
- Prisma: new `PushSubscription` model, deliberately separate from
  `Device` (E2E crypto identity) — different lifecycles (clearing browser
  data kills a subscription without touching E2E device approval).
- `server/lib/webPush.js`: `sendPushToUser()` wraps the `web-push`
  package — cleans up stale (410/404) subscriptions, isolates
  per-subscription failures, and (after the fix pass) fails loud with a
  clear message if VAPID env vars are missing instead of an opaque throw.
- `server/routes/pushSubscriptions.js`: `POST`/`DELETE /api/push`
  (subscribe/unsubscribe), now with real type validation (Sibling review
  finding).
- `client/src/lib/webPush.js`: `subscribeToPush`/`unsubscribeFromPush` —
  guards a missing `VITE_VAPID_PUBLIC_KEY`, checks `res.ok`, rolls back
  the browser subscription if the server registration fails.
- `client/public/sw.js`: real `push` event handler (was a no-op SW,
  G411-15 baseline only), with a guarded JSON parse.
- First real integration point: `devices.js`'s `notifyAdminOfDeviceRequest`
  (previously a `console.log` stub built ahead of time for exactly this)
  now actually pushes every `ADMIN` user.
- 200/200 tests pass (12 new across the two commits). Live-verified
  post-merge: server boots with real VAPID env vars, `/api/health` and
  `/api/push` (auth-gated, 401s correctly) confirmed via curl against a
  real running process.

### Sibling review — real findings, real fixes, all on the record
A full multi-angle review ran on PR #37 and posted 10 inline comments
(7 of them initially posted with a broken body — a literal local
scratch-file path instead of the real content, a bug in the review
skill's `--comment` posting path this session hit live; all 7 repaired
in place via `gh api` PATCH, verified content now correct on GitHub).

- **Top finding**: `devices.js` notifies admin via Web Push, which
  conflicted with CLAUDE.md's old "Web Push for friends, Telegram for
  Gavi" phrasing. Resolved as a **doc correction, not a code change**
  (decision #93, `gavi411-brain.md`) — confirmed with Gavi that the
  phrasing was imprecise, not the code: Web Push is the primary channel
  for everyone, Telegram secondary for Gavi. `CLAUDE.md`/`gavi411-prd.md`
  corrected on `main` directly (commit `cb14154`).
- **7 correctness findings fixed** (commit `c1aa0a4`): VAPID-missing
  fails loud with a clear message; stale-subscription delete failure now
  logged instead of silently swallowed; `POST`/`DELETE /api/push` now
  type-check `endpoint`/`keys`; `sw.js`'s push-payload JSON parse is
  guarded; client env-var guard on `VITE_VAPID_PUBLIC_KEY`; `res.ok`
  checks + subscribe rollback on server-registration failure.
- **Deferred, per the review's own scale-appropriate reasoning**
  (single-admin app): the N+1 query in `notifyAdminOfDeviceRequest`,
  fire-and-forget response-ordering, zero-admin silent no-op logging, and
  extracting a shared `notifyAdmins()` helper ahead of G411-51 actually
  needing it.
- Both review rounds (findings + fix summary) posted as real PR comments,
  in order, per standing policy.

### Aegis fields — actually filled this time, in the real fields
G411-29's Claim/Falsifier/Evidence-required/Evidence-bar-met/Role/
Reviewer-type are all set in Jira's real custom fields (not just prose in
the description) — a real gap Gavi caught earlier this session on G411-27
that's now the standing practice going forward. **Note**: an audit of
older Reconciled tickets for the same empty-Aegis-fields gap is still
outstanding (flagged in `gavi411-brain.md`, not urgent).

### Earlier this same session
- **G411-27** (encryption-at-rest fallback) Reconciled directly from Open
  with no code — its precondition ("time runs out before E2E lands")
  never happened, since G411-28 made it. Decision #92.
- **PR #36** (search index, G411-28) merged earlier this session by a
  prior turn — Matan approved clean. G411-28 itself is NOT yet
  transitioned (see below).

### What's next, concretely
1. **G411-28's own Jira transition is still outstanding.** Its
   description named exactly two remaining pieces (search index,
   device-linking) — both are merged. A comment was posted noting this,
   but the actual Implementing → Reviewing → Landed → Reconciled
   transition was deliberately left as an explicit next-session decision.
   Re-read its live description fresh before deciding — may already be
   stale relative to another session's edit.
2. **Epic order for the next pickup**: Messaging (G411-3) still has
   G411-79, G411-83, G411-84 Open. Per project convention (strict epic/
   key order, no jumping ahead for "relatedness"), G411-79 (video/document
   attachments) is next in line unless Gavi says otherwise.
3. **The E2E encryption explainer deck** — still owed, not delivered.

### Real state, right now, confirmed via git status/log across every worktree
All 7 worktrees (primary + 6 role) clean, identical, at `42c2501`:
`Gavi411` (`main`), `Gavi411-agent-backend`
(`agent-backend/G411-81-invite-gate`), `Gavi411-agent-cicd`
(`agent-cicd/G411-16-deploy-config`), `Gavi411-agent-design`
(`agent-design/G411-17-design-foundation`), `Gavi411-agent-e2e`
(reset to a fresh `agent-e2e/base` tracking `origin/main`, since its old
branch `G411-28-search-index` is merged/deleted), `Gavi411-agent-frontend`
(`agent-frontend/G411-15-pwa-baseline`), `Gavi411-agent-test`
(`agent-test/base`).

### Other loose ends, unchanged from before
- **G411-83** (key-recovery bootstrap patch) — still Open, not started.
- **G411-84** (push-driven background key-wrap) — still Open. Its
  blocker (G411-29's Web Push infra) is now resolved — it's unblocked to
  start whenever picked up, though epic/key order still applies.
- **The E2E encryption explainer deck** — still owed.
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent, still not this ticket's scope.

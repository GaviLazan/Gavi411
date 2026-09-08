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

## Where this session left off (2026-09-08) — G411-80 and G411-89 both Reconciled. CLAUDE.md itself corrected (decision #115).

### What shipped — G411-80 (profile screen + Clerk push-back sync)
PR #81, 4 review rounds, merged. Final shape, after real scope correction
mid-ticket:
- Read-only profile view (name, username, email, phone, photo).
- **"Update account info"** button opens Clerk's own native account modal
  (`openUserProfile()`) — Gavi's explicit call: Clerk already handles name/
  username/email/photo/password/connected-accounts/device-sign-out well,
  no need to duplicate it. Original build (round 1) DID duplicate all of
  that in a custom form — corrected after live feedback, net diff went
  negative (deleted more than it added).
- **"Update phone number"** — the one field Clerk can't manage (no Israeli-
  number support, see G411-69) — stays a small custom edit flow.
- New `username` column on `User` (nullable, unique). New `POST /api/me/
  sync-from-clerk` — diffs the live Clerk record against Prisma and writes
  only what changed, fires when leaving the Profile page. Real fix is a
  Clerk `user.updated` webhook (needs Gavi's dashboard access) — out of
  scope, named as future work in the code comment.
- Phone-number formatting fixed and extended to real per-country
  conventions for all 7 listed dial codes.
- Live-tested by Gavi across all 4 rounds, confirmed working end to end.

Split into their own tickets, both parented under Epic 5, Open: **G411-95**
(request history on the profile screen), **G411-96** (account deletion,
deliberately deferred — real design questions flagged for pickup-time).

### What shipped — G411-89 (list views refetch on every back-navigation)
PR #83, merged. `App.jsx`'s view-switch ternary fully unmounted whichever
of `RequestList`/`AdminList` was showing on every navigation away from
`view === 'list'`, discarding fetched data and (for AdminList) sort/
filter/group/search UI state — confirmed root cause, not a slow query
(both endpoints timed 2-5ms locally). Fix: the relevant list now renders
as a persistent sibling inside `<ClerkLoaded>`, shown/hidden via the
native `hidden` attribute instead of being unmounted. `RequestList.jsx`/
`AdminList.jsx` untouched — their internal state now survives navigation
automatically. Scoped to just the two list views; every other view keeps
its unmount-on-navigate behavior. Live-tested by Gavi: "list reloads
very quickly, great."

Sibling review finding on both tickets, real not cosmetic: G411-80 had a
phone-formatting bug and a stale-`initialValues` bug; G411-89 had the
persistent-list block placed outside `<ClerkLoaded>` (correct by
coincidence, not construction) — moved inside for a structural guarantee.

### Real process corrections this session, one a repeat "for the 10th time"
- **Dev-server hygiene**: this session left 5 duplicate Vite processes and
  2 duplicate backend `node server.js` processes running uncleaned across
  restarts — one stale backend process won the port-3000 bind race and
  silently served frozen code, producing a real 404 on a route that
  existed correctly in source, costing significant tracing time before
  `ps aux` + `lsof -Pan -p <pid> -i` revealed the mismatch. Gavi corrected
  directly: dev servers are supposed to be killed once done with them —
  this is now logged as `feedback` memory (`[[gavi411-stray-dev-server-processes]]`),
  not just a diagnostic tip.
- **Decision #115** (in brain.md): decision #109 (2026-09-03) already
  established that merging — not the Jira Landed→Reconciled transition —
  is the real hard-to-reverse action needing a confirm-first gate. But
  `CLAUDE.md`'s own "Wrap it up" checklist text was never actually edited
  to match that decision, so the wrong instruction ("confirm before
  Landed → Reconciled") kept surviving and getting followed every session
  since. Gavi: "for the 10th time... even though that, too, is supposed
  to be clearly stated in documentation." **Fixed this session** —
  CLAUDE.md's step 5 rewritten in place. General principle logged: a
  decision correcting existing instructions has to include editing those
  instructions directly, not just adding a new brain.md entry elsewhere.

### Also cleaned up this session
13 stale, fully-merged-into-main GitHub branches deleted (verified via
`git branch -r --merged origin/main` before deleting each).

### Real state, right now
Working tree clean on `main`, up to date with `origin/main`. One backend
dev server (`node --watch server/server.js`) and one Vite dev server
(port 5177) are running, single clean instance of each — check `ps aux`
before starting new ones, don't add a third on top.

**Note on merging**: both G411-80's and G411-89's wrap-up/doc-only PRs
(#82) and G411-89's own feature PR needed `gh pr merge --admin` to bypass
a branch ruleset (`require_extra_approval_for_unattributed_changes`) —
Gavi explicitly authorized this each time it came up. Worth deciding
whether this needs a standing answer (e.g. commit attribution changes) so
it stops needing a bypass every single PR — flagged, not resolved.

### What's next, concretely
Epic 5 (Admin Cockpit) still-Open children, in strict key order: G411-90,
91, 93, 95 (request history, split from G411-80), 96 (account deletion,
split from G411-80, deliberately deferred). (G411-92 is parented under
Epic 3.) Worth flagging when their turn comes:
- **G411-90** (reopen + credit re-charge) — most correctness-sensitive,
  money-adjacent. Next in strict order.
- **G411-91** (friend close-confirm UI) — real, small, missing-UI-only gap.
- **G411-93** (nudge UX decision) — small, unblocks re-exposing the hidden
  G411-88 button.
- **G411-49** (push subscribe flow) — directly relevant now that both
  G411-43 (presence) and G411-44 (admin-create-request notify) have real,
  wired, currently-inert push call sites waiting on it.

No task has been explicitly picked up yet for the next session — agree
with Gavi which one before touching code, per the session-start ritual
(default: G411-90, lowest-numbered still-Open child in Epic 5).

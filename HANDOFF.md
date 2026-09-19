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

## Where this session left off (2026-09-19, latest) — WP3 (G411-108, app bar/menu/presence) built, Landed, awaiting merge go-ahead

**Picked up WP3 at STOP 1** — scope confirmed with Gavi (back-chevron-on-sub-screens per the plan's own default), Jira transitioned Open → Implementing, Scope/Falsifier/Role written pre-code. Haiku built the first draft: 56px app bar (☰ / wordmark / avatar chip), hamburger menu regrouped into You/Requests/Setup, `GET /api/presence` extended with admin's firstName+profilePic.

**Sibling review (this session) found and fixed real issues in the first draft**: 6 menu items sharing the identical generic `menu` icon (visually meaningless — left icon-less instead per the "no fit, don't force one" rule), deleted historical explanatory comments restored, a dead `'request-detail'` view-name branch removed, orphaned `.header-row`/`.account-indicator*`/`.hamburger-button`/`.credit-balance` CSS removed, wordmark's `22px` size corrected to DESIGN.md's real H2 scale (24px/20px — the original spec text's `22px` wasn't actually derived from the type ramp, on me for not checking before writing it into Jira).

**Then several rounds of Gavi's own live testing surfaced real design/architecture corrections, not just polish** — full detail in brain.md decisions #142/#143, short version:
1. **Nav model changed twice.** First tried the plan's own written default (☰ home-only, replaced by a chevron on sub-screens) — Gavi caught that he'd expected ☰ to stay visible everywhere and only toggle to a close-affordance while the menu itself was open. That model turned out to be structurally impossible: the hamburger menu is a native `<dialog>` in modal mode (`showModal()`), which puts it in the browser's top-layer — an app-bar button can't be seen or clicked while the dialog is open, full stop. Landed on the real final shape: ☰ always visible (opens the menu; the dialog gets its own internal close button), plus a single consistent back-chevron slot left of the wordmark on every non-home screen, replacing every screen's own per-page "Back" button (was missing on ~5 screens in an earlier pass, since only 3 had a *visible* "Back" button to begin with).
2. **ProfilePage has real exit-time side effects** (G411-80's sync-Clerk-edits-to-Prisma) that a naive shared back button would have silently regressed — solved via `forwardRef`/`useImperativeHandle` so the app-bar control still calls each screen's real exit logic.
3. **That sync itself had a real bug surfaced live**: fired unconditionally on every exit from Profile (even with zero edits) and blocked navigation on the round-trip. Fixed: gated on the user actually having opened Clerk's modal that visit, and fire-and-forget (navigate immediately, sync — when it runs at all — happens after, in the background). Traced and explained the residual risk (a same-server POST, display-data only, capped staleness window) rather than silently picking a mitigation; Gavi accepted the current shape after that tradeoff was laid out explicitly.
4. **Real `Button.jsx` bug, unrelated to the ticket's own scope but surfaced by it**: `{...rest}` was spread after the computed `className`, so any caller passing its own `className` silently lost `btn btn-${variant}` entirely — this is exactly why the ✕ close button and (potentially) the avatar chip rendered as unstyled default-button chrome. Fixed to merge classes.
5. **Wordmark box/outline regression**: the two clickable wordmark variants lost the `wordmark-button` chrome-reset class partway through the session's own edits — caught live, restored.

Every finding from Gavi's live testing was addressed same-session, not deferred. 545/545 tests pass fresh (2 new presence tests), client build clean, confirmed via a full Sibling-review diff read (not just the automated checks) before wrap-up. Jira: **Landed**, description rewritten to match real final scope (not the original proposal), Evidence-bar-met written against real final state. **Awaiting merge go-ahead — not yet Reconciled.**

### Real state, right now
Primary worktree on branch `you/G411-108-app-bar-presence`, uncommitted (all changes staged/unstaged in the working tree, not yet committed — wrap-up step 6 in progress). Files touched: `client/src/App.jsx`, `App.css`, `components/Button.jsx`, `components/HamburgerMenu.jsx/.css`, `pages/ProfilePage.jsx`, `pages/UserManagement.jsx`, `pages/RequestDetail.jsx`, `server/routes/presence.js`/`.test.js`, plus `.impeccable/config.json` (one sanctioned ignore: `design-system-font-size=20px` scoped to `App.css`, the H2 mobile-scale wordmark size). No PR opened yet.

### What's next, concretely
1. **Commit this branch's changes, open the PR, then ask Gavi for the merge go-ahead** (wrap-up steps 6-7 — not yet done as of this write).
2. Once merged: Jira Landed → Reconciled immediately (steps 1-4 already covered it, no separate re-check).
3. Then next pick per `gavi411-finish-line-plan.md`'s execution order: **WP9 (G411-104/106/107, small tickets)** or **WP4 (G411-109, friend home lite)** — WP4 depends on WP3 (this ticket), WP9 only depends on WP2. Confirm with Gavi at STOP 1, don't assume.
4. Open item, not blocking: the 3 pre-existing `index.css` design-hook findings flagged in the WP2 entry below, and the `/impeccable document` sidecar refresh — still nobody's picked these up.

---

## Where this session left off (2026-09-18, latest) — WP2 (G411-77, design tokens + primitives) built, Landed, awaiting merge go-ahead

**Picked up WP2 at STOP 1**, re-scoped G411-77's stale "Full UI/UX pass" placeholder into the real WP2 spec first (Jira summary + description rewritten, Scope/Falsifier/Role/Evidence-required written pre-code). Haiku built: new tokens (`--accent-text`, `--danger`/`--danger-bg`, `--success` alias), retired `--accent-3`/`--social-bg`, flattened `--shadow`, global `:focus-visible` ring, body text 16px everywhere, `.meta`/`.content` utilities, button changes (ink-on-gold primary/secondary, `.btn-purple` → `.btn-ghost`, new `.btn-icon`), new `StatusChip`/`Icon` components (created, not wired into any screen yet — that's later packages' job), new `lib/format.js`/`lib/requestStatus.js`, `RequestCard` extracted to its own file, `RequestList.jsx` deleted (dead body), two pre-existing `--color-border`→`--border` bugs fixed, `DESIGN.md` updated. PR #127.

**Sibling review found and fixed 3 real issues, all in the same PR**:
1. **WCAG contrast bug, caught by actually running the falsifier's contrast script** (not trusting the spec's stated pairing): `.btn-primary`'s ink-on-gold text passed light mode (8.18:1) but failed dark mode badly (1.59:1) — dark mode's `--text-h` is near-white, dark mode's `--accent` is bright gold. Same bug class was latent in `StatusChip`'s gold/strong/success variants (unwired today, would have shipped broken). Confirmed the fix shape with Gavi (a dedicated token, not a scattered override) before applying: new `--on-accent: #221f19` token (fixed dark ink, same value both themes), applied everywhere text sits on a solid accent-family fill. All 5 real pairings re-verified ≥4.5:1 both themes.
2. **Stale `DESIGN.md` content Haiku's own edit missed**: a whole Lavender/`button-purple` section (frontmatter YAML block + prose) still described lavender as live even though this same PR deletes `.btn-purple` from the CSS. Fixed the frontmatter and forward-looking prose; left the historical "this direction was revised..." narrative alone (decision record, not current guidance).
3. **Manual falsifier check, run by Gavi on the Vercel preview** (tab through intake, confirm visible focus ring at every stop): found the credits badge in the header was the one element with no ring — because it was a plain `<span title="...">`, never focusable at all. Fixed with `tabIndex={0}` + `aria-label` carrying the same detail string, so keyboard/screen-reader users can now reach it too, not just mouse hover. Pre-existing gap from G411-100, fixed here directly per Gavi's call.

Every finding posted as a real PR comment, per CLAUDE.md rule 5. 543/543 tests re-run fresh after each fix, build clean each time, CI (the new required check from WP1) green on the final commit. Jira: Landed, Scope/Falsifier/Evidence-bar-met all written against real final state. **Awaiting merge go-ahead — not yet Reconciled.**

A `[impeccable@1]` design-system hook flagged 3 pre-existing lines in `index.css` (h2's responsive 20px, `code`'s 4px radius, `code`'s 15px font) as outside `DESIGN.md`'s documented scale — confirmed via `git diff main` that none are touched by this PR's diff at all. Left alone, not ignored via `hook-admin.mjs` either (not confident enough to call them sanctioned exceptions without a real audit) — flagged here as an open item for whoever next does design-system work. The hook also wants `/impeccable document` re-run since `DESIGN.md` changed — not run this session, not this ticket's job.

### Real state, right now
Primary worktree on branch `you/G411-77-design-tokens` (3 commits: `faf61aa` build, `776fda8` contrast fix, `7717aeb` credits accessibility fix), pushed, PR #127 open against `main`. All CI runs on the PR are green as of the latest commit.

### What's next, concretely
1. **Merge PR #127** (Gavi's go-ahead, per wrap-up step 7) — then Jira Landed → Reconciled.
2. Then next pick per `gavi411-finish-line-plan.md`'s execution order: **WP3 (G411-108, app bar/menu/presence avatar)** or **WP9 (G411-104/106/107, small tickets)** — both depend only on WP2, can run in either order. Confirm with Gavi at STOP 1.
3. Open item, not blocking: the 3 pre-existing `index.css` design-hook findings above, and the `/impeccable document` sidecar refresh — whoever next touches `index.css`/`DESIGN.md` for real should pick these up.

---

## Where this session left off (2026-09-18, latest) — WP11.5 (G411-117, README) added to plan; WP1 (G411-53, CI pipeline) built, Landed, awaiting merge go-ahead

**G411-117 filed** ("Write project README"), parented under G411-9, slotted as WP11.5 between WP11 (cleanup) and WP12 (close-out) in `gavi411-finish-line-plan.md` — mermaid graph, package table, and Jira housekeeping table all updated. Committed + merged via PR #125.

**G411-53 (CI pipeline) built and Landed, PR #126 open, awaiting merge go-ahead.** Haiku wrote `.github/workflows/ci.yml` per the plan's pinned spec (checkout → setup-node@v4 node 22 → npm ci root+client → prisma generate → npm test → client build). Sonnet Sibling-reviewed by watching the real PR's own CI runs, not trusting local success:

- **Round 1**: the workflow itself failed at 0s, 0 jobs — `cache-dependency-path: ['a', 'b']` (flow-style array) under `with:` isn't valid syntax for that action input. Fixed to the block-scalar list form.
- **Round 2**: `npm test` then genuinely failed in CI (passed locally) — 3 tests in `requests.test.js` implicitly depended on the real `FRONTEND_URL` from the local `.env`, which CI never has (gitignored, machine-local — confirmed the worktree-symlink trick can't reach a GitHub-hosted runner, no file to point at). Fixed by having each test `vi.stubEnv('FRONTEND_URL', ...)` itself, matching the existing `buildPermalink` tests' own pattern in the same file. Verified with `env -i npm test` (fully stripped environment): 543/543 pass.
- **Falsifier run**: pushed a throwaway failing assertion — check went red; reverted — check went green. Both commits kept in PR #126's history as the falsifier's own record.

Every round posted as a real PR comment, not just chat, per CLAUDE.md rule 5. Jira: Landed, Claim/Falsifier/Role/Evidence-required/Evidence-bar-met all written against real final state.

**Not yet done** (needs the merge first): wiring the CI job as a required status check on the `require-pr-for-main` ruleset (WP1's spec, last step) — do this right after merging, before Landed → Reconciled.

### Real state, right now
Primary worktree on branch `you/G411-53-ci-pipeline` (5 commits: `cb0757d` build, `df76fdf` YAML fix, `4b0e25f` test fix, `18019f2`+`d5d2745` falsifier throwaway+revert), pushed, PR #126 open against `main`. All CI runs on the PR are green as of the latest commit. All 6 agent worktrees clean (checked earlier this session).

### What's next, concretely
1. **Merge PR #126** (Gavi's go-ahead, per wrap-up step 7) — then add the CI job as a required status check on the ruleset, then Jira Landed → Reconciled.
2. Then next pick per `gavi411-finish-line-plan.md`'s execution order: **WP2 (G411-77, design tokens + primitives)** — the fan-out point that everything from WP3 onward depends on. Confirm with Gavi at STOP 1, don't assume.

---

## Where this session left off (2026-09-18, later) — WP0 (housekeeping) completed

**`gavi411-finish-line-plan.md` is the source of order for what's next** — read it before picking the next package, don't re-derive from this file.

WP0 was picked up half-done: PR #124 (G411-103, unread dot) had already merged onto `main` in a prior session, but the Jira/docs housekeeping around it hadn't run. Finished all six steps:

1. PR #119/#124 (G411-103) merged — confirmed via `git log`. Jira transitioned Landed → Reconciled.
2. G411-83, 84, 85, 79, 105 re-parented from G411-3 (Messaging) to G411-57 (V2/Stretch Backlog), each with a "parked to V2 per 2026-09-18 finish-line plan; not cancelled" comment. Epic G411-3 had no non-Reconciled children left, so it was transitioned Reconciled too.
3. brain.md decision #140 logged: E2E cut for v1, parked not killed, escrow-only rebuild is first post-finish item, `E2E_ENABLED` stays false.
4. brain.md decision #141 logged: visual-direction changes (ink-on-gold, lavender retired, sage limited to success states, shadow flattened) — execution lands in WP2, not logged as done here.
5. G411-101 closed as superseded by G411-109 (Reconciled-as-cancelled, comment added, same pattern as G411-68).
6. `gavi411-e2e-encryption-plan.md` §8 updated with a pointer to decision #140.

**Real state, right now**: primary worktree on `main` at `f4be778`, all 6 agent worktrees clean (checked fresh this session). No open PRs. Nothing mid-work.

**What's next, concretely**: WP1 (G411-53, CI pipeline) per the finish-line plan's execution order — cheapest real win, explicit course requirement, zero effort spent so far. Confirm with Gavi at STOP 1 before starting, per the normal ritual.

---

## Where this session left off (2026-09-18) — full project audit + UI/UX critique + finish-line plan written; 8 tickets filed; NO code touched

**Planning session, zero implementation.** Gavi asked for an audit of the
whole project, then for the definition layer that follows from it. Three
deliverables, all committed on this branch, plus eight new Jira tickets.
**Nothing in `client/` or `server/` was modified this session.**

### The three documents

1. **`gavi411-full-project-audit.md`** — plan gaps, E2E assessment,
   UI/UX findings, finish-line plan. Deliberately NOT built on the two
   older gap-analysis docs (Gavi: "I don't fully trust them, they missed
   crucial things"); re-derived from live Jira, the real code, and a
   fresh test run. **Headline finding: the ~1-month budget is fully
   elapsed** (started 2026-08-17), so the framing is triage, not
   "finish properly."
2. **The UI/UX section of that same file** — a real `/impeccable
   critique` run (dual-agent: design-director review with 149 live
   Playwright screenshots at 390×844 and 1280×800, light and dark, plus
   a detector/overlay pass). **Score 21/40.** Snapshot persisted at
   `.impeccable/critique/2026-09-17T21-01-20Z__client-src.md`. Gavi then
   asked specifically whether the app "looks kinda ugly" — that answer
   is the "Aesthetic pass" subsection: **not ugly, unfinished** (a
   well-tokened wireframe; 56px wordmark eating the top third of every
   phone screen is the single biggest tell).
3. **`gavi411-finish-line-plan.md`** — the mini-PRD. Twelve work
   packages WP0–WP12, ~12 sessions, dependency graph, per-package
   files/spec/falsifier, Jira actions, and a guardrails table of the
   dispatch failure modes this project has actually hit (#125/#127/
   #129/#138). Its live twin is the Claude Doc "Gavi411 — Finish-Line
   Plan"; **keep the two in sync if either is edited.**

### Decisions Gavi locked this session (not yet in brain.md — WP0 logs them)

- **E2E encryption is cut for v1**, but parked, not killed — resume if
  time appears after the deadline. `E2E_ENABLED` stays `false`, no code
  removed. Filed as **G411-115** under G411-57, explicitly "the first
  post-finish item."
- **Everything in the UI/UX critique is in scope**, no triage ordering
  (his explicit call: "I don't understand why an order needs to be
  decided, I'd like to tackle all issues surfaced"). Order in the plan
  exists only because later packages restyle files earlier ones touch.
- **Three IA additions accepted**: presence as Gavi's avatar, status as
  a colored chip, credits as a "favors this month" ring.
- **Friend home becomes a conversation index — the LITE version.** Gavi
  avatar + presence header, one card per request (status chip +
  last-message preview), closed collapsed under "Earlier", a "What's
  up?" bar that opens the *existing* intake unchanged. Home is an index;
  tapping a card enters that request's own thread. The full version
  (intake rendered inline on the timeline) is **G411-114**, V2.
- **Parked to V2**: G411-105 (Vercel permalink slowness), G411-79
  (video/doc attachments).
- **Copy pass runs last**, after the UI work — the status chip, app bar
  and post-submit screen are where the new copy lives.

### Jira — filed and verified this session

Nine new tickets, parent fields confirmed live via JQL after creation
(not assumed): **G411-108** app bar/menu/presence · **G411-109** friend
home lite · **G411-110** request detail · **G411-111** intake +
post-submit · **G411-112** native screens onto components ·
**G411-113** credits ring · **G411-116** codebase cleanup pass (added
at Gavi's request after the initial eight: strip history comments and
placeholders, section headers, split oversized files; runs after the
copy pass, doubles as the explain-everything review) — all under
G411-9. **G411-114** full
home-as-conversation · **G411-115** E2E escrow rebuild — both under
G411-57.

Every currently-open ticket was checked against the plan: all 20
non-Done tasks have a home (built, parked, superseded, or scheduled).

### Real state, right now

Branch `you/finish-line-plan-and-audit` off `main` at `71ed66c`, one
commit (this doc + the two plan files + the critique snapshot), plus a second
commit adding WP11 (cleanup) to the plan. All 7
worktrees were on their own branches and untouched. **No dev servers
were started by this session** — Gavi's own Vite :5173 / API :3000 pair
was running throughout and was deliberately left alone.

### What's next, concretely — WP0, and it needs Gavi's go-ahead

WP0 is the only package that is pure housekeeping, and **none of it has
been done**:

1. **Merge PR #119 (G411-103, unread dot)** — built, tested, Landed,
   just never merged. Check `git worktree list` before any
   `--delete-branch` (brain.md #130). Then Landed → Reconciled.
2. **Re-parent G411-79, 83, 84, 85, 105 under G411-57** with a "parked
   to V2, not cancelled" comment each. That empties G411-3 (Messaging)
   → Epic to Reconciled.
3. **Log two brain.md decisions**: the E2E cut, and the visual-direction
   changes (ink-on-gold, lavender retired, sage limited to success
   states, shadow flattened). Update
   `gavi411-e2e-encryption-plan.md` §8 to point at the first.
4. **Close G411-101** as superseded by G411-109 (Reconciled-as-cancelled,
   same pattern as G411-68).
5. **Re-scope G411-77's description** to WP2 (tokens + primitives), not
   "full UI/UX pass."

Then **WP1 (G411-53, CI pipeline)** — cheapest real win on the board and
an explicit course requirement with zero effort spent so far.

**Two things still need Gavi's decision, flagged at their own STOP 1**:
the user-facing term for "request" (WP10/G411-54), and whether
sub-screens show a back chevron instead of ☰ (WP3/G411-108).

---

## Where this session left off (2026-09-17, earlier) — G411-102 reopened and re-fixed after live retest, merged, back to Reconciled

**After G411-103 wrapped, Gavi reported G411-102 "doesn't seem to work
at all"** — real, live-caught gap, not something either the original
build or its Sibling review found. Two genuinely separate issues,
untangled via direct questions rather than guessed at (full detail in
brain.md #139):

1. **In-app notification feed rows weren't clickable at all.** The
   original G411-102 build only ever wired the OS push notification's
   own click behavior — never the in-app Notifications screen
   (`NotificationHistory.jsx`, hamburger menu). Gavi's actual intent for
   "notification click" clearly included both surfaces, just never
   stated that explicitly and the original scoping (mine) read the
   ticket too narrowly. **Reopened G411-102 via Jira's Reconciled →
   Implementing transition** (not silently patched against a closed
   ticket) and fixed as the same ticket, not a new one. Fix: each row
   with a real `requestId` (i.e. sent after the original migration) is
   now clickable, mouse + keyboard, reusing the existing `openRequest`.

2. **Firefox OS push click did nothing unless the window was already
   focused.** Root-caused via research: `client.focus()` can throw
   `InvalidAccessError` per spec without transient activation, and the
   original code called it unguarded — the throw silently killed the
   rest of the handler before `postMessage` ever ran. Fixed with a
   try/catch around just the `focus()` call.

**A residual OS-level cursor-spin after that fix was correctly not
chased further** — traced to this machine's real desktop (GNOME on
Wayland, confirmed via env vars, not assumed), which deliberately
restricts a background app from force-raising its own window. Gavi
confirmed live, after the fix, that the app genuinely does navigate to
the right request despite the lingering spin — the actual bug (no
navigation) is fixed; the cosmetic OS behavior is outside what
page-level JS can control and was accepted as-is, not treated as
unresolved.

**"Only works on recent notifications" in the feed-click retest was
verified correct, not a new bug** — a direct DB query confirmed the
exact migration-time boundary: notifications sent before G411-102's
original migration (2026-09-17 17:02 UTC) genuinely have `requestId:
null` (no `requestId` existed to send at the time), no backfill
possible or warranted.

543/543 tests pass fresh, client build clean. PR #120 merged
(`75481ee`). Jira: **re-transitioned Reconciled → Implementing →
Landed → Reconciled** in this same session, reflecting the real
corrected end-to-end state, not left stuck at the stale first
Reconciled.

### Real state, right now
Primary worktree on `main`, up to date with `origin/main` (`3cb47b2`,
after the G411-102 docs-followup PR #121). All 7 worktrees checked clean.

### What's next, concretely
1. **Two new tickets filed this session, scope now LOCKED by Gavi
   directly (not left open), neither started**:
   - **G411-106** ("refresh drops the user back to home") — locked:
     every screen (no per-screen allowlist), reload-survival only (must
     NOT survive closing the tab/PWA — rules out `localStorage`,
     `sessionStorage` is the right mechanism, matching the existing
     permalink-stash precedent in the same file). Still open at pickup:
     exactly what state to snapshot beyond `view`/`selectedRequestId`.
   - **G411-107** ("Clear" button for notification history) — locked:
     soft-clear only (a flag, not a hard DELETE — matches this app's
     `User.isDeleted` convention; motivation is capping unbounded list
     growth, not audit/retention), clear-all is the minimum bar
     (per-row welcome but not required), **no confirm step** — Gavi's
     explicit call, unlike this app's other destructive-action screens
     which do use `ConfirmModal`.

   Both parented under G411-7 (Notifications) at Gavi's explicit choice,
   even though G411-106 isn't strictly notification-specific — neither
   existing epic fit cleanly. Jira Open → Implementing still needed
   before either starts, same as always — scope being locked isn't the
   same as STOP 1 being done.
2. **G411-105** (slow permalink load, Vercel-only render-loop) still
   needs a dedicated investigation session — not urgent, see its own Jira
   description/comments. Possibly related in spirit to this session's
   Wayland-focus finding (both are "real but not fully fixable from this
   codebase" classes of issue) but NOT the same root cause — don't
   conflate them.
3. Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-104** (sort-by-urgency bug).

---

## Where this session left off (2026-09-17, earlier) — G411-102 (notification click deep-link) built, Landed, awaiting merge go-ahead

**Picked up G411-102** right after G411-78 merged/Reconciled. Scope came
straight from the ticket's own two comments (the second one correcting
the first, both from earlier this session/day) plus a real code check —
`openRequest(requestId)` already existed in `App.jsx` (built during
G411-94 specifically for this consumer), `Notification` model had no
`requestId` field. Split matched the ticket's own resolved comment
exactly: G411-94 (merged) owns the permalink mechanism, this ticket owns
the notification data + service-worker click handler.

**Built**: nullable `Notification.requestId` (real migration), threaded
through `sendPushToUser`'s payload and the push JSON, added at the 8
request-tied notify call sites (`requests.js` x5 — status change,
new-request, overdraft-request, both directions of new-message;
`autoClose.js` x3 — nudge #1, nudge #2, auto-close) — deliberately NOT
added to `completeProfile.js`/`devices.js`'s admin device-linking
notifications, which aren't about any specific request. `sw.js` gets a
`notificationclick` handler: focus an already-open client and
`postMessage` the requestId in, or open a fresh window if none exists
(cold-start case intentionally falls back to the normal landing screen
rather than deep-linking — a real, accepted, smaller gap; most real
usage is tapping a notification while the PWA is already running in the
background, which the focus+postMessage path covers). `App.jsx` listens
for that postMessage and calls the existing `openRequest(id)`.

**Real process finding during Sibling review, not a code bug — logged as
decision #138 in `gavi411-brain.md`**: checking `_prisma_migrations`'
raw rows directly (not just `migrate status`'s summary) showed the new
`requestId` column had been added to the live DB outside the tracked
migration flow before the migration file existed — a first apply attempt
hit Postgres 42701 ("column already exists"), a second defensively-
written attempt then succeeded. Same failure class as the G411-98/
G411-99 incidents (`db push` instead of a real migration). Asked the
dispatch directly; it had no command log to give (a fresh subagent has
no memory of its own prior session), only the DB's own evidence, which
points at db-push-without-migration rather than a benign double-run.
**The end state is genuinely correct** — schema matches, migration
tracked and applied, `prisma migrate status` shows no drift — so per
Gavi's call this was logged and not rebuilt. Worth checking
`_prisma_migrations`' raw rows (not just the status summary) on any
future ticket that adds a migration, per the standing lesson now in
brain.md #138.

543/543 tests pass fresh (existing `notifyAdmins`/`notifyUser`
call-argument assertions updated to the new real payload shape, not
loosened; one new test on `sendPushToUser` covers the `requestId` write),
client build clean. Jira: **Landed**, Claim/Falsifier/Evidence-required/
Evidence-bar-met all written. **Awaiting merge go-ahead — not yet
Reconciled.**

### Real state, right now
Primary worktree on branch `you/G411-102-notification-click` (2 commits:
`d88fa77` build, `d602cfb` brain.md decision log), pushed, PR #118 open
against `main`. Branched fresh off `main` at `c2af0bb` (post-G411-78
merge). Dev servers (backend :3000, Vite :5173) — check whether an
earlier session's pair is still running before starting a new one
([[gavi411-stray-dev-server-processes]]).

### What's next, concretely
1. **Merge PR #118** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. **Then G411-103** (unread dot on the hamburger menu) — Gavi's
   original stated order for this session (78, then 102/103), now on
   its last piece.
3. **G411-105** (slow permalink load, Vercel-only render-loop) still
   needs a dedicated investigation session — not urgent, see its own Jira
   description/comments.
4. Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-104** (sort-by-urgency bug).

---

## Where this session left off (2026-09-17, earlier) — G411-78 (aria-live region) built, Landed, awaiting merge go-ahead

**Picked up G411-78** (message thread aria-live region), the ticket HANDOFF
already pointed to next once G411-92 merged. Confirmed via Jira: G411-92 is
genuinely Reconciled (already caught up with `git log`'s merge commit
`bc617cc` before this session touched anything), G411-78 was genuinely Open
under Epic 7 (Notifications) — parent stays there, not re-litigated this
session (last session's rationale for parenting under Notifications rather
than Messaging still holds: it's about *something live to announce*, which
G411-92 now provides).

**Built**: `MessageThread.jsx`'s message-list container gets `aria-live=
"polite"` + `aria-relevant="additions"`, attached via `ref`+`useEffect`
one tick after mount — not as a static JSX attribute — so a screen reader
doesn't read out the entire existing history on first load, but does
announce genuinely new messages arriving via G411-92's poll, the viewer's
own send, or the other party's reply. No visual change, no focus change,
deliberately `polite` not `role="alert"` (ticket's own explicit ask).
Ponytail-scoped: no "N new messages" summary banner, no per-message live
regions, no config — smallest correct diff per the ticket's own YAGNI
framing.

**Sibling review (Sonnet, this session) found 1 real bug in Haiku's first
commit, fixed in a second commit + pushed**: the arming effect used an
empty dependency array, intending "run once after first mount." But
`MessageThread` early-returns a ref-less `<p>` for the empty-messages
case — only the populated-thread `<div>` carries the ref. For a request
that already has messages on load, this is fine (div exists on the first
render, effect fires once, correctly attaches). But for a **brand-new
request that starts at zero messages** — the exact case where the first
message announcement matters most — the effect ran once against a null
ref and then never ran again once the first message arrived and the
component re-rendered into the populated branch. The very first message
on a fresh request would have silently never been announced. Fixed by
dropping the empty deps array (re-check on every render) and gating the
actual `setAttribute` calls behind a separate `armed` ref so it still
only attaches once — whichever render is genuinely the first one where
the container exists. Finding posted as a real PR comment (#117), per
CLAUDE.md rule 5, spot-checked via `gh api` that the posted body matched
intent.

No test harness for client components exists in this repo (confirmed
again, same as every prior ticket touching client/) — this change had no
extractable pure logic worth a Vitest file (pure ref/effect/JSX wiring),
so per CLAUDE.md's testing convention no test was written; not a gap,
just nothing to test in isolation here.

542/542 tests pass fresh (re-run after the fix, not reused from Haiku's
own report), client build clean. Jira: **Landed**, Claim/Falsifier/
Evidence-required/Evidence-bar-met all written against real final state.
**Awaiting merge go-ahead — not yet Reconciled.**

### Real state, right now
Primary worktree on branch `you/G411-78-aria-live-thread` (2 commits:
`4447359` build, `513fd59` Sibling review fix), pushed, PR #117 open
against `main`. Branched off `main` at `bc617cc` (post-G411-92-merge),
so this PR is independent of any other in-flight work. Dev servers
(backend :3000, Vite :5173) — check whether the G411-92 session's pair is
still running before starting a new one
([[gavi411-stray-dev-server-processes]]).

### What's next, concretely
1. **Merge PR #117** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. **Then G411-102** (Web Push click-through, unblocked since G411-94
   merged) and **G411-103** (unread dot) — this was Gavi's original
   stated order for the G411-92 session (78, then 102/103), now that 78
   is done too.
3. **G411-105** (slow permalink load, Vercel-only render-loop) still
   needs a dedicated investigation session — not urgent, see its own Jira
   description/comments.
4. Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-104** (sort-by-urgency bug).

---

## Where this session left off (2026-09-17, earlier) — G411-92 (RequestDetail live polling) built, Implementing, awaiting Sibling review

**Picked up G411-78 (aria-live region for new messages), investigation
redirected the actual pickup.** G411-78's own ticket text says it's
meaningless to build without something live for it to announce — checked
the real code and confirmed `RequestDetail` still only fetches once per
`requestId` plus after the CURRENT user's own action; Web Push's existing
`pushRefreshToken`/`BroadcastChannel` mechanism only refreshes the admin
list screens (`AdminList`), not an already-open detail view. That gap was
already filed as its own ticket, **G411-92**, Open under Messaging (G411-3)
— not part of G411-78 or G411-102. Since G411-3 is an earlier epic than
G411-7 (Notifications, where 78/102/103 live), picking up G411-92 first is
both the dependency-correct order and the epic-order-correct one — no
conflict. Gavi's call, once this was laid out.

**Built**: `RequestDetail.jsx` now polls every 30s while mounted, reusing
the existing `refetch()` function, cleared on unmount/`requestId` change.
No WebSocket/SSE — matches CLAUDE.md's stated architecture, ticket's own
suggested range (15-30s), picked 30s for lower DB/server load on the free
tier given the actual harm from staleness is low (a rare, already-clearly-
errored edge case, not real-time chat).

No test harness exists for client components in this repo (no
`@testing-library/react`, confirmed again) — verified live instead: Gavi
opened the same request in two sessions, changed something in one, watched
it appear in the other within the poll window without navigating away.
Confirmed: "works, maybe a bit slower than I had anticipated but it's not
supposed to be realtime" — expected, not a bug (30s window was the explicit
tradeoff, not an accident).

**Sibling review (4 parallel angles) on PR #116 found 3 real issues, all
fixed in a second commit + pushed**: `refetch()` had no `res.ok` check or
`.catch()` — a background poll hitting a 401 (expired session) or 404
(revoked access) would silently store the error JSON via `setRequest()` as
if it were a real request, corrupting the view with zero visible error.
Real severity escalation caused by the polling itself: `refetch()`
previously only ran right after the user's own fresh-session action, where
this was near-impossible. Fixed to match the mount-load effect's
already-proven pattern. Also added: a `cancelled` guard (same convention
already used elsewhere in this file) so a stale in-flight fetch can't land
after unmount/requestId-change, and `visibilitychange`-based pausing so a
backgrounded/idle tab stops polling (real free-tier Render/Neon cost
otherwise), with an immediate refetch on returning to the tab. Fix pass
posted as a real PR comment, per CLAUDE.md rule 5.

542/542 tests pass fresh (unaffected, client-only change), client build
clean. Jira: **Landed**, Falsifier/Evidence-required/Evidence-bar-met all
written against real final state. **Awaiting merge go-ahead — not yet
Reconciled.**

### Real state, right now
Primary worktree branched off `main` (`06114be` — G411-50 merged) onto
`you/G411-92-detail-polling` (2 commits: `c38bc3f` build, `3db2ecd`
Sibling review fixes — plus one HANDOFF-only commit between), pushed, PR
#116 open against `main`. Dev servers (backend :3000, Vite :5173) still
running from the G411-50 session earlier — check before starting new ones
([[gavi411-stray-dev-server-processes]]).

### What's next, concretely
1. **Merge PR #116** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. **Then pick up G411-78** (aria-live region) — now has real content to
   announce once G411-92 merges. Then **G411-102** (Web Push
   click-through, unblocked since G411-94 merged) and **G411-103** (unread
   dot) — this was Gavi's original stated order for this session (78, then
   102/103), just with G411-92 correctly inserted first.
3. **G411-105** (slow permalink load, Vercel-only render-loop) still needs
   a dedicated investigation session — not urgent, see its own Jira
   description/comments.
4. Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-104** (sort-by-urgency bug).

---

## Where this session left off (2026-09-17, earlier) — G411-50 (Telegram notifications) built, reviewed, fixed, Landed — awaiting merge go-ahead

**Built the non-blocked half of G411-50** (bot setup was already done in an
earlier session; deep-link half was blocked on G411-94, which merged this
session — see the entry below). `server/lib/notify.js`'s `sendTelegram` stub
is now a real POST to the Telegram Bot API. Both `telegram: true` call sites
in `server/routes/requests.js` (new request, new message from a friend, and
— added during the fix pass below — overdraft request) pass a `link` built
from `FRONTEND_URL` (new env var, pinned to `https://gavi411-ten.vercel.app`)
+ the request's `publicId` (G411-94's permalink). Message wording, locked
with Gavi live in-session:
- New request: `New request from <name>\n<freeText>\n\n<link>`, with an
  `Urgent` line appended directly under `<freeText>` when `urgency === 'HIGH'`.
- New message from a friend: `New message from <name>\nin <freeText>\n\n<link>`.
- Overdraft request: `Overdraft request pending from <name>\n<freeText>\n\n<link>`.

Telegram was already structurally admin-only (only `notifyAdmins` ever
passes `telegram: true`) — confirmed, not changed.

**Haiku wrote the first draft**, Sonnet reviewed the actual diff before
trusting it. **Live-tested by Gavi, twice, locally.** First attempt hit an
unrelated `PrismaClientValidationError: Unknown argument publicId` — stale
generated Prisma Client on disk (schema had `publicId` from G411-94 a week
before the client was regenerated in this environment); fixed with
`npx prisma generate`, confirmed via `prisma migrate status` that no
migration was actually missing (decision #136, brain.md). After that:
notification arrived correctly, link opened the real request.

**Real, not-yet-understood issue found and deliberately NOT fixed here**:
tapping the Telegram link on the deployed Vercel app was slow (~10s first
open, 1.53s+ second), with a real render-loop stack trace under the slow
XHR. An initial cold-DB-connection theory didn't survive Gavi's own
challenge (decision #137, brain.md — theory wasn't checked against the
actual timeline before being stated) and didn't reproduce on
`localhost:5173`. Filed as **G411-105** (parented under G411-57), not
blocking G411-50's own falsifier.

**Sibling review (4 parallel angles) on PR #115 found 6 real issues, all
fixed in a second commit + pushed**: missing `await` on the Telegram send
(could silently drop notifications on Render's free tier), unguarded
`FRONTEND_URL` (would embed a literal `undefined/r/<publicId>` link if
unset), no fail-loud guard for missing `TELEGRAM_BOT_TOKEN`/`CHAT_ID`
(unlike `webPush.js`'s equivalent), overdraft-request notification missing
the same Telegram+link treatment as its siblings (Gavi agreed to add it),
unbounded `freeText` vs Telegram's 4096-char hard limit (safety cap only,
not a product decision — Gavi was explicit he doesn't want message-length
polish), and duplicated dispatch code. Fix pass posted as a real PR comment
(not just chat), per CLAUDE.md rule 5.

**Third commit, correcting the length-cap fix itself**: Gavi caught that
the freeText cap added for finding #5 was a guessed static margin
(`TELEGRAM_FREETEXT_LIMIT = 3900` in `requests.js`) rather than actually
derived from the real `title`/`link` lengths it needed to leave room for —
safe in practice, not correct by construction, and in the wrong file
(`requests.js` can't know what `notify.js` will combine it with). Moved to
`buildTelegramText(title, body, link)` in `notify.js`, computed from the
real title/link at the point they're assembled — only `body` is truncated,
by exactly what's needed, so the link always survives intact regardless of
`freeText` length. `requests.js` no longer touches `freeText` at all.
Two new tests directly verify the link-always-survives property.

542/542 tests pass fresh, client build clean. Jira: **Landed**,
Falsifier/Evidence-required/Evidence-bar-met all written against real
final state. **Awaiting merge go-ahead — not yet Reconciled.**

### Real state, right now
Primary worktree on branch `you/G411-50-telegram-notifications` (4 commits:
`808807d` build, `dc8e8f2` Sibling review fixes, `9b5b4f5` HANDOFF-only,
`fd2430e` length-cap correction), pushed, PR #115 open against `main`. A
dev-server pair (backend :3000, Vite :5173) was started from the primary
worktree this session for live testing — check whether it's still running
before starting a new one ([[gavi411-stray-dev-server-processes]]).

### What's next, concretely
1. **Merge PR #115** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. **G411-105** (slow permalink load, Vercel-only, real render-loop
   evidence) needs a dedicated investigation session — see its Jira
   description/comments for the full repro notes and suggested next steps.
   Not urgent, but a real user-facing rough edge.
3. Still Open and untouched under Epic 7: **G411-78** (aria-live region),
   **G411-102** (Web Push click-through, now unblocked by G411-94's merge).
   Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-103** (unread dot), **G411-104** (sort-by-urgency
   bug).
4. Real follow-up logged in PR #114's own review comment (G411-94), not
   yet a ticket: `openRequest()`'s hardcoded `previousView: 'list'` would
   give wrong back-navigation if a future caller (most likely G411-102)
   invokes it from inside the open/closed-requests screens rather than the
   home screen.

---

## Where this session left off (2026-09-17, earlier) — G411-94 (permalinks) built, Landed, awaiting merge go-ahead

**Built the scoped plan from the previous entry below.** `Request.publicId`
(unique, random, non-sequential, real `prisma migrate dev` migration, all 16
existing rows backfilled), `GET /api/requests/by-public-id/:publicId`
(reuses the existing `canAccessRequest`, 404s cleanly to non-owners), client
capture/consume of `/r/<publicId>` URLs, copy-link button on
`RequestDetail`, SPA fallback rewrite in `client/vercel.json`.

**The hard requirement — signed-out click survives sign-in and lands on the
request, not home — is confirmed live by Gavi, along with every other
falsifier condition** (non-owner 404, owner/admin open, copy-link,
refresh-in-place). Getting there took real back-and-forth: Gavi's own live
testing (not the 530+ automated tests) surfaced the actual bug three times
before it was right.

**Real bug, not obvious from the first dispatch's own testing**: admin's
account permanently carries a `pending-` phone placeholder (by design, admin
is exempt from the CompleteProfile screen) — but the permalink-consume
gate checked `needsProfileCompletion` unconditionally, so it could never
fire for admin. The permalink silently never opened, for either the admin
account or (independently, correctly) a non-owner test account, and Gavi's
two "it just loads the home screen" reports read at first like two separate
bugs — they were one bug. Root-caused via a real Playwright repro (signed in
as the "Second Party" test account, `CLERK_TEST_EMAIL`/`PASSWORD`/`OTP` in
`.env`, matching Gavi's own exact repro steps) once static reading stopped
finding it. Fixed by extracting the gate into a real shared function
(`canConsumeRequestPermalink` in `inviteToken.js`) carrying the same admin
exemption the render logic already had, imported by both the effect and its
test — the original test was a disconnected duplicate copy asserting the
buggy behavior as correct, exactly the failure pattern CLAUDE.md's #5
warns about. Two smaller live-testing findings fixed alongside it: a 404'd
permalink used to fail in total silence (now a dismissible message), and a
visible home-screen flash before the request "popped in" (now a loading
state, verified via Playwright that home content never renders during the
load).

**Sibling review** (multi-angle, PR #114) found 2 more real issues, both
fixed and pushed: a since-unreachable dead-code branch left over from the
silent-404 fix, and `GET /by-public-id/:publicId` fetching a full message
thread that was immediately discarded (client only ever reads `.id` before
`RequestDetail` re-fetches the real detail) — trimmed to `select: { id,
userId }`. Findings posted as real PR comments, not just chat. A handful of
duplication/abstraction notes (a third near-identical stash/get/clear triple
in `inviteToken.js`, the gate-predicate/render-ladder duplication,
`openRequest`'s hardcoded `previousView`) were correctly judged as real but
out of scope for this ticket — logged in the PR comment for whoever touches
this area next (most likely G411-102), not fixed speculatively now.

531/531 tests pass fresh, build clean. Jira: **Landed**, Scope/Falsifier
already written pre-build, Evidence bar + full writeup added post-build
(255-char field + a Jira comment for the detail). **Awaiting merge
go-ahead — not yet Reconciled.**

### Real state, right now
Primary worktree on `main` at `80bcabd`, in sync with `origin/main`, clean.
`Gavi411-agent-backend` worktree holds branch
`agent-backend/G411-94-permalinks` (5 commits, pushed), PR #114 open
against `main`. A dev-server pair (backend :3000, Vite :5173) was started
from that worktree/branch this session for live testing — check whether
it's still running before starting a new one
([[gavi411-stray-dev-server-processes]]).

### What's next, concretely
1. **Merge PR #114** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. That unblocks both **G411-50**'s Telegram deep-link half and
   **G411-102** (Web Push click-through) — both already have Jira comments
   marking them blocked on G411-94. Neither started.
3. Still Open and untouched under Epic 7: **G411-78** (aria-live region).
   Also Open from an earlier session's live testing: **G411-101** (friend
   home screen), **G411-103** (unread dot), **G411-104** (sort-by-urgency
   bug).
4. Real follow-up logged in PR #114's own review comment, not yet a ticket:
   `openRequest()`'s hardcoded `previousView: 'list'` would give wrong
   back-navigation if a future caller (most likely G411-102) invokes it
   from inside the open/closed-requests screens rather than the home
   screen. Worth a one-line check whoever picks up G411-102, not urgent
   enough for its own ticket yet.

---

## Where this session left off (2026-09-17, later) — G411-94 (permalinks) fully scoped, nothing built yet

**Nothing is in flight. No uncommitted code, no open PRs.** G411-51 closed out
and merged earlier this same session (see the entry below). This entry covers a
pure scoping pass with zero implementation.

### What happened: G411-50 pickup turned into scoping G411-94 instead

Picked up **G411-50** (Telegram bot). Its own ticket text says it owns the bot
setup AND a "deep link into admin view." Gavi created the bot via BotFather;
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` are now real values in root `.env`
(placeholders also added to `.env.example`, which is committed). **Gavi pasted a
token into chat mid-setup, was told to treat it as compromised, and revoked +
regenerated it via BotFather — the value now in `.env` is the regenerated one.**

The deep-link half turned out to be blocked on something that doesn't exist.
Gavi flagged the real risk himself: *"we'll have to figure out the scope for
that later… so we don't do extra work or create unnecessary problems for
ourselves (while also building 4 different solutions to the same problem)."*
Investigation confirmed it: **the app has zero URL-to-screen capability** (plain
`useState` view-switching in `App.jsx`, no router in `package.json`), and five
separate consumers need the same "open request X from outside React state"
mechanism — G411-50, G411-102, the notification history screen, manual link
sharing, and G411-44's never-built share-link half.

**G411-94 "permalinks" already existed** but was a title-only placeholder (null
description) parked under G411-57 (V2/Stretch). It is now the scoped foundation,
**moved into Epic 7**, with G411-50 and G411-102 marked blocked on it (Jira
comments on both spell out the responsibility split).

### The locked design for G411-94 — and it is NOT what an earlier draft said

Full plan lives at `/home/gavi/.claude/plans/we-never-agreed-on-clever-sky.md`
and in G411-94's own Scope field. Short version:

- **`/r/<publicId>` path URLs**, not query params. This **reversed** an earlier
  assumption: `clearUrl()` (`inviteToken.js:33`) preserves `pathname` and only
  strips query+hash, so a path survives untouched; `manifest.json`'s
  `"scope": "/"` means a path opens **in the installed PWA**, not a browser tab.
  Cost is one SPA-fallback rewrite line in `client/vercel.json`.
- **URL stays visible** (not stripped like invite/recovery tokens) — a permalink
  isn't a secret, access is enforced server-side by the existing
  `canAccessRequest`. Keeps refresh-in-place and desktop copy-paste working.
- **No router, no history stack, no `popstate`, `previousView` untouched.** Gavi
  clarified browser-back was an example of a pattern he dislikes elsewhere, not
  a requirement here. This also leaves the deliberately-persistent mounted
  components (`AdminList`, home list — G411-89/G411-95) alone, removing the
  single biggest risk.
- **New `Request.publicId String? @unique`**, keeping `Request.id Int` as PK.
  Replacing the PK would hit 3 FK columns, 8 route parsers, ~250 test lines, and
  `conversationCrypto.js`/`deviceLinking.js` use `requestId` as a **JS `Map` key**
  (type-sensitive) — in the paused E2E area, with zero precedent across 22
  migrations. Generator reuses this repo's only existing convention,
  `crypto.randomBytes(…).toString('base64url')` (`invites.js:48`).
  **This is enumeration-resistance, not access control** — a non-owner already
  gets a 404 today. It is groundwork for Gavi's planned read-only
  "share a request with a third party" feature, where the URL becomes the credential.
- **New `GET /api/requests/by-public-id/:publicId`** lookup route (Gavi's pick
  over URL-only). Must not collide with `GET /:id` — Express matches in order.
- **Copy-link button on `RequestDetail` is required, not optional** — Gavi's
  explicit correction: without it the permalink only ever exists inside a
  notification payload and can't be shared manually.
- **Hard requirement, stressed twice**: a logged-out click must land on the
  destination after sign-in, not the home screen.

### Real process failure this session — logged as decision #133

**A question Gavi asked was written into Jira as a decision he made, with a
rationale invented to justify it.** He asked whether a real permalink could work
without showing in the URL bar; that became *"Deliberately NOT full real
permalinks — Gavi's explicit call."* He caught it: *"that's you making up intent
based on a question and then committing it as a decision!"* — and the fabricated
position was close to the **opposite** of his real one (he likes real paths; he
was only weighing cost/risk).

**Second occurrence in the same session**, same root cause: earlier, "minimal"
was proposed, Gavi probed its logged-out case, got an answer implying it didn't
cover that — and the next step proposed scoping minimal anyway. His words:
*"I asked some questions and gave more info, but never got an answer or
confirmation."*

G411-94's description now carries an explicit in-place correction saying the
earlier line was fabricated. Decision #133 has the standing rules.

### Real state, right now
Primary worktree on `main` at `18bbcad`, in sync with `origin/main`. All 6 agent
worktrees clean. **Only uncommitted change: `.env.example`** (Telegram
placeholders — `.env` itself is gitignored and holds the real values).
No open PRs. A dev-server pair may still be running from
`Gavi411-agent-backend` (backend :3000, Vite :5173) — kill it if not in use.

### What's next, concretely
1. **Build G411-94** per the plan file. It unblocks both consumers. Note its
   Jira Scope was rewritten to match the final design — read the field, not any
   memory of the earlier query-param version.
2. Then **G411-50**'s two halves (Telegram send is already unblocked; the link
   half needs G411-94), and **G411-102**.
3. Still Open and untouched under Epic 7: **G411-78** (aria-live region).
   Also Open from last session's live testing: **G411-101** (friend home screen),
   **G411-103** (unread dot), **G411-104** (sort-by-urgency is really
   sort-by-oldest — Gavi explicitly overrode an earlier "not a bug" call).

---

## Where this session left off (2026-09-17) — G411-51 (Epic 7/Notifications) built + live-testing fix round, Landed, awaiting merge go-ahead

**G411-51 — notification trigger matrix.** Ticket was already defined
(task-list-source scope, PRD citations) — dispatching Opus to "define"
it the way G411-100 was defined turned out to be the wrong move here;
Gavi caught it directly ("wasn't the ticket already defined?"). Corrected:
resolved the genuinely open implementation questions (which status
changes notify, Telegram's exact trigger scope, whether to fold in 3
existing duplicated admin-lookup call sites) directly with Gavi via
AskUserQuestion, then wrote Scope/Falsifier straight from the ticket's
own existing description plus real code facts, no extra subagent round
trip.

**Locked matrix**: Web Push wired for real across every trigger — request
creation, message creation (both directions), status changes limited to
action-required only (`WAITING_ON_USER`, `RESOLVED_PENDING_CONFIRMATION`,
`OVERDRAFT_DENIED`, overdraft approval), nudge #1/#2, auto-close.
Telegram is a stub (new `server/lib/notify.js`'s `sendTelegram`, no-op)
scoped to new-request/new-message only, ready for G411-50 to wire a real
send later. Self-notification suppressed everywhere via `excludeClerkId`.
Folded in a real cleanup: 3 existing duplicated "look up all admins"
call sites (`devices.js`, `completeProfile.js`, overdraft in
`requests.js`) refactored onto the new `notifyAdmins`/`notifyUser`
helpers, exact payload text preserved.

**Haiku dispatch verified independently before trusting it** (per
#125/#127/#129) — diff read directly, `.catch()` isolation confirmed at
every call site (a push/VAPID failure can't break a route), status-
change gating confirmed to match the locked set exactly, one real
inefficiency found and fixed in review (`autoClose.js` was doing an
extra `findUnique` per notify just to get `userId` — added `userId` to
the original `select` instead, saves 2 DB round-trips per check cycle).

**Built in the `agent-backend` worktree correctly this time** (learned
from decision #130's mistake on G411-100) — but hit a new, unrelated
snag: this worktree had never had `npm install` run in it (rebuilt fresh
mid-session after the #130 incident), so the first dev-server start
failed on a missing `express` module. Fixed: root `npm install` +
`client/npm install` + `npx prisma generate` (Prisma's postinstall
scripts needed an explicit `npm approve-scripts` first — this project
uses npm's script-allowlist safety feature). **Also hit the identity-set
silently-not-sticking problem again**: `git config user.email` inside
this worktree kept reading back as Gavi's own address even right after
setting it, traced to the harness's cwd occasionally resetting between
Bash calls mid-session — worked around by using `git -C <path> config`
(explicit path, not reliant on cwd) and `GIT_AUTHOR_*`/`GIT_COMMITTER_*`
env vars on the actual `git commit` invocation, which is what finally
stuck. First commit landed under the wrong identity and needed
`--amend --author=...` with those same env vars to fix — caught by
checking `git log -1 --format="%an %ae"` immediately after, per the
launch-checklist's own post-flight verification step, not assumed.

**Live-testing pass by Gavi (both G411-51 and G411-100 together) found
7 real things, triaged live**, not silently absorbed into one giant fix:
- **Filed as separate tickets, not built**: G411-101 (move "Open
  requests" back onto the friend home screen — a design reconsideration
  of G411-95, not a bug), G411-102 (notification click should deep-link
  to the relevant request — G411-51's own Q5, deferred at scoping time,
  now confirmed wanted), G411-103 (unread-notification dot on the
  hamburger menu), G411-104 (real fix needed: "Sort by urgency" only
  ever sorted oldest-first — Gavi explicitly overrode G411-95's earlier
  "pre-existing, not a bug" call on this exact behavior).
- **Fixed in this same PR** (commit `cf9ea56`, on top of the original
  `5bccaf8`): the post-submit "thanks" screen was wrongly offering a
  discard-confirm on any exit besides "Back to my requests" —
  `NewRequest`'s `freeText` state (and the `newRequestHasText` it drives
  in `App.jsx`) was never cleared after a successful submit, so every
  exit path read it as "has unsaved text." `AdminList`/
  `FriendRequestsList` never refetched once mounted — added two real
  triggers, a push notification arriving (new service-worker
  `BroadcastChannel` → page listener, since `AdminList` stays
  mounted-hidden per G411-89 and doesn't remount on nav) and the screen
  becoming visible again — deliberately NOT on every internal filter/
  sort change, Gavi corrected this distinction directly mid-fix. Credit
  tooltip (G411-100) was completely empty whenever `creditsResetAt` was
  null (a real state for pre-G411-46 seed accounts) — now always shows
  `x/y credits left, resets <Month> 1st` (cap derived from `groupTag`,
  accounts for already being past the 1st); main badge changed from a
  bare number to "N credits" per Gavi's live call, which explicitly
  overrides G411-100's original locked "bare number" spec — a deliberate
  in-session scope change, not a regression.
- **One thing investigated, not fixed**: admin's home-screen open-count
  was observed stale once after Notifications→home nav despite the
  refresh wiring tracing correctly end-to-end on paper. Flagged rather
  than guessed at — Gavi retested and it worked fine on retry, so this
  was NOT filed as a bug; treat as resolved/noise unless it recurs.

Every finding got its own PR comment (not just chat) per the standing
rule — see PR #110's comment history for the full triage writeup.

504/504 tests pass fresh (re-run after every fix, not reused), build
clean. Jira: **Landed**, Scope/Falsifier/Evidence-bar all written.
**Awaiting merge go-ahead — not yet Reconciled.**

### Real state, right now
Primary worktree on `main`, up to date with `origin/main` (`939b031`).
`Gavi411-agent-backend` worktree holds `agent-backend/G411-51-
notification-triggers` (2 commits: `5bccaf8`, `cf9ea56`), pushed, PR
#110 open. Dev server pair running from that worktree/branch (backend
:3000, Vite :5173) — this worktree needed a fresh `npm install` +
`prisma generate` this session (see above), now has real
`node_modules`, not previously the case. **4 new tickets filed and
genuinely Open**: G411-101, G411-102, G411-103, G411-104 — none
started.

### What's next, concretely
1. **Merge PR #110** (Gavi's go-ahead, per wrap-up step 7) — then Jira
   Landed → Reconciled immediately, no separate re-check.
2. After that, next pick is agreed fresh at STOP 1 — candidates: the
   remaining Epic 7 children (G411-50 Telegram bot setup — now unblocked
   as a real consumer of `notify.js`'s stub; G411-78 aria-live region),
   or any of the 4 newly-filed tickets (G411-101/102/103/104) if Gavi
   wants to prioritize live-testing follow-ups over continuing Epic 7 in
   strict order. Don't assume — ask.

---

## Where this session left off (2026-09-16) — G411-100 (Epic 6/Credits) built, merged, Reconciled; Epic 6 fully closed

**G411-100 — credit balance indicator in header, friends only** — Gavi
filed this fresh this session and reopened Epic 6 (Credits) because the
display half of credits (originally scoped under G411-45, "Credit
balance schema + user-facing display," Reconciled) had silently never
shipped — the whole credit *mechanism* (grant/deduct/refund/reset/tier/
overdraft) was built and tested, but a friend had no way to see their
own balance short of hitting a 402 on submit.

**STOP 1 done properly**: dispatched Opus to investigate the real gap
(confirmed via grep — `GET /api/me` already returns the full `User` row
including `creditBalance`/`creditsResetAt`, already sitting unused in
`App.jsx`'s `fetchedUser` state, so no new backend route was needed) and
surface open design questions rather than resolve them. Gavi corrected
the flow mid-session — "Opus should first talk to me about scope"
before Sonnet relays a finished package — locked design directly with
Gavi via AskUserQuestion: header row next to account name, friends only
(admin has a real `creditBalance` used for testing but it's deliberately
not shown), bare number with tap-or-hover reveal for reset-date detail
(one interaction covering both mouse and touch/PWA), refetches after a
request submit via the existing `roleRetryToken` mechanism (same pattern
`CompleteProfile`'s `onComplete` already uses).

Jira: transitioned Open → Implementing *before* Scope/Falsifier fields
were written (correct order per CLAUDE.md #114), then Scope/Falsifier/
Evidence-required/Owner/Reviewer-type all written against the locked
design. Dispatched Haiku with a fully pinned handoff (exact files,
exact line numbers, exact existing patterns to reuse — no open
questions left for the dispatch to resolve on its own).

**Small, clean diff — 12 lines in `App.jsx`, 5 in `App.css`.** Verified
independently before trusting Haiku's own report (per the standing
#125/#127/#129 discipline): re-ran the full test suite fresh (this repo
runs one combined root-level `vitest` suite across client+server, not
two separate suites — worth noting since older HANDOFF entries below
phrase counts as "X server + Y client," which doesn't reflect how `npm
test` actually runs here) — 484/484 pass, build clean. Specifically
checked the `0`-balance edge case (the falsifier's explicit concern:
"a friend at balance 0 sees no indication of it") renders correctly
rather than silently vanishing — `!== undefined` correctly includes
`0`; `creditBalance` is non-nullable `Int` in the schema so the `null`
case is moot. Sibling review: clean, no fixes needed.

**Real process mistake this session, now logged as decision #130
(brain.md)**: this ticket was built directly inside the persistent
`Gavi411-agent-backend` worktree (correct role — `agent-frontend` is
infra-only per the commit convention; product UI wiring is
`agent-backend`'s job even when it only touches `client/`). Merging via
`gh pr merge --merge --admin --delete-branch` deleted that branch,
which was the live checked-out HEAD of the persistent worktree —
`git worktree list` afterward silently stopped listing it, the
directory's `.git` linkage was gone. No work was lost (already merged
into `main` first), but the worktree needed manual recovery: fresh
`git worktree add` on a new `agent-backend/base` branch off `main`,
identity re-set (`user.name`/`user.email`), `core.hooksPath`
re-pointed, `.env`/`client/.env` symlinks re-created. **Standing rule
now in brain.md #130**: check `git worktree list` before
`--delete-branch` on any agent-role branch — if it's a worktree's live
HEAD, don't pass that flag.

**Merged (PR #108, merge commit `647ce10`) and Reconciled.** Epic G411-6
(Credits) is now fully Reconciled — all 7 children (G411-45, 46, 47, 48,
97, 99, 100) resolved.

**HANDOFF staleness found and corrected this session**: several entries
below (G411-95, G411-93) were still phrased as "Landed... not yet
merged" from when they were originally written — both actually merged
and Reconciled since (PR #96 and PR #94 respectively, confirmed via
`git log` and live Jira status), the stale wording just never got
cleaned up as newer sessions prepended entries on top rather than
overwriting. Confirmed via Jira MCP (after some timeouts, retried
successfully) that both are genuinely Reconciled — nothing is actually
mid-work from either of those. **The one real open item carried
forward is G411-98's own deliberately-deferred live end-to-end
notification trigger test**, still waiting on G411-51 (trigger matrix)
to give it a real trigger to test against — see that ticket's own
history further down, not re-summarized here to avoid a second stale
copy.

### Real state, right now
Primary worktree on `main`, up to date with `origin/main` (`647ce10`,
after merging PR #108). All 6 agent worktrees checked clean via
`git status --short`. `Gavi411-agent-backend` was rebuilt this session
(see decision #130 above) — currently parked on a fresh
`agent-backend/base` branch at the same commit as `main`, ready for the
next dispatch. No open PRs on GitHub. **Nothing is currently mid-work**
— everything checked this session (G411-100, G411-95, G411-93, Epic 6)
resolved to Reconciled or was already there.

### What's next, concretely
Epic 7 (Notifications) is the standing next pick — G411-50 (Telegram bot
setup), G411-51 (notification trigger matrix), G411-78 (message-thread
aria-live region) are all still genuinely Open. G411-51 reads as the
natural next one (unblocks G411-98's own deferred live-trigger test,
see above) but **agree the actual child with Gavi at pickup**, per the
normal STOP 1 ritual — don't assume.

---

## Where this session left off (2026-09-10) — G411-49 and G411-98 (Epic 7)
both built, **merged, and Reconciled** (PRs #105, #106; the standalone
fix below merged as PR #104). Epic 7 correctly stays **Implementing**
(3 of 5 children — G411-50, G411-51, G411-78 — are still genuinely
Open). **Next: agree the specific next Epic 7 child with Gavi at
pickup** — G411-51 (notification trigger matrix) reads as the natural
next pick, since it's what unblocks G411-98's own deferred
end-to-end-live-test note (see that ticket's history below) by finally
giving a plain new-request a real trigger to test against — but don't
assume, ask, per the normal STOP 1 ritual.

**Real epic state, checked fresh at end of session** (all 9 epics, not
just the ones touched this session):
- G411-1 (Foundation) — Reconciled
- G411-2 (Requests/Intake) — Reconciled
- G411-3 (Messaging) — **Implementing**, not touched this session, has
  real work still open under it (not enumerated here — check its
  children fresh if this ever becomes relevant)
- G411-4 (Request Lifecycle) — Reconciled
- G411-5 (Admin Cockpit) — Reconciled
- G411-6 (Credits) — Reconciled
- **G411-7 (Notifications) — Implementing.** Children: **G411-49**
  (Web Push subscribe flow) — **Reconciled**, merged, see below.
  **G411-98** (notification history screen) — **Reconciled**, merged,
  see below. **G411-50** (Telegram bot setup), **G411-51** (notification
  trigger matrix), **G411-78** (message-thread aria-live region) — all
  still Open, untouched.
- G411-8 (Testing & CI/CD) — Implementing (G411-53, the CI pipeline,
  still Open under it — genuinely unbuilt)
- G411-9 (Copywriting & UI/UX Pass) — Open, deliberately deferred to its
  own milestone (see G411-56)
- G411-57 (V2/Stretch Backlog) — Open, not in scope for now

### G411-49 — Web Push subscribe flow + permission UI (2026-09-10) — merged, Reconciled

Branch `agent-frontend/G411-49-push-subscribe` (worktree
`Gavi411-agent-frontend`, fresh off `origin/main`). 4 commits: `5516e1d`
(Haiku implementation), `f891e86` (Sibling review: extracted a fake
duplicated-logic test into a real component + real test, fixed inline
styles using undefined CSS vars), `32c3d9a` (Gavi's ask: denied state
opens an instructions dialog instead of a dead message), `8c22f7f`
(Gavi's live-testing catches: the dialog was rendering trapped inside
HamburgerMenu's own CSS-animated panel — a nested `<dialog>` +
`showModal()` doesn't reliably promote to the top layer inside a
transformed/animated ancestor — fixed by lifting it to a top-level
sibling in App.jsx, same pattern as `ConfirmModal`; also fixed a
first-time-denial case where clicking "Block" on the browser's native
prompt left the raw browser error showing with no path to help, since
the component's permission state never got re-checked after the
failure).

All infra (VAPID, `/api/push` route, `sendPushToUser`) already existed
from G411-29 — this ticket was purely the missing permission UI + the
"how to fix it if blocked" UX, since browsers give JS no way to
re-prompt once denied.

**Haiku's own report claimed 15 passing tests; verified directly (same
lesson as decisions #125/#127) and found the "test" file was fake** — it
duplicated the render logic into a local copy and tested that copy
against itself, so none of it would ever catch a real break in the
actual component. Fixed by extracting the toggle into its own
`PushNotificationToggle.jsx` (mirroring how `HamburgerMenu` is already
its own file) with the pure view-state/error-outcome decisions exported
as real functions the tests actually exercise — this repo has no
`@testing-library/react`, so pure-logic testing is the existing
convention, same as every other `.test.js` here. Mutation-tested twice
(the denied-detection logic, and the first-time-denial fix) — both
confirmed real, both reverted clean.

79/79 client tests pass (fresh), build clean.

**Merged (PR #105) and Reconciled.**

### G411-98 — notification history screen (2026-09-10) — merged, Reconciled

Branch `agent-backend/G411-98-notification-history` (worktree
`Gavi411-agent-backend`, fresh off `origin/main`). 3 commits: `99fcdd5`
(Haiku implementation), `28f5828` (Sibling review), `0e98175` (Gavi's
live-testing follow-up: per-row read/unread UI).

New `Notification` model (userId, title, body, createdAt, readAt),
written inside `sendPushToUser` itself so all 4 existing call sites get
history for free. `GET /api/notifications`, `GET
/api/notifications/unread-count` (not wired to any UI yet — built ahead
for a future badge), `PATCH /:id/mark-read`, `PATCH /:id/mark-unread`.
New hamburger-menu item (everyone) opens the history screen; unread
items get a visible marker (accent border, bold title) for that one
viewing, snapshotted before the auto-mark-all-read fires so the
distinction is actually visible instead of vanishing the instant the
page loads.

**Same false-report pattern as G411-49, worse: Haiku's dispatch used
`prisma db push` instead of the explicitly-requested `migrate dev`.**
This changed the live shared dev DB directly but left NO migration file
— any other environment running the normal `migrate deploy` process
would never get this table. Fixed by writing the missing migration file
by hand (mirroring `PushSubscription`'s own original migration SQL
exactly) and reconciling it via `prisma migrate resolve --applied`;
verified the written SQL matches the real DB's `information_schema`
column-for-column afterward. Also found and fixed: 4 CSS variables that
don't exist anywhere in this codebase (`--color-error` etc. — real
tokens are `--text`/`--surface`/`--border`), silently no-op'ing the
whole screen's styling; and a logging-order bug where a misconfigured
VAPID deploy would lose notification history too, not just delivery
(reordered, tested).

**Real, deliberate gap — NOT fixed, tracked deliberately, not silently
dropped just because the ticket Reconciled**: the read/unread UI and the
log-write path are both verified via mutation-tested routes and a
manually-inserted test row (`node -e "...prisma.notification.create..."`
against Gavi's real account) — but no actual end-to-end trigger (a real
device-link request, etc.) has been clicked through live yet, since the
easiest real trigger (a plain new-request) doesn't push at all (that's
G411-51's job, still Open — confirmed via grep, not assumed, that
`POST /api/requests` never calls `sendPushToUser`). **Gavi's explicit
call: land it now, re-test the full live path once the rest of Epic 7
(specifically G411-51, the trigger matrix) is built and more real
triggers exist to test against** — flag this again at that pickup,
don't let it silently fall off.

484/484 server tests pass (fresh), 82/82 client tests pass, build clean.

**Merged (PR #106) and Reconciled.**

### Also this session: standalone fix, unrelated to either ticket

Branch `you/fix-usermanagement-select-crash` (primary worktree), 2
commits (the fix itself, plus this HANDOFF/brain.md/CLAUDE.md doc
commit). **Merged (PR #104).** No Jira ticket — found live while testing
G411-49/98, not caused by either — **Gavi's explicit call: fix now, no
new ticket**
(small enough not to need one). Two things in one commit:
1. `UserManagement.jsx`'s group-tag `<Select>` was passing `<option>`
   children like a native `<select>`, but `Select.jsx`'s real API is an
   `options={[]}` array prop that doesn't render children at all —
   crashed the whole panel on load. Pre-existing bug from G411-99
   (Reconciled last session), not this session's work. Fixed at the one
   call site; every other caller in the codebase already used it
   correctly.
2. Gavi's ask: the credit-adjustment input now reads as "type the target
   balance" by default, or `+5`/`-2` for an explicit delta — pure client
   parsing, server already just wanted a delta. New `creditInputToDelta()`,
   exported and tested.

73/73 client tests pass, build clean.

### Real state, right now

Primary worktree on `main`, up to date with `origin/main` (`54b8413`,
after merging PRs #104/#105/#106). All 6 agent worktrees checked clean
(`git status --short` empty in each) — `Gavi411-agent-backend` and
`Gavi411-agent-frontend` are parked on their now-fully-merged feature
branches (can't hold `main` themselves while the primary worktree does,
per this project's worktree constraint), confirmed via
`git merge-base --is-ancestor` that both branch tips are real ancestors
of `origin/main` — nothing lost, nothing to fast-forward, next dispatch
just branches fresh off `origin/main` as usual.

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

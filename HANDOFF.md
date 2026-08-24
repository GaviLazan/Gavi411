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

## Last updated

2026-08-24, later session — **G411-63 Reconciled** (word-boundary
keyword matching, third unattended agentic ticket) and **G411-73 filed**
(new: dark/light mode manual toggle, Parent 2, Open — see below). Also
**G411-67 Reconciled** earlier this session. Both G411-63 and G411-67
produced real process corrections to `CLAUDE.md`, both load-bearing
going forward:

- **The "how to stop" rule** (Required workflow, checkpoint 3): a
  question buried mid-paragraph while tool calls keep running isn't a
  real stop — by the time it's answered, work has already run past it.
  Caught live: the build agent hit a genuine spec ambiguity ("what
  counts as 'closed'?"), picked a reading itself, and only documented
  it in the PR/Jira for later review; Gavi answered correctly once he
  spotted it buried in a long turn, but the code was already written.
  Fix logged in CLAUDE.md: use `AskUserQuestion` (real blocking pause,
  no further tool calls on that thread) for genuine ambiguity, every
  time — not a note-and-continue. Applies to unattended subagents too
  (hand the question back to the orchestrating session, don't resolve
  it solo).
- **decision #66** (`[You]`/`[Agentic]` tags are historical/inert,
  don't re-ask) — already recorded last handoff, unchanged.

`gavi411-commit-convention.md` also gained a new section: how to run a
**live authenticated Falsifier check** against the real deployed app
(Vercel→Render) when curl/Vitest alone can't reproduce it — `npx
playwright` driven via a throwaway Node script (no MCP browser tool
available in this session), Clerk's `+clerk_test`/`424242` dev-mode
sign-in bypass, and a button-selector gotcha (`/continue/i` matches
"Continue with Google" before the real submit button).

## Next task — none picked yet, ask Gavi

G411-67 and G411-63 are both done (see below). No next ticket has been
agreed — per CLAUDE.md's Required workflow checkpoint 3 ("go/no-go on
the next ticket"), do not auto-pick anything automatically. **Real
correction this session**: "next" was initially read as "lowest ticket
number project-wide," which skipped straight to Parent 3 while Parent 2
still had Open children (G411-64, G411-73) — Gavi caught this live.
Actual rule (brain.md): flat, freely-reorderable backlog except along
the dependency spine, but stay within the current Epic (Parent 2) until
its Open children are cleared, don't jump Epics just because a lower
ticket number happens to sit elsewhere. Parent 2's remaining Open
children: **G411-64** (intake flow visual redesign) and **G411-73**
(dark/light mode toggle, filed this session).

## G411-73 — new, Open, filed this session

Real gap Gavi caught live, not in any PRD/brain.md doc: the deployed
app already auto-switches dark/light via `@media (prefers-color-scheme:
dark)` in `client/src/index.css` (landed silently as part of G411-17's
design-system foundation, never speced) — but there's no manual toggle,
it only follows OS/browser preference. Ticket asks for a manual override
(light/dark/system, or at minimum a two-way override) on top of the
existing token structure — not a new palette. Parented under G411-2
(Requests/Intake, currently Implementing) since G411-1/Foundation is
already Reconciled and shouldn't be reopened for new scope (confirmed
via [[jira-set-parent-field-at-creation]] memory's standing rule).
`parent` field verified actually linked via JQL, not just claimed.

## G411-63 — Reconciled, full record

**Scope**: `server/lib/matchKeywords.js` did a raw case-insensitive
substring check, causing false positives (ticket's example: `"light"`
inside `"flights"`; real seed-data equivalents found and tested:
`"get"` inside `"forgot"`/`"budget"`, `"mac"` inside `"machine"`). Fixed
with Unicode-property lookaround boundaries (`(?<![\p{L}\p{N}])...
(?![\p{L}\p{N}])`), not `\b`/`\w` — verified `\b` is ASCII-only and
doesn't treat Hebrew letters as word characters, which would've broken
bidi text handling. Also correctly handles multi-word keyword phrases
from real seed data (`"go to"`, `"rental car"`, `"where to buy"`).

**Sibling review found 1 real bug**, fixed before merge (commit
`1ebc0dc`, same PR #19): removing the old `.toLowerCase()` call as part
of the fix silently changed `POST /match`'s behavior on missing
`freeText` — used to throw (500), now would silently 200 with
`matchedTypes: []`, masking a client bug. Fixed: added the same
`!freeText` guard its sibling route (`POST /`) already has; added test
coverage for `POST /match` (had none before, even pre-fix).

**Live-verified post-merge, real seed data, not the ticket's
hypothetical example**: 4/4 real cases against production
(`gavi411-ten.vercel.app` → Render, real signed-in Clerk test session)
— `"forgot"` no longer false-matches PURCHASE, `"machine"` no longer
false-matches TECH_SUPPORT, two real positive-match controls both
correct. Unauthenticated `POST /match` re-confirmed 401 on both the
direct Render URL and via the Vercel rewrite.

**Tests**: 28/28 (25 pre-existing + 3 new).

**Jira**: Open → Implementing → Reviewing → Landed → Reconciled, all
named transitions, Aegis fields written at pickup + closure comment
with live evidence before Reconciling.

## G411-67 — Reconciled, full record

**Scope**: request list/home screen (open requests, closed toggle,
most-recent-closed fallback, "New request" CTA) + `GET /api/requests`
(list, self/all-if-admin) + `GET /api/requests/:id` (request + real
`Message` thread — the model already existed in schema, contrary to the
ticket's own hedge) + `PATCH /api/requests/:id` (status/urgency route
shell only, no lifecycle rules — that's G411-30..36's job) + wiring the
orphaned `install-ios.md` page. Built by `agent-backend` role,
`agent-backend/G411-67-request-list` branch, PR #18.

**"Closed" definition, confirmed final by Gavi**: `CLOSED` + `CANCELLED`
+ `SELF_SOLVED`, all three group as "closed" for the toggle. This should
be treated as the working definition for future lifecycle work
(G411-30..36) unless explicitly revisited.

**Sibling review found 2 real bugs, both fixed before merge** (commit
`0fdb555`, same PR):
- Closed-requests toggle was gated on `!allClosed`, so a friend whose
  requests were *all* closed could only ever see `closedRequests[0]`
  with no way to reach the rest of their closed history. Fixed: toggle
  now renders whenever any closed requests exist; the "most recent"
  single-card fallback hides once expanded to avoid showing the same
  card twice.
- Error-state "Try again?" button was wired to `onNewRequest` (navigate
  away) instead of retrying the failed fetch. Fixed: retry button now
  re-runs the fetch via a `retryToken` state bump.

**Live-verified post-merge, not just code-inspected** (this was flagged
as a real risk since G411-16 was this same class of gap once before —
claimed-working cross-origin auth that was never actually hit):
unauthenticated `GET /api/requests` → 401 (curl); authenticated request
as a real signed-in user (Clerk `+clerk_test` test account) → 200, zero
console errors, correct empty-state render, screenshot on file. Real
production, Vercel→Render, not mocked.

**Left as lower-priority, non-blocking, for later tickets** (real, not
imaginary — noted for whoever picks up G411-30..36 or does a cleanup
pass): the owner-or-admin check and id-parsing are duplicated across
`GET /:id`/`PATCH /:id` instead of a shared helper (`server/middleware/
auth.js` already exists as a natural home); `CLOSED_STATUSES` in
`RequestList.jsx` hardcodes a frontend copy of backend lifecycle
knowledge, self-flagged in its own code comment as provisional;
`Request.updatedAt` has no `@updatedAt` directive, so `PATCH` silently
never bumps it (latent bug for future status-sorting UI); the
`role === 'ADMIN'` branch in `GET /` is currently dead code — nothing
anywhere sets a user's role to ADMIN yet.

**Jira**: transitioned Open → Implementing → Reviewing → Landed →
Reconciled, all via named transitions, Aegis Claim/Falsifier/Evidence
written at pickup and updated with live post-merge re-verification
before Reconciling. Parent 2 (Requests/Intake) correctly stayed at
Implementing (has other Open children: G411-63, G411-64) — note: G411-67
isn't linked as a formal Jira child of G411-2 (referenced textually as
"Parent 2" in its description only), worth fixing for hygiene sometime,
not urgent.

**Not yet done / worth knowing**: no admin-role-assignment mechanism
exists anywhere yet, so `GET /`'s admin branch can't currently be
exercised by a real user — whoever builds admin tooling (G411-37+)
needs this.

## Where things stand

- **Production was broken end-to-end, now fixed (G411-16 correction).**
  Live-state review (prompted by Gavi asking "did we finish writing the
  damn thing" after a Vercel 404 was found) discovered the deployed
  frontend's every `/api/*` call 404ing — Vite's dev-only proxy has no
  production equivalent, and no `vercel.json` rewrite existed pointing
  at the real Render backend. Render itself was live and correct the
  whole time (an early `curl` hit a cold-start timeout and got
  misread as "never connected" — corrected once retried with a longer
  timeout). Fixed via PR #9 (`client/vercel.json`, one rewrite rule),
  merged, verified live on `https://gavi411-ten.vercel.app/api/health`
  and `/api/requests/match`. G411-16 was already Reconciled in Jira
  without this ever being tested end-to-end — left Reconciled (the
  underlying claim is now actually true) but a correction comment was
  added rather than silently re-passing it.
- **G411-66 (sign-in UI gate) — Reconciled.** First agentic-first pilot
  (decision #62): `agent-backend` role built it unattended on
  `agent-backend/G411-66-signin-gate`, caught a real bug along the way
  (`@clerk/react` has no `SignedIn`/`SignedOut` — the ticket's own
  assumption was wrong; built with `useUser().isSignedIn` instead, no
  new dependency). Live Sibling review caught one more instance of the
  same wrong assumption in a stale `main.jsx` comment, fixed it too. PR
  #8 merged. Falsifier re-confirmed live on real production via
  Playwright right before Reconciling — sign-in gate renders correctly,
  zero console errors.
- **G411-72 (intake path fixes) — Reconciled.** A deliberate, requested
  live-state gap analysis (not doc-vs-doc, actual running code/DB
  against what's claimed) turned up three real bugs: `POST
  /api/requests/match` was reachable unauthenticated (added
  `requireAuth` as a backend backstop to `App.jsx`'s client-side gate);
  `'get'` was seeded as a keyword under both RESEARCH and PURCHASE
  (accidental duplicate — caused every "get"-containing request to
  spuriously suggest RESEARCH; removed from RESEARCH, kept under
  PURCHASE); `Trigger` had no uniqueness constraint and `seed.js` had no
  idempotency guard (a rerun would've silently doubled every row, which
  would've broken G411-42's future live trigger-editing UI). Added
  `@@unique([keyword, requestType])`, migrated live to Neon,
  `skipDuplicates: true` in `seed.js`. Scope grew mid-PR (Gavi's call)
  to also fold in two `TravelFields.jsx` UX fixes (G411-65 follow-up):
  the booking-number consent checkbox now reveals the input instead of
  just disabling it with no visible reason (unchecking clears any typed
  value), and the "Add flight" button label now reads "+ Add flight
  details" when empty vs. "+ Add another flight" once one exists.
  Wording on the consent checkbox was Gavi's own edit, satisfying the
  subjective-UX review gate directly. PR #10 merged, re-verified fresh
  against merged `main` before Reconciling.
- **Decision #63 (`gavi411-brain.md`), mid-session**: PR review policy
  corrected — Sibling review (Claude Code, live) was always meant to
  *be* the review mechanism, not a precursor to an outside human
  approval. Branch protection's "1 approval" requirement had become a
  real blocking dependency in practice (only counts write-access
  collaborators, decision #61) despite Gavi working solo. Now: **Sibling
  review passes → self-merge**, no outside approval waited on.
  `enforce_admins: false` already meant Gavi's own merges bypassed it;
  the discipline lives in the policy, not the GitHub setting. Also
  flips which side needs its own session — agentic dispatch is now the
  default, live manual pairing is the occasional case that steps into
  its own tab.
- **Gap-analysis process note, worth remembering**: Gavi pushed back
  hard mid-session on gap analysis only surfacing real problems
  reactively (via his own follow-up questions) rather than
  systematically. The fix applied was a genuine live-state sweep —
  checking actual running/deployed state (Clerk config via its real
  API, Vercel/Render live endpoints, DB constraints vs. what code
  actually writes) against what's documented/ticketed as done, not
  re-reading docs against each other. This found the invite-gating gap
  (Clerk `sign_up.mode` was `"public"`, not restricted — see G411-41's
  updated scope) and the deploy-pipeline gap above. Worth running this
  kind of check periodically, not just once.
- **G411-41 scope updated**: now owns the real invite-link mechanism
  (one-time token in the URL, e.g. `?token=...` on the app's own root —
  no separate `/signup` page, no email required up front since Gavi
  won't always know it and friends may use a different email or Google
  OAuth). G411-71 (an earlier, duplicate ticket for the same gap) was
  closed/Reconciled with a comment pointing here.
- **G411-69 scope updated**: now covers both phone number AND profile
  picture in one combined `/complete-profile` first-login flow. Real
  gap confirmed via Clerk's actual type definitions: OAuth sign-in
  copies a real photo (`hasImage: true`), email sign-in never does —
  and nothing in `server/middleware/auth.js` persisted it either way
  before this ticket. Direction: auto-save OAuth photos, prompt
  (skippable) for email sign-ups to upload one via Clerk's native
  `setProfileImage()`, and nudge everyone to confirm their photo looks
  right. Phone number: country-code selector, accepts Israeli local
  `05X...` format (not `+972...` or bare digits — Clerk's phone-auth
  doesn't support Israeli numbers at all, which is *why* this needs
  manual collection, not a reason to reject them). G411-70 (duplicate)
  closed/Reconciled with a comment pointing here.
- **Gap analysis complete.** All 31 findings from `gavi411-gap-analysis.md`
  (6 High, 13 Medium, 12 Low) are resolved or explicitly deferred with
  reasoning — full live status, per-finding resolution, and corrections
  Gavi made along the way are in **`gavi411-gap-analysis-followup.md`**,
  not duplicated here. Two Low findings (E2, E3) are deliberately left
  open pending the planned agentic-first shift (item 6 below) rather than
  acted on now. Nothing left to pick up from this list on its own.
- **G411-23 (request creation endpoint + credit deduction) — Reconciled**
  (walked Reviewing → Landed → Reconciled later the same day, with a
  fresh evidence re-check, per Gavi's explicit go-ahead). Scope grew
  mid-session: the backend endpoint Landed
  first, then `handleSubmit` (the frontend wiring that actually calls
  it) was folded into this same ticket per Gavi's call, since no other
  ticket owned it either (see brain.md decision #57 for the general
  lesson this produced: Reconciled needs the ticket's *current* full
  scope landed, not just whatever reached Landed first).
  **PR #4 review, fix, and merge (this session, later pass)**: Matan
  left two real review comments — missing `res.ok` check before
  `res.json()` in `handleContinue` (a failed match call could throw
  with no user feedback), and a missing `e.preventDefault()` on
  Enter-to-continue. Both fixed and pushed (`c6015db`) — `handleContinue`
  now guards on `res.ok`, shows an inline error on the `describe` step
  (not just `followup`, since this error can fire before the step
  advances), clears stale errors on retry; Enter now calls
  `preventDefault()` before continuing. Fixes verified live via
  Playwright (Enter still advances correctly on a real match; a
  simulated 500 on `/api/requests/match` shows the error inline with no
  crash, no unhandled console error) — replied to both threads inline.
  **Merge blocker turned out to be access, not review quality**: Matan
  (read-only at the time) left `APPROVE THANKS!` plus two actual
  `APPROVED` reviews, but `reviewDecision` stayed `REVIEW_REQUIRED` —
  branch protection doesn't count an approval from a read-only
  collaborator. Fixed by upgrading **both Matan and eldaduz to write
  access** (Eldad's was still a pending, unaccepted invite — updated the
  invitation's permission to `push` so it takes effect once he accepts).
  Once Matan's existing approval counted, `reviewDecision` flipped to
  `APPROVED` immediately, no new review needed. **PR #4 merged**
  (squash, `adb3d8e`), branch deleted (remote and local), `main`
  fast-forwarded — `handleSubmit` wiring and the review-comment fixes
  are now genuinely on `main`. The fresh combined check ran later the
  same day (transaction logic, race-condition fix, stripEmpty
  scalar+array cases, migration, handleSubmit's Playwright check, all
  re-confirmed live) and the ticket walked Reviewing → Landed →
  Reconciled with Gavi's explicit go-ahead — done, not outstanding.
  - `Request.typeDetails Json?` column (**decision #55**,
    `gavi411-brain.md`) added and migrated to live Neon this session,
    table confirmed empty first.
  - Real gap found along the way: Clerk's provider is wired (G411-13)
    but no sign-in screen/gate exists anywhere in the UI — filed as
    **G411-66**, flagged urgent, next after the current threads clear.
  - Overdraft mechanism idea (Gavi's design: "request anyway" tops
    balance to 1, consumed immediately by the same create-and-deduct
    path) captured as a Jira comment on **G411-47** for its future
    pickup, not built now.
  - **Process slip, caught and fixed**: the original backend commit
    landed directly on local `main` instead of a proper branch. Fixed
    by branching it off and `git reset --hard origin/main`-ing `main`
    back (Gavi ran this himself — the harness correctly refused to run
    a destructive reset unprompted). **Side effect worth knowing**:
    this also discarded Gavi's own uncommitted parallel `DESIGN.md`
    edit from earlier the same session — check whether that needs
    redoing. PR #3 (backend) and PR #4 (handleSubmit) both merged now —
    see the G411-23 entry above for PR #4's full story.
- **GitHub collaborator access, corrected twice this session**: added
  as read-only initially (matching their actual review-only role at the
  time), then **upgraded to write** later the same session — branch
  protection's "1 approval required" rule turned out not to count an
  approval from a read-only collaborator (Matan's `APPROVED` reviews on
  PR #4 sat there without flipping `reviewDecision` until his access was
  upgraded). **Matan: write, active immediately** (already-accepted
  collaborator). **eldaduz: write, pending** — he has an outstanding,
  unaccepted invite; its permission was updated to `push` so he lands on
  write once he accepts, not read. **Branch protection on `main`**:
  blocks force-push/deletion, requires 1 PR approval before merge, admin
  (Gavi) exempt. No CI status check required yet — no workflow exists;
  add one once G411's CI/CD ticket lands a real GitHub Actions
  workflow.
- **G411-65 (type-specific follow-up fields) Reconciled.** Merged to
  `main` via PR #1 `017e148` and PR #2 `928eb27`; Jira walked
  Implementing → Reviewing → Landed → Reconciled, Gavi's go-ahead given
  explicitly for the final transition per the hard-to-reverse rule.
  Before Reconciling, Gavi asked for a comprehensive re-check of chip
  disambiguation across all match combinations (not just what was
  already spot-checked) — 21/21 live Playwright checks passed: each of
  5 types matched alone, zero-match, the built-in dual-keyword case
  ("get" → RESEARCH+PURCHASE), a constructed 2-type combo, a 3-type
  combo, every chip-click advancing to the right followup, and "Not
  quite?"/"None of these" correctly showing the full list (no stray
  "None of these") from every entry point. Confirms multi-match
  disambiguation was never actually dropped — real, worthwhile check,
  not just a rubber stamp. Parent 2 (Requests/Intake) left as-is, not
  rolled to Done — G411-23/63/64 are still Open under it. All four
  matched-type paths
  (TRAVEL/PURCHASE/TECH_SUPPORT/RESEARCH+INFO) now render real optional
  fields instead of just Urgency+Submit; RESEARCH/INFO reuse the shared
  `additionalInfo` field (no dedicated fields per PRD). Built this
  session, one step at a time per Gavi's pacing:
  - **PURCHASE** (`PurchaseFields.jsx`): description, buy-where
    (online/in-store/both), budget, size/color/model preference,
    pickup/delivery coordination, needed-by date, item link.
  - **TECH_SUPPORT** (`TechSupportFields.jsx`): device/platform,
    what's-the-issue, what's-already-been-tried, when-did-it-start,
    does-it-happen-after-something-specific (trigger), call-vs-written
    help-style preference.
  - **RESEARCH/INFO gap resolved**: they now get the shared
    `additionalInfo` field via `GeneralFollowupFields` (a correct match
    shouldn't leave the friend with less than an unmatched one) — no
    new dedicated fields added, confirmed against Gavi that free text +
    additionalInfo is enough, no narrower field generalizes across the
    wide range of research topics.
  - **Real gap found live during this session's wrap-up, fixed
    separately (PR #2)**: a keyword match can be a false positive on
    *any* type, not just GENERAL/"None of these" — concrete case Gavi
    caught: "research vacation options" matches RESEARCH on the word
    "research" alone but is really TRAVEL-shaped. Previously only
    `GeneralFollowupFields` had a "Not quite? Pick a category" escape
    hatch once past the chip step; TRAVEL/PURCHASE/TECH_SUPPORT/
    RESEARCH/INFO followups had none. Fixed by moving that button out
    of `GeneralFollowupFields` (which now only owns the `additionalInfo`
    field itself) into `NewRequest.jsx`, wrapping every followup branch
    identically. Live-verified against the exact reported scenario.
  - **Process note**: mid-session, a rejected/interrupted tool call left
    an edit sitting uncommitted while the local `collab/
    G411-65-travel-fields` branch was already merged and behind
    `origin/main`. Resolved by stashing the edit, fast-forwarding local
    `main` to `origin/main`, branching fresh
    (`collab/G411-65-not-quite-escape-hatch`), and popping the stash
    there — cleaner than trying to rebase the old branch. Also: a
    Playwright verify pointed at a *stale dev server tab left open from
    a previous session* (port 5173, this session's servers ran on
    5174) initially looked like a real bug (RESEARCH skipping the chip
    step) — turned out to be pre-commit code still being served, not a
    regression. Worth remembering: always confirm which port/session a
    "bug you're seeing" is actually running before chasing it.
  - Prior session's TRAVEL work (`TravelFields.jsx`/`.css`,
    `DisambiguationChips.jsx`/`GeneralFollowupFields.jsx` extraction)
    re-verified live via Playwright this session before building on top
    of it — confirmed working (date fields, repeatable flight entries,
    booking-number consent gate), no bugs found.
  - Design pattern, now proven across 3 types: `EMPTY_*_DETAILS`
    exported from the owning field-component file (not duplicated in
    `NewRequest.jsx`), controlled `value`/`onChange` (component holds no
    state itself), all fields optional, `<hr>` separators only (no
    group headers), concrete questions over abstract categories, avoid
    re-asking anything free text already covers.
- **Real gap found and filed live**: while picking up G411-22, Gavi
  caught that the matched-type followup path (a real RequestType like
  TRAVEL/PURCHASE gets picked from chips) renders nothing but Urgency +
  Submit — no info field at all, just "tags" the request. Confirmed via
  JQL that no existing child of Parent 2 actually owns this — it fell
  through the cracks between G411-18/19/20/21/22/23. Filed as new
  **G411-65** (Open, not started) — needs real product-content decisions
  (what fields does TRAVEL/PURCHASE/etc. actually need?), not just
  wiring.
- **G411-22 (generic fallback field) Reconciled** (closed as subsumed
  by G411-21, no new code). Closed as subsumed, not built separately — its exact
  scope (conditional additionalInfo field, shown only on "None
  of these"/zero-match) was already fully built as an inseparable part
  of G411-21's own design (the field had to be shared/conditional to
  support the "Not quite?" override without losing typed text). Same
  code, same evidence, cross-referenced back to G411-21's own Aegis
  comment rather than re-verified redundantly. Considered merging
  G411-22 into G411-65 to cut down on near-duplicate-looking tickets —
  decided against it: they cover genuinely different work (fallback
  field vs. matched-type fields), and repurposing 22's number would mean
  rewriting its Claim/Falsifier to describe unrelated work, losing the
  accurate "already done" record. Two tickets, two different pieces of
  work, both correctly tracked instead.
- **G411-21 (disambiguation chip UI) Reconciled.** Built in the same one-step-at-a-time collaborative
  mode as G411-19/20 — real code changes stopped for Gavi's review
  before the next; status/doc updates didn't pause the flow (per his
  explicit clarification this session). Design walked through together
  live before any code: zero-match case, "None of these" vs. zero-match
  landing on different places, whether follow-up fields should be
  per-type or shared. Real flow built (4 paths, all verified live via
  Playwright): (1) real match → chips + "None of these", pick advances
  to that type's followup; (2) "None of these" → straight to full
  5-type list (not GENERAL first — an explicit rejection shouldn't
  re-show a partial list); (3) zero match → skips chips, lands directly
  on GENERAL; (4) "Not quite?" control on GENERAL reveals the same full
  list. New `Chip.jsx`/`Chip.css` component (matches `Input`/`Select`'s
  field pattern). **Also renamed `fallbackNotes` → `additionalInfo`**
  end-to-end (React state, Prisma schema, live Neon migration) — Gavi's
  own naming call, since the field is genuinely shared across every
  followup path now (single state, not per-type fields — so switching
  category never loses what was typed, no copy-over logic needed).
  Table verified empty before migrating, no data risk. `gavi411-prd.md`
  §4.1 and G411-21's Jira description both updated to match the real
  flow (superseding the simpler 2026-08-20 version, kept for history).
  **New G411-64 filed** (Open, not started): whole-flow visual/animation
  redesign — Gavi's explicit call to defer styling until the flow is
  functionally complete rather than chase a moving target (current
  implementation is one `Card` that grows per step, not the intended
  feel). All pushed to `main`.
- **G411-20 (trigger taxonomy seed data) Reconciled.** Built in one-step-at-a-time collaborative
  mode per Gavi's explicit pacing request this session — each real
  code/content change stopped for his review before the next; status
  transitions and doc updates didn't count as steps needing a pause.
  `prisma/seed.js`: 57 keyword→RequestType rows across 5 of 6 types
  (GENERAL deliberately has none — it's the fallback when nothing else
  matches). Content is Gavi's own real judgment calls, not auto-filled:
  "get" intentionally duplicated as both RESEARCH and PURCHASE (two
  Trigger rows, same keyword — reflects that Gavi finds/prices things
  but doesn't transact); "book" excluded as ambiguous/redundant;
  "returning"/"departing" considered for TRAVEL then dropped by Gavi to
  avoid a real substring collision against PURCHASE's "return" under
  the current non-word-boundary matcher (concrete example feeding
  G411-63); media nouns (ebook/movie/tv show) considered and skipped —
  existing intent words already cover the real signal. Run against live
  Neon: table confirmed empty before, 57 rows after (cross-checked via
  `grep -c` on the file vs. live DB count, exact match). Falsifier run
  via real curl calls against the live `/api/requests/match` route
  post-seed: "flight got cancelled" → TRAVEL, "get a good deal on a
  laptop" → RESEARCH+PURCHASE (confirms the dual-mapping works),
  "wifi stopped working" → TECH_SUPPORT, unrelated text → `[]`
  (correct empty match, not a false positive). All pushed to `main`.
- **G411-19 through 23 moved [You] -> [Collab] mid-session** — Gavi's
  own fallback-rule call, tired and wanting faster visible progress
  while staying involved and still writing/understanding the code, not
  a full [Agentic] handoff. Documented in CLAUDE.md's fallback-rule
  section and `gavi411-task-list-source.md`; all 5 tickets' Jira
  descriptions updated to match.
- **G411-19 (keyword-matching engine) Reconciled.** Built directly (per the [Collab] pace), Gavi
  reviewing/asking questions live rather than typing it himself line by
  line — walked through `handleContinue`, the fetch/JSON/async
  mechanics, `matchKeywords.js` logic, and the dev proxy vs. CORS
  distinction together. Built: `server/lib/matchKeywords.js` (queries
  `Trigger` table, case-insensitive substring match, returns distinct
  matched RequestTypes — deterministic, no LLM), `POST /api/requests/match`
  route in `requests.js`, a dev-only Vite proxy (`client/vite.config.js`,
  forwards `/api/*` to :3000) so the frontend can use relative fetch
  paths, and `NewRequest.jsx`'s `handleContinue` now genuinely calls it
  and advances the step. Verified end-to-end via live Playwright (real
  200 response through the full chain) and a fresh direct curl at
  wrap-up time, including a Hebrew-text check (no crash, Unicode-safe
  `.toLowerCase()`/`.includes()`). Also removed a stale "not this task:
  G411-19" line from `NewRequest.jsx`'s scope comment now that it's
  implemented — the ticket's own scope re-verified line-by-line against
  its Jira description at wrap-up per Gavi's ask, nothing missed.
  **Known gap, filed separately as G411-63** (not fixed inline, avoided
  scope creep mid-ticket): the substring match isn't word-boundary-aware
  — a keyword like "light" would false-positive inside "flights."
  Harmless today since G411-20 (trigger seed data) doesn't exist yet, so
  no real keywords are live. `ponytail:` comment in `matchKeywords.js`
  points to G411-63. Production caveat, not yet fixed (deferred by
  Gavi's call): the frontend's `/api/requests/match` fetch uses a
  relative path that only works via the dev proxy — will need an env var
  or same-origin deploy shape once G411-16-style deploy touches this
  flow; CORS is already set up as the fallback for a cross-origin deploy.
  All pushed to `main`.
- **G411-18 (intake form shell) Reconciled** (Gavi confirmed). Real, live-designed session — flow was substantially
  redesigned from the original PRD wording, live with Gavi, not built
  from a spec handed down: no live/debounce matching (runs once on
  Continue instead), single-select disambiguation chips with an
  always-present "None of these" escape hatch (not multi-select "pick
  all that apply"), fallback field conditional on "None of these" (not
  always-present), urgency asked in the shared follow-up step regardless
  of matched type. `gavi411-prd.md` §4.1 rewritten to match (old wording
  kept struck-through for history); G411-19/21/22's Jira
  summaries/descriptions updated to match (G411-20 untouched, genuinely
  unaffected); full rationale posted as a comment on G411-18.
  Built: `client/src/pages/NewRequest.jsx` (step-driven form: describe →
  chips → followup), new `Select.jsx`/`Select.css` component (matches
  `Input`'s field pattern, for the urgency dropdown), `App.jsx` now
  mounts `NewRequest` for real (was a labeled "temporary preview," this
  is what its own comment called for — no router added, single-screen
  only). Enter-to-continue wired on the free-text input. Chips
  rendering, type-specific follow-up fields, and the match/submit
  handler bodies are correctly left as comment stubs — they're
  G411-19/21/22/23's own scope, not this ticket's; verified via a live
  Playwright check that Continue correctly does NOT advance the step
  while the match-call stub is empty (proves the boundary holds, not
  faked). **Also surfaced and fixed in passing**: `Urgency` enum's
  `MEDIUM → NORMAL` rename (Gavi's call, discussed this session) had
  only ever been edited in `schema.prisma`, never migrated to live
  Neon — found via `prisma migrate status`'s false "up to date" (it
  only checks migration-folder vs. applied-migrations, not schema-file
  vs. live DB). Verified the `Request` table was empty (zero rows, real
  risk-free) before hand-writing and applying a migration
  (`prisma migrate deploy`, since `migrate dev`'s interactive mode isn't
  supported here) — confirmed live via raw enum query afterward. Also:
  `Input`/`Select`'s shared radius moved from `--radius-pill` to
  `--radius-lg` (Gavi's call — pill worked for `Button`, read as
  over-rounded on text fields). All pushed to `main`.
- **G411-10 process gap found and fixed**: the DB schema code itself was
  genuinely done and migrated to live Neon back in the G411-13 session,
  but the Jira ticket had silently sat at **Open** since then — never
  walked through transitions, zero Aegis-field comments. Caught while
  picking G411-18, per Gavi's "double check before moving on" call.
  Fixed properly, not just fast-forwarded: re-verified real state fresh
  (`npx prisma migrate status` → up to date against live `neondb`,
  schema file reviewed directly for all required entities), retroactive
  Claim/Falsifier/Evidence posted as a comment, walked Open →
  Implementing → Reviewing → Landed → **Reconciled** (Gavi's go-ahead
  given). No code changes (nothing to commit) — this was purely a
  tracking-state correction.
- **G411-14 (bidi text rendering) Reconciled.** `dir="auto"` added to `client/src/components/Input.jsx`'s
  `<input>` — the only freeform text field that exists yet (`App.jsx` is
  a throwaway preview, `Input.jsx` is the real shared primitive from
  G411-17). One-line change, `you/G411-14-bidi-input` merged to `main`
  (`805bc1d` → `5f559c1`, pushed). Verified three ways: (1) initial
  Playwright check, (2) an 8-case Playwright matrix (Hebrew-only,
  Hebrew-leading, English-leading, number+Hebrew both orders, dense
  mixed, English-only, numbers-only), (3) Gavi's own live dev-server
  check in a real browser. All correct **except** one real, expected
  limitation: densely-alternating Hebrew/English/number strings (e.g.
  "CAN YOU לעזור לי TO למצוא 45 THINGS") don't visually read as clean
  prose — standard UAX#9 run-reordering behavior, not a bug. Real fix
  would be `unicode-bidi: isolate` wrapping per embedded run, which
  requires the text to already be *segmented* into per-language chunks —
  **impossible to do reliably for arbitrary user-generated freeform
  text** (no safe general segmentation exists). Explicitly out of scope,
  logged as a `ponytail:` ceiling comment on the ticket, not pursued.
  Jira: Open → Implementing → Reviewing → Landed → **Reconciled**
  (transition to Landed was blocked once by the permission classifier
  mid-session, retried successfully after Gavi's own check — flagged
  live rather than silently retried/skipped; Landed → Reconciled done
  after Gavi's explicit go-ahead, per the hard-to-reverse rule).
- **G411-17 final polish**: system-font fallback stacks rendered
  inconsistently across OS/devices. Loaded real Google Fonts — Google
  Sans (weight 600) for the "Gavi411" wordmark only, Rubik for
  everything else — via `<link>` in `client/index.html`, `--wordmark`/
  `--sans` tokens in `index.css`. Verified via Playwright (computed
  font-family, real glyph render, zero console errors), confirmed good
  by Gavi. Commits `df973e1`, `79471ce`. Still Reconciled, no reopen
  needed — Jira comment added recording the change.
- **G411-15, G411-16, G411-17 all Reconciled.** Gavi caught a real
  process gap: G411-17's design direction (dark green primary, serif
  headings) self-merged clean (green build) without ever being checked
  against Gavi's actual intent — he'd given 16 reference images, the
  subagent picked a direction unilaterally. Corrected live together:
  gold/amber primary (from the actual budget-tracker inspo image), sage
  green demoted to secondary accent, serif dropped entirely (sans
  everywhere), an invented "Save for later" button removed, CTA
  centered. Iterated on saturation/lightness using **Playwright**
  (newly installed as a `client` devDependency this session — no
  headless-browser tool existed before, made visual verification
  painfully indirect/unreliable). New standing policy in
  `gavi411-commit-convention.md`: **subjective-judgment children**
  (visual/design/copy/UX) always need Gavi's own eyes before merge,
  regardless of ownership tag — a clean build was never evidence of a
  correct design call. G411-15/16 also fully verified live via
  Playwright (SW confirmed `active`, zero console errors on both
  Vercel/Render); caught and fixed a stale-purple `theme-color` leftover
  from before the palette correction. All pushed, redeployed, confirmed
  live matches locally-approved screenshots exactly.
- **Session-boundary rule for `[Agentic]` work, decided this session**:
  `[Agentic]` subagent work always runs in a separate Claude Code
  session from `[You]`/`[Collab]` pairing — never backgrounded inside a
  session doing live pairing, confirmed painful when 15/16/17 ran
  backgrounded during live G411-14 prep and the transcripts became
  unreadable (all subagents' raw tool calls interleave into the same
  transcript — no true isolation from inside one session). Documented in
  `CLAUDE.md` and `gavi411-commit-convention.md`. G411-14 itself has not
  started yet as a result — this was the reason the session paused on it.
- **G411-13 Reconciled** (Clerk OAuth wiring). Full chain: `agent-backend`
  subagent built middleware/wiring against placeholder keys first → real
  `.env`/`client/.env` symlinked in from the main worktree (new setup,
  see `gavi411-commit-convention.md`) → **G411-10 finally migrated**
  (`npx prisma migrate dev --name init` against live Neon — was open
  since G411-10's original session) → live Sibling review caught
  `@clerk/clerk-react` as npm-deprecated, swapped to `@clerk/react` →
  that swap wasn't a safe drop-in (v6 dropped `SignedIn`/`SignedOut` for
  `<Show when="signed-in"|"signed-out">`, caught via a real white-screen
  regression, fixed via Clerk's actual migration docs) → re-verified live
  end-to-end **twice** (real browser sign-in → `/api/me` → 200) → merged
  to `main` → **post-merge `client/` build failed** on `main` because
  `node_modules` there was stale relative to the newly-merged
  `package.json` (`npm install` fixed it; documented as a new
  merge-back staleness risk, same class as the pre-launch one). Jira
  walked the full Open→Reconciled path with two separate evidence
  rounds recorded as comments.
- **New process from this session**: `.env` files are gitignored so
  they're invisible across worktrees by default — real files live in the
  main worktree, symlinked into each agent worktree
  (`ln -sf .../Gavi411/.env .../Gavi411-agent-<role>/.env`, same for
  `client/.env`). Documented in `gavi411-commit-convention.md` along with
  a subagent-launch checklist (check worktree staleness, merge `main` in,
  re-symlink `client/.env` if `client/` didn't exist before) and a
  parallel-launch safety rule (only run subagents side by side when file
  scopes genuinely don't overlap).
- **New `agent-frontend` role/worktree** added (`../Gavi411-agent-frontend`,
  `agent-frontend@gavi411.local`) — none of the existing 5 roles fit
  G411-15 (PWA). Scoped narrowly to client-side *infra* only (build
  config, service worker) — frontend product UI stays `[You]` as before,
  this doesn't reopen that boundary.
- **G411-12 Reconciled.** Scaffold merged to `main` (commit merges
  `you/G411-12-vite-scaffold`), Jira walked Open → Implementing →
  Reviewing → Landed → Reconciled via named transitions, Aegis fields
  posted as an issue comment, evidence (`npm run build`) re-run fresh at
  close, not carried over. Also corrected two doc mistakes found this
  session while resuming G411-12: (1) Collab-task scaffold ownership was
  recorded backwards ("Gavi scaffolds" — fixed to "Claude scaffolds, Gavi
  drives logic"); (2) RTL/Hebrew scope was overstated as full page-layout
  RTL support — corrected to bidi text rendering only, scoped to any
  freeform text field (input or display) on either side of the app, not
  friends'-input-only and not a page-mirroring pass. See `gavi411-brain.md`
  decision #22. G411-14's Jira summary/description updated to match.


- **All 62 Jira issues (52 Tasks + 10 Epics) now have real Descriptions**,
  populated in one batch by a background agent from ONLY the existing
  source docs (`gavi411-prd.md`, `gavi411-task-list-source.md`,
  `gavi411-jira-tree.md`, `gavi411-jira-aegis-template.md`) — no invented
  scope or acceptance criteria. Each Task description has three parts:
  **Scope** (from task-list-source, with owner tag), **Detail** (PRD
  excerpt cited by section, e.g. "per PRD §4.4" — or an explicit "no
  additional PRD detail beyond scope above" where the PRD is thin), and
  **Not covered by this task** (explicit boundary to sibling tasks).
  Zero API errors, zero skipped. Spot-checked G411-30 and G411-11 against
  their source docs directly — both accurate, no fabrication found.
  Reason this was done: Gavi flagged real ambiguity about what tasks
  actually include; this closes that gap using only what already existed,
  rather than writing new spec on the fly.
  - `CLAUDE.md`'s session-start ritual (step 3, pick-the-task) now
    includes a staleness check: re-verify a task's Description against
    the PRD/task-list-source before starting work, since if those source
    docs change later, the batch-written description could drift stale.
  - Committed along with the rest of this session's doc changes —
    commit `fd068d1`.

- **"Wrap it up" rewritten as an enforced checklist** (`CLAUDE.md`): the old
  prose version let steps silently drop — confirmed this happened to
  G411-11's Jira transition, which sat unmoved across multiple sessions
  even after the codeword was said twice. Replaced with an 8-step
  checklist ending in a mandatory ✓/✗ report line, so a skipped step is
  visible in the same turn instead of discovered later. This is a *process*
  fix only — nothing auto-runs; it still depends on the codeword being
  said and every step actually being executed correctly, same as before.
- **Aegis-spec.md finally read directly this session** (was cited but never
  opened before). Corrected a real misunderstanding: Jira's workflow has
  **five** states, not four — `Aegis-spec.md` §4.1 defines Open →
  Implementing → Reviewing → **Landed** → Reconciled. Landed = merged/live,
  not yet reconciled against acceptance criteria; Reconciled = acceptance
  formally re-checked against landed state (§5.5) — the true terminal
  "Done."
- **Live Jira workflow fixed to match the spec**: the board had a `Landed`
  column with 0 issues and no transitions into it. Gavi added the missing
  named transitions in Jira workflow settings and published: Open —Start
  Implementing→ Implementing —Move to Review→ Reviewing —Reviewing →
  Landed→ Landed —Landed → Reconciled→ Reconciled, plus a global "Any →"
  on all five statuses (including Landed, the one gap). Confirmed live via
  the Jira transitions API against G411-11.
- **G411-11 status re-verified, not re-decided**: still `Reconciled` (was
  already closed out in an earlier session, per this file's prior
  version — this session just re-confirmed it live rather than assuming).
  Checked routes/requests.js against the source backlog doc: it's still
  comment-stubbed, and correctly so — the real route logic belongs to
  G411-23 and G411-30..36 (separate `[You]` tasks, different Epic), not
  G411-11's scope. `CLAUDE.md`'s "Current state" section updated to say
  Reconciled instead of stale "in progress."
- **Branch/PR/review policy, ownership split, context-signal policy**: all
  still live as documented in `CLAUDE.md` — unchanged this session.
- Folder naming is **`server/`** and **`client/`** — `client/` scaffold
  landed per recent commits (572a423), not yet built out further.

## Open threads / nothing currently blocking

**Nothing blocking.** G411-23, G411-66, G411-72, G411-16 all confirmed
Reconciled live in Jira this session (not assumed from a prior note).
Gap-analysis followup done (see `gavi411-gap-analysis-followup.md`,
E2/E3 Low deliberately left open, tied to the agentic-first shift).

**Known gap, not blocking, recorded**: `gavi411-brain.md` decision #65 —
Repowise's per-role git-identity provenance wasn't actually fed for
G411-66/G411-72 (built via GitHub PR, not the persistent worktree +
`git-as-agent-*` switch this project's convention calls for). Not
retroactively fixed; the launch checklist that should prevent a repeat
is in `gavi411-commit-convention.md`, use it properly on the next launch.

Also still outstanding from an earlier session: Gavi's uncommitted
parallel `DESIGN.md` edit was discarded by a `git reset --hard` fixing a
branching slip — check with him whether that still needs redoing, this
has been carried forward a few sessions now without resolution.

## Next on the spine

Foundation (G411-10–17), G411-18–23, G411-65, G411-66, G411-16, G411-72
all Reconciled. **G411-67 is next** — see "Next task" at the top of this
file for full pickup instructions (it's the live agentic-first pilot #2).

**After G411-67, in order:**
1. **G411-68** (request-access homepage form) and **G411-69**
   (post-signup profile completion, phone + photo) — both Open, both
   real gaps found via the 2026-08-23 gap analysis, neither picked up
   yet. Check for overlap with G411-41 at pickup (both tickets' own
   descriptions flag this).
2. Previously tracked, still deliberately deferred: G411-47 (overdraft
   — mechanism folded into its Description per gap-analysis finding
   F3), G411-63 (word-boundary matching), G411-64 (visual/animation
   redesign).
3. Agentic-first workflow itself is now live, not just decided — G411-66
   was pilot #1 (Reconciled), G411-67 is pilot #2 (see "Next task"
   above). Two guardrails still apply every ticket (decision #60,
   restated as concrete checkpoints in `CLAUDE.md`'s Required
   workflow): major decisions come to Gavi before being acted on, and
   every completed chunk gets a real rundown — never auto-advance to
   the next ticket without his go-ahead.


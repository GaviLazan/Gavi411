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

2026-08-23, later session (later than the entries below — see top item).

## Where things stand

- **Gap analysis in progress**: a full PRD/Jira/code audit ran this
  session (31 findings — 6 High, 13 Medium, 12 Low). The original
  report is `gavi411-gap-analysis.md` (repo root, permanent); the live
  working status of acting on each finding — what's resolved, what's
  next, corrections Gavi made along the way — is tracked separately in
  **`gavi411-gap-analysis-followup.md`**, not duplicated here. Check
  that file for the real state of this effort; this file just needs
  you to know it's happening and isn't done yet (currently at: all 6
  High done, several Medium done, next up is C6).
- **G411-23 (request creation endpoint + credit deduction) — status:
  Reviewing, not Reconciled.** Scope grew mid-session: the backend
  endpoint Landed first, then `handleSubmit` (the frontend wiring that
  actually calls it) was folded into this same ticket per Gavi's call,
  since no other ticket owned it either. That frontend piece is built
  and live-verified (real POST fires, handles success/failure, gets a
  correct 401 since G411-66 isn't built yet) but currently only exists
  on **PR #4** (`you/G411-23-wire-handlesubmit`), open, awaiting
  **Matan's review**. Jira status corrected Landed → Reviewing to
  reflect that (see brain.md decision #57 for the general lesson this
  produced: Reconciled needs the ticket's *current* full scope landed,
  not just whatever reached Landed first). **Once PR #4 merges**: sync
  `main`, do one final combined check, then Reviewing → Landed →
  Reconciled with Gavi's go-ahead — the individual pieces (transaction
  logic, race-condition fix, stripEmpty scalar+array cases, migration,
  handleSubmit's own Playwright check) are already verified and don't
  need re-running.
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
    redoing. PR #3 (backend) merged properly afterward; PR #4
    (handleSubmit) still open.
- **GitHub collaborators added this session**: Matan and eldaduz,
  **read-only** (review/comment, no push/merge) — corrected from an
  initial write-access invite that didn't match their actual
  review-only role. **Branch protection added to `main`**: blocks
  force-push/deletion, requires 1 PR approval before merge, admin
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

**Two open threads:**
1. **PR #4** (`you/G411-23-wire-handlesubmit`) is open, awaiting
   **Matan's review** (real GitHub collaborator, read-only access).
   Nothing to do here except wait — don't ping, don't merge
   preemptively. Once he approves and it's merged: sync local `main`,
   re-confirm the combined landed state once more (not re-running
   individual checks already done — see the gap-analysis entry in
   "Where things stand"), then walk G411-23 Reviewing → Landed →
   Reconciled with Gavi's explicit go-ahead for the final step.
2. **Gap-analysis followup still in progress** — see
   `gavi411-gap-analysis-followup.md` for the real, current status of
   every finding (what's resolved, what's next, corrections made along
   the way). Don't re-derive that list here; that file is the single
   source of truth for it.

Also worth a heads-up at next pickup: Gavi's uncommitted parallel
`DESIGN.md` edit from earlier this session was discarded by a
`git reset --hard` used to fix a branching slip — check with him
whether that needs redoing. Working tree clean otherwise.

## Next on the spine

Foundation (G411-10–17), G411-18–22, G411-65 all Reconciled. **G411-23
is Reviewing** (not Landed, not Reconciled — see above, blocked on PR
#4). `handleSubmit` in `NewRequest.jsx` **is** wired (folded into
G411-23, PR #4) — do not redo this or treat it as unstarted.

**Immediate next actions, in order:**
1. Whenever PR #4 merges: finish G411-23's Reconciled process (see
   "Open threads" above).
2. Continue the gap-analysis followup, one finding at a time with Gavi
   — see `gavi411-gap-analysis-followup.md`.
3. **G411-66** (sign-in UI gate) — still flagged urgent once the above
   two threads are clear; it's the last piece blocking full
   authenticated E2E testing of everything built so far.
4. New tickets filed this session, not yet picked up: **G411-67**
   (request list screen + GET/PATCH routes — high-leverage, unblocks
   messaging/admin/lifecycle), **G411-68** (request-access homepage
   form), **G411-69** (post-signup profile completion).
5. Previously tracked, still deliberately deferred: G411-47 (overdraft
   — mechanism captured as a Jira comment), G411-63 (word-boundary
   matching), G411-64 (visual/animation redesign).
6. **Queued after all of the above**: shift back toward an
   agentic-first workflow (multiple agents working in parallel on more
   of the backlog), per Gavi's explicit instruction — with two
   guardrails he wants kept: major decisions still come to him before
   being acted on, and each completed chunk gets a clear, documented
   rundown of what was done and how it works, not just a diff. Waits
   until the gap-analysis followup is fully resolved — don't start
   early.

**Also queued, per Gavi's explicit instruction**: once the gap-analysis
followup work is fully done, move to a broader re-plan — shifting back
toward an agentic-first workflow (multiple agents working in parallel
on more of the backlog) with two guardrails Gavi wants kept: major
decisions still come to him before being acted on, and each completed
chunk of agentic work gets a clear, documented rundown of what was done
and how it works — not just a diff. This second phase explicitly waits
until the gap-analysis phase (#1) is complete; don't start it early.

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

2026-08-20, mid-session (later than the entries below — see top item).

## Where things stand

- **G411-21 (disambiguation chip UI) Landed, awaiting Gavi's go-ahead
  for Reconciled.** Built in the same one-step-at-a-time collaborative
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

None — clean checkpoint. All doc edits this session are process/reference
corrections, not code changes; nothing uncommitted on the code side from
this session.

## Next on the spine

All of Foundation (G411-10 through 17) is Reconciled. G411-18, G411-19,
and G411-20 all Reconciled. **G411-21 is Landed**, waiting on Gavi's
go-ahead to move Reconciled — do that first next session if not done
before this one ends. After that, in order: **G411-22** (generic
fallback field build) — note most of its scope may already be
subsumed by G411-21's `additionalInfo` field work; check its real
remaining scope at pickup rather than assuming it's untouched. Then
**G411-23** (create endpoint + credit deduction), which is what finally
makes `handleSubmit` real. G411-63 (word-boundary matching) and G411-64
(visual/animation redesign) both tracked, both deliberately deferred —
not urgent yet.

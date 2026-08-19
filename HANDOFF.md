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

2026-08-19, mid-session (later than the entries below — see top item).

## Where things stand

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

G411-10, G411-11, G411-12, G411-13 are all Reconciled — Foundation's
backend/frontend/DB/auth core is done. Remaining Foundation items:
**G411-14** (bidi text rendering for Hebrew content fields, `[Collab]`),
**G411-15** (PWA, `[Agentic]` → `agent-frontend`), **G411-16** (deploy
pipeline, `[Agentic]` → `agent-cicd`), **G411-17** (design system,
`[Agentic]` → `agent-design`). Per the new parallel-launch rule, check
file-scope overlap before running any two of these side by side. Agree
with Gavi which to pick up next; nothing pre-selected.

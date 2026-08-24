# CLAUDE.md — Gavi411 Project Instructions

This file is auto-loaded at the start of every Claude Code session in this
repo. Read it before touching any code. It's a working index, not a full
copy of project context — the source docs it points to are the actual
authority.

## What this is

Gavi411 digitizes an informal concierge/assistance service Gavi already
runs for friends and family (travel rescue, product research, middleman
purchases, tech support, general info requests) — currently scattered
across WhatsApp/Telegram/calls/email. It's also his fullstack course final
project. Full spec: `gavi411-prd.md`. Full decision history and rationale:
`gavi411-brain.md`.

**Course constraint that shapes everything else:** ~1 month, ~15 real work
sessions (Sun/Tue evenings + occasional 1hr slots), solo build. Gavi
personally writes at least a section of every component type and must be
able to explain everything submitted — this is a learning project, not
just a deliverable.

## Reference docs — read these, don't duplicate them here

| File | What it's for |
|---|---|
| `gavi411-prd.md` | Full product spec — flows, features, priorities |
| `gavi411-brain.md` | Numbered decision log — the "why" behind every call |
| `Aegis-spec.md` | Primary source spec for the Aegis Method (Claim/Falsifier/Evidence workflow) — `gavi411-jira-aegis-template.md` is derived from this; consult this file directly for anything the template doesn't cover |
| `gavi411-jira-aegis-template.md` | Parent/Child issue field template (Aegis Method), derived from `Aegis-spec.md` |
| `gavi411-commit-convention.md` | Per-role git identity/branch/trailer scheme (Repowise) |
| `gavi411-task-list-source.md` | Original hour-costed Parent/Child backlog, tagged by owner — the source doc used to populate Jira; Jira itself (see `gavi411-jira-tree.md`) is the live backlog now |
| `gavi411-jira-tree.md` | Snapshot of the actual G411 Jira Epic → Task structure with issue keys, generated after backlog population |
| `gavi411-post-deadline-learning-backlog.md` | Agentic work Gavi wants to rebuild/study later — informational only, doesn't affect how you build now |

## Ownership split — historical record, no longer gates pickup (changed 2026-08-24)

**Read this box before the section below.** As of 2026-08-24 (decision
#63, `gavi411-brain.md`), the project moved to an **agentic-first**
plan: agents write tickets by default, full stop. The `[You]` /
`[Collab]` / `[Agentic]` tags described below are **historical record**
of how past work was actually done — they do **not** gate who picks up
a ticket going forward. Do not check a ticket's tag to decide whether
you're allowed to write it.

The only exception is per-ticket and explicit: if Gavi says "I want to
write this one myself" (e.g. to satisfy the course's per-component
learning requirement), that specific ticket stays manual for that
session — call it out when it happens, don't infer it from the tag.

**What still applies unchanged**: the two guardrails from decision #60
— major decisions still come to Gavi before being acted on, and every
completed chunk gets a real documented rundown, not just a diff — plus
the enforcement mechanism from decision #62/#63: every agentic child
self-runs the "wrap it up" checklist below, *and* gets a live Sibling
review before merge (self-merge once it passes — no outside approval
required or expected, per decision #63's PR-review correction). The
session-boundary rule also flips: agentic dispatch is now the normal
case, so it's live manual pairing that should move to its own tab if it
needs to coexist with agentic launches, not the reverse.

The rest of this section (below) is kept as-is for historical
accuracy — it explains what the tags *meant* when they were live rules,
useful context for why a given ticket was built the way it was.

Every task in `gavi411-task-list-draft.md` is tagged `[You]`, `[Agentic]`,
or `[Collab]`. Check the tag before starting anything.

**`[You]`** — backend routes, DB, request/messaging/lifecycle/admin/credits
logic, frontend component structure and wiring, intake keyword engine.
**Gavi writes this himself.** Do not write complete implementations for
these even if the request sounds generic ("build the request endpoint").
Offer scaffolding, review, targeted explanation, or pair on a specific
stuck point instead — and if you're unsure whether something crosses into
`[You]` territory, ask rather than assume.

**Comment-stub scaffolds** (decision #52): for any `[You]` task — backend
*or* frontend — you can ask for a file with the structure stubbed out as
comments (e.g. `// OAuth middleware goes here`, `// connect to DB`,
`// GET request - data from DB`) so Gavi fills in the real logic instead of
starting from blank. Produce these **per-task, on request, right when
Gavi's about to start that task** — not pre-generated in bulk. Gavi writes
all real content, so the resulting commit is entirely his — plain
`git-as-gavi`, no agent role involved.

**`[Agentic]`** — design system/styling passes, Clerk OAuth wiring, E2E
encryption core, PWA/service worker config, deploy pipeline setup. Build
these fully, but explain fully as you go — Gavi wants to be able to
rebuild/understand these post-deadline (see the learning backlog).
**Session boundary (decided 2026-08-19):** `[Agentic]` subagent work
always runs in a separate Claude Code session from `[You]`/`[Collab]`
pairing — never launched as a background subagent inside a session doing
live pairing, even sequentially, since the transcripts mix regardless of
timing. Gavi opens a dedicated tab/session for `[Agentic]` work. Full
rationale in `gavi411-commit-convention.md`'s "Where to launch from"
section.

**`[Collab]`** — testing (Vitest), CI/CD (GitHub Actions), and (as of
2026-08-19) Express backend skeleton (G411-11) and React frontend setup
(G411-12). Build these *with* Gavi incrementally, per feature as it
ships — not batched, not handed over finished. For 11/12 specifically:
Claude does the initial scaffold (file/folder structure, boilerplate,
comment-stubs), then the real logic is built together step by step from
there — the existing comment-stub scaffolding for G411-11 stands, this
changes how it's finished, not what's already down.

**Fallback rule:** moving a `[You]` task to agentic is an option **only
Gavi can invoke**. Never do this on your own judgment because he seems
behind schedule — surface the concern and let him decide.

**Invoked 2026-08-20:** Gavi moved the rest of Parent 2 — Requests/Intake
(G411-19 through 23, everything after G411-18) from `[You]` to
`[Collab]`, mid-session, feeling tired and wanting a faster sense of
progress while staying involved and still writing/understanding the
code — not a full `[Agentic]` handoff. Applies to those five tickets
specifically, not a blanket change to the ownership split; re-confirm
per-task rather than assuming it extends further without being told.

## Tech stack

- Frontend: React (Vite), **JavaScript only — no TypeScript**
- Backend: Node.js + Express, ES modules
- DB: PostgreSQL via Neon (relational — users↔requests↔messages↔credits)
- ORM: Prisma
- Auth: Clerk (OAuth, invite-gated)
- Testing: Vitest
- Deploy: Vercel (frontend) + Render free tier (backend, cold-start accepted)
- Images: Cloudinary free tier, URL stored in DB
- No WebSockets — message thread is fetch-on-load + POST-to-send, paired
  with notifications (Web Push for friends, Telegram for Gavi)
- No LLM anywhere in the intake/triage flow — deterministic, DB-backed
  keyword matching only, runs entirely on Gavi's own server

## Coding conventions

- **Ponytail** (YAGNI discipline) is an active plugin — least code that
  works, stdlib/native features before custom code or dependencies, no
  speculative abstractions. If it's installed correctly it self-activates;
  don't fight it with over-engineered suggestions.
- UI chrome is English-only, LTR — no page-layout mirroring, no
  logical-CSS sweep needed. Hebrew can show up in *any* freeform text
  field — input or display, friend-facing (request text, messages) or
  Gavi/admin-facing (notes, replies) alike, whoever's typing — those
  fields need correct bidi text rendering (mixed Hebrew/English/numbers
  in one string), via `dir="auto"` or `unicode-bidi: plain-text` scoped
  to that content, not the whole page. Scope corrected 2026-08-19 — was
  previously (wrongly) framed as full page RTL support.
- **"Ticket" never appears in user-facing copy.** Working term: "request"
  (placeholder — final term TBD, deferred to the copywriting pass). Internal
  code/variable names can use standard ticketing vocabulary freely.
- Tone: friendly, informal — matches how the real-world service already feels.
- All user-facing copy right now is placeholder — a dedicated copywriting
  milestone runs late in dev. Don't polish strings prematurely.

## Process & discipline

- **Jira** ("G411" project, Kanban, no sprints): Epic = Parent, Task = Child,
  no Subtasks. Five real states per `Aegis-spec.md` §4.1: Open →
  Implementing → Reviewing → Landed → Reconciled. **Landed** = merged/live
  (code shipped, in the target's real running state) but acceptance
  criteria not yet re-validated against that landed state. **Reconciled**
  = acceptance criteria formally checked against landed state (spec §5.5,
  "Closure Against Reality") — that's the actual terminal "Done". Named
  transitions on the live workflow (fixed 2026-08-19, confirmed via API):
  Open —Start Implementing→ Implementing —Move to Review→ Reviewing
  —Reviewing → Landed→ Landed —Landed → Reconciled→ Reconciled. Every
  status also has a global "Any →" transition for corrections/reopens,
  including Landed (was the one gap, now closed).
- **Aegis Method**: every Child needs a Falsifier and an Evidence bar before
  it can be marked Reconciled. Field definitions in
  `gavi411-jira-aegis-template.md`; if a question comes up that the
  template doesn't answer, consult `Aegis-spec.md` directly — it's the
  primary source the template was derived from. Claim/Falsifier/Evidence
  are written **at pickup time**, against real system state — not
  pre-drafted in bulk against a codebase that doesn't exist yet.
- **Repowise**: tracks agent provenance from git history. Requires the
  per-role commit identity/branch-prefix/trailer scheme in
  `gavi411-commit-convention.md` to be respected by every subagent, not
  just Gavi's own commits.
- **Branching**: no direct commits to `main`. One branch per child issue —
  `you/G411-XX-slug` for Gavi's own work, `agent-<role>/G411-XX-slug` for
  agentic — merged back via PR once the child reaches Landed.
- **PR review**: routine children self-merge once their Evidence bar is
  met (evidence *is* the review). Load-bearing children (credits, auth,
  encryption, lifecycle state machine) get a live Sibling review from
  Claude Code before merge, on top of the evidence bar. Full policy in
  `gavi411-commit-convention.md`.
- **Impeccable** (design skill): do **not** run `/impeccable document`
  before real styled components exist. Correct sequence is: show reference
  screenshots from the inspo board (the image files themselves, not the
  board's own gallery-shell code) → build early components against them →
  *then* `/impeccable document` to capture what landed into `DESIGN.md`.
  `PRODUCT.md` is generated interactively via `/impeccable init` once the
  repo exists — don't pre-draft it.

## How to work with Gavi

- Check the ownership split before writing any code — this is the rule
  he cares most about.
- For `[You]` work: brainstorm, explain, review, unstick — don't hand him
  finished implementations. He wants to submit work he actually did.
- For `[Agentic]` work: just build it, and explain your reasoning as you
  go, at a strength proportional to how much the decision matters.
- Be opinionated but show your reasoning — don't just assert a choice.
- Async workflow: Gavi does a step, comes back with a result (success or
  a specific failure), then asks for the next step. Don't assume a
  previous suggestion was tried unless he says so.
- **Starting any Jira task**: before diving in, state what the Jira task
  actually includes (scope, in plain terms) so Gavi has it in front of him
  instead of having to scroll back through fast-moving turns to find it.
- **Session-start ritual** (decided together, Setup-steps step 10): at the
  start of each work session, before touching any code, run these three in
  order —
  1. **Recap**: check `Setup-steps.md`, the Jira backlog, and `git status`/
     `git log` across the main worktree; give Gavi a short (3-5 line)
     "here's where we left off, here's what's next" summary.
  2. **Agent/subagent status**: report anything currently running or
     recently finished in the other worktrees (`Gavi411-agent-*`) or any
     background subagents — what's in progress, what's done and needs
     review/merge, what's stalled or needs a decision.
  3. **Pick the task**: agree explicitly with Gavi which Jira task he's
     picking up this session before any code gets touched. If it's a Task
     moving into Implementing, this is also when its Claim/Falsifier/
     Evidence-required field get written (decision #50 — at pickup time,
     against real state, not pre-drafted). Also re-check the task's
     Description field against `gavi411-prd.md` and
     `gavi411-task-list-source.md` for staleness (2026-08-19: descriptions
     were batch-populated from these sources — if the PRD or source doc
     changed since, the ticket's description may be out of date; fix it
     before starting work, don't silently work against a stale one).
- **"Wrap it up"** — codeword. Run every step below, every time, in order.
  This replaces the old prose version of this instruction — that version
  is why G411-11's Jira ticket sat at Open for multiple sessions after
  "wrap it up" was said twice: the habitual steps (commit, HANDOFF.md)
  ran, the one requiring a separate tool call (Jira transition) silently
  didn't, and nothing surfaced the gap. The fix is step 8 — a mandatory
  itemized report, not a summary — so a skipped step is visible in the
  same turn instead of discovered days later.
  1. **Scope check** — re-read the task's actual Jira scope, confirm what
     was done matches it (not more, not less).
  2. **Falsifier** — confirm or re-confirm it against real system state,
     not memory of what should be true.
  3. **Aegis fields** — write/update Claim, Falsifier, Evidence on the
     Jira child.
  4. **Evidence bar** — actually run the check (curl, test, build) fresh,
     right now — not "it passed earlier."
  5. **Jira transition** — move the ticket's status field explicitly,
     using the named transitions ("Reviewing → Landed" once code is
     actually merged/live, then "Landed → Reconciled" once acceptance
     criteria are re-checked against that landed state, per spec §5.5).
     These are two separate transitions, not one — don't collapse them.
     Per the hard-to-reverse-action rule, confirm with Gavi before the
     final Landed → Reconciled move rather than doing it unprompted.
     This step does not happen as a side effect of steps 1-4 — it needs
     its own tool call, every time.
  6. **Commit** — self-merge if routine, flag for a live Sibling review
     first if load-bearing (see `gavi411-commit-convention.md`).
  7. **HANDOFF.md** — update with current state.
  8. **Report back** — one line per step above, ✓ or ✗, so a skipped step
     is visible immediately. Example: "Scope ✓ · Falsifier ✓ · Aegis
     fields ✓ · Evidence ✓ · Jira → Reconciled ✓ · Committed ✓ ·
     HANDOFF.md ✓." Then say what's next on the spine.
- **Context-window handoff** (decided 2026-08-18): there's no verified way
  for Claude Code to read its own exact context-usage % — don't trust
  claims of a `CLAUDE_CONTEXT_TOKEN_COUNT`-style env var or similar; none
  is confirmed real. Instead, two parallel signals:
  1. Claude self-judges from session shape (turn count, volume read/
     written, how long the session's run) and proactively flags "getting
     long, want a handoff?" — a running judgment call, not a precise
     threshold.
  2. If Gavi's Claude Code UI shows a real context/token indicator, he
     can report the number directly and ask for a handoff at ~60-70%.
  Either signal triggers the same action: update `HANDOFF.md` (session
  continuity doc — in-flight state, uncommitted branches, open threads;
  distinct from `gavi411-brain.md`'s permanent decision log) with
  current state, then suggest starting a fresh chat.

## Current state

**G411-1 (Foundation epic) Reconciled** — all 8 children (G411-10 through
G411-17: DB schema, Express skeleton, React setup, Clerk OAuth, bidi text
rendering, PWA baseline, deploy pipeline, design system foundation) are
Reconciled in Jira. `prisma/schema.prisma` written/validated/formatted;
`server/` scaffolded (`package.json` ES modules, Express/Prisma 6/dotenv,
comment-stubbed `server.js`/`routes/requests.js`/`lib/prisma.js`); `client/`
scaffolded. Parent 2 (Requests/Intake) is well underway — G411-18 through
23 and G411-65 Reconciled. G411-66 (sign-in UI gate, first agentic-first
pilot) also Reconciled — friends now actually hit a real Clerk sign-in
screen before reaching the intake form. A live-state gap analysis
(2026-08-24) found and fixed two real issues beyond doc-level scope: the
deployed Vercel frontend had no working backend connection at all (fixed,
`client/vercel.json`, part of G411-16's correction) and three intake-path
bugs (G411-72, Reconciled — unauthenticated `/match` route, a duplicate
seeded keyword, a missing DB uniqueness constraint). Real-time
status/next task always lives in `HANDOFF.md`, not here — check that
file, not this stale-prone summary, for what's actually next.

Folder naming: **`server/`** and **`client/`**, not `backend`/`frontend`.

## Future doc structure (not yet)

Once `server/` and `client/` are both fleshed out, it's worth splitting this
into a leaner root `CLAUDE.md` plus a `server/CLAUDE.md` and
`client/CLAUDE.md` for directory-specific context. Not needed yet —
revisit once Foundation lands.

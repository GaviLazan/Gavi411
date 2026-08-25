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

## Ownership split — historical record only (changed 2026-08-24)

As of 2026-08-24 (decision #63, `gavi411-brain.md`), the project moved
to **agentic-first**: agents write tickets by default, full stop. The
`[You]` / `[Collab]` / `[Agentic]` tags that used to appear on tasks are
**historical record only** — they describe how past tickets were
actually built, and explain past commit-convention choices (per-role git
identities, worktrees, the old session-boundary rule), but **do not gate
who writes a ticket going forward.** Do not check a tag before starting
work. If you need the old tag definitions for historical context, they're
preserved in git history for this file (this section, pre-2026-08-24) and
in `gavi411-brain.md`'s decisions #31–#63.

The only exception is per-ticket and explicit: if Gavi says "I want to
write this one myself" (e.g. to hit the course's per-component learning
requirement), that ticket stays manual for that session — call it out
when it happens, don't infer it from anything else.

This is a standing default for the current agentic-first period, not a
per-ticket approval gate. The `[You]`/`[Agentic]` tags were real signals
back when work was actually being split by owner — they're not fake
history, they're just not the regime we're in anymore. Finding one on a
ticket, or a HANDOFF.md/ticket mismatch, is worth one line of mention,
but it is not grounds to stop and ask which mode to use (via
AskUserQuestion or otherwise) — that reopens a decision that's already
made project-wide for now. Note the conflict and proceed agentic.
(Corrected 2026-08-24 after doing exactly this on G411-67.) If the
project ever moves back to a split-ownership regime, this default
reverts and tags become load-bearing again — that would be a new,
explicit decision in `gavi411-brain.md`, not something to infer.

Two things from the old regime carry forward unchanged:
- **`[Agentic]`-era comment-stub scaffolds** (decision #52) are still a
  valid tool when Gavi does choose to write a ticket himself — ask for
  the file stubbed out as comments so he fills in real logic, produced
  per-task at pickup time, not pre-generated in bulk.
- **Session boundary** still applies, but flipped (decision #63): agentic
  dispatch is now the default, so it's *live manual pairing* that should
  move to its own tab if it needs to coexist with an agentic launch — not
  the reverse. Same underlying reason as before (interleaved transcripts
  become unreadable); see `gavi411-commit-convention.md`'s "Where to
  launch from" section for the full mechanics.

## Required workflow — read this every session, not just once

This section exists because of a real failure mode (2026-08-24): a
session confidently reasoned about "the plan" from memory instead of
re-reading, gave Gavi advice built on assumptions the tools didn't
actually support, and needed three separate corrections before the
description of what actually happens matched reality. These rules exist
to stop that from repeating, not as aspirational process.

**1. Read before acting, every time — don't reason from memory.**
`CLAUDE.md`, `HANDOFF.md`, and `gavi411-brain.md` all get edited by
other sessions between your turns (multiple sessions/agents run against
this repo now). A file you read five turns ago may already be stale.
Before stating what "the current plan" or "current state" is, re-read
the relevant doc rather than recall it — especially `HANDOFF.md`
(perishable, changes constantly) and any file a system-reminder says
changed on disk since you last read it.

**2. Don't assert how a tool behaves — check its actual spec first.**
Claims like "this will run unattended," "this chains into the next
step automatically," or "this enforces X" must be verified against the
tool's real description (`ToolSearch`, its documented behavior) before
being said out loud. If you haven't checked, say so and check, rather
than presenting a guess as settled fact. This project has already hit
one real instance of this: an agentic "pilot" was described as
self-orchestrating when the actual tools only provide background
dispatch + notification — every chaining/review/go-ahead step still
needs a human or a live session to act on it.

**3. Three checkpoints per ticket, non-negotiable, regardless of who's
writing the code** (decision #60's guardrails, restated as concrete
gates so they can't be silently compressed into one step):
   - **Mid-flight**: if a real decision comes up that isn't yours to
     make (scope, ownership, architecture, a judgment call the ticket
     itself doesn't answer) — stop and bring it to Gavi before acting on
     it. Don't resolve it and mention it after the fact.
   - **How to stop, concretely (added 2026-08-24, real failure)**: a
     question buried mid-paragraph while work keeps moving is not a
     stop — by the time Gavi reads and answers it, tool calls have
     already run past it, so his answer lands as an after-the-fact
     confirmation of something already done instead of a real go/no-go.
     Caught live on G411-67: the build agent hit "what counts as
     'closed'?" (a genuine spec ambiguity), picked the broader reading
     itself, and only documented the choice in the PR/Jira for later
     review — Gavi answered it correctly once he spotted it, but the
     code was already written by then. The fix: when a subagent (or the
     orchestrating session itself) hits this kind of ambiguity, it uses
     `AskUserQuestion` — a real blocking pause, no further tool calls on
     that thread of work — not a note-and-continue, and not "pick the
     defensible option and flag it in the final report." This applies
     even to unattended background agents: if the dispatched agent
     itself can't call `AskUserQuestion`, it must stop and hand the
     question back to the orchestrating session to ask, not resolve it
     unilaterally and move on.
   - **End-of-ticket rundown**: before/alongside the Sibling review,
     give Gavi an actual explanation of what was built and how it
     works — not just a diff, not just "done." He needs to be able to
     explain everything submitted (course requirement).
   - **Go/no-go on the next ticket**: a clean Sibling review does not
     imply "proceed to the next ticket automatically." Report the
     outcome and let Gavi decide whether to continue, even if nothing
     looks wrong. Never auto-advance through a queue of tickets.

**4. Sibling review is mandatory on every agentic child, self-merge only
after it passes** (decision #62/#63) — checks tests exist and pass, docs/
`HANDOFF.md` are actually updated, Aegis fields are actually written,
Jira is actually transitioned. No outside human approval is required or
expected (decision #63) — but skipping the review itself, or treating a
green build as sufficient evidence the review happened, is not allowed.

**5. When in doubt about scope, ownership, or whether something needs
Gavi's sign-off — ask. A wrong guess that quietly ships is worse than a
question that costs one turn.**

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
- **PR review** (updated 2026-08-24, decision #62/#63): every agentic
  child gets a live Sibling review from Claude Code before merge — not
  just load-bearing ones, since agentic is now the default rather than a
  special case. Self-merge once it passes; no outside human approval
  required or expected. See "Required workflow" above and full policy in
  `gavi411-commit-convention.md`.
- **Impeccable** (design skill): do **not** run `/impeccable document`
  before real styled components exist. Correct sequence is: show reference
  screenshots from the inspo board (the image files themselves, not the
  board's own gallery-shell code) → build early components against them →
  *then* `/impeccable document` to capture what landed into `DESIGN.md`.
  `PRODUCT.md` is generated interactively via `/impeccable init` once the
  repo exists — don't pre-draft it.

## How to work with Gavi

- Agents write by default now (see "Required workflow" above) — build it,
  and explain your reasoning as you go, at a strength proportional to how
  much the decision matters. Don't check a ticket's old tag first.
- If Gavi explicitly says he wants to write a specific ticket himself:
  brainstorm, explain, review, unstick — don't hand him a finished
  implementation for that one. He wants to submit work he actually did.
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
  8. **Full sync check, every worktree** (added 2026-08-25, real gap
     found live — "sync git" was reported done while the primary
     worktree still had two uncommitted files sitting in it, and
     separately a role worktree had silently diverged from `main`).
     `git status --short` in **every** worktree (primary + every
     `Gavi411-agent-<role>`) — every single one must come back
     completely empty, not "just the ticket's own files are clean." Any
     leftover (untracked, modified, staged) gets resolved — committed if
     it's real work, discarded if it's genuinely nothing — not silently
     left and reported as synced anyway. Then confirm every worktree's
     `git log --oneline -1` shows the identical commit hash as `origin/
     main`. If a role worktree can't fast-forward (diverged, not just
     behind), don't reset blind — diff it against `origin/main` first
     (`git diff origin/main HEAD --stat`) to confirm the branch has
     nothing unique `main` lacks, per `gavi411-commit-convention.md`'s
     "Resync the role worktree right after its own PR merges" section.
  9. **Report back** — one line per step above, ✓ or ✗, so a skipped step
     is visible immediately. Example: "Scope ✓ · Falsifier ✓ · Aegis
     fields ✓ · Evidence ✓ · Jira → Reconciled ✓ · Committed ✓ ·
     HANDOFF.md ✓ · Worktrees synced ✓." Then say what's next on the
     spine.
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
23, G411-65, G411-66, G411-67, G411-63, and G411-73 all Reconciled.
Friends now hit a real Clerk sign-in screen (G411-66), have a request
list/home screen with backing `GET`/`PATCH` routes (G411-67), keyword
matching is word-boundary-aware not naive substring (G411-63), and a
manual dark/light/system theme toggle exists on top of the auto
`prefers-color-scheme` behavior that shipped silently with G411-17
(G411-73). A live-state gap analysis (2026-08-24) found and fixed two
real issues beyond doc-level scope: the deployed Vercel frontend had no
working backend connection at all (fixed, `client/vercel.json`, part of
G411-16's correction) and three intake-path bugs (G411-72, Reconciled —
unauthenticated `/match` route, a duplicate seeded keyword, a missing DB
uniqueness constraint). Parent 2's one remaining Open child is G411-64
(intake flow visual redesign). Real-time status/next task always lives
in `HANDOFF.md`, not here — check that file, not this stale-prone
summary, for what's actually next.

Folder naming: **`server/`** and **`client/`**, not `backend`/`frontend`.

## Future doc structure (not yet)

Once `server/` and `client/` are both fleshed out, it's worth splitting this
into a leaner root `CLAUDE.md` plus a `server/CLAUDE.md` and
`client/CLAUDE.md` for directory-specific context. Not needed yet —
revisit once Foundation lands.

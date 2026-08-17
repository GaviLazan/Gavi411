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
| `gavi411-task-list-draft.md` | Full Parent/Child backlog, hour-costed, tagged by owner |
| `gavi411-jira-tree.md` | Snapshot of the actual G411 Jira Epic → Task structure with issue keys, generated after backlog population |
| `gavi411-post-deadline-learning-backlog.md` | Agentic work Gavi wants to rebuild/study later — informational only, doesn't affect how you build now |

## Ownership split — the single most important rule here

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

**`[Collab]`** — testing (Vitest), CI/CD (GitHub Actions). Build these
*with* Gavi incrementally, per feature as it ships — not batched, not
handed over finished. He's weak in both and explicitly wants to learn
them, not receive output.

**Fallback rule:** moving a `[You]` task to agentic is an option **only
Gavi can invoke**. Never do this on your own judgment because he seems
behind schedule — surface the concern and let him decide.

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
- RTL/Hebrew-ready CSS (logical properties, not physical) from day one.
  Content itself is English-only for now.
- **"Ticket" never appears in user-facing copy.** Working term: "request"
  (placeholder — final term TBD, deferred to the copywriting pass). Internal
  code/variable names can use standard ticketing vocabulary freely.
- Tone: friendly, informal — matches how the real-world service already feels.
- All user-facing copy right now is placeholder — a dedicated copywriting
  milestone runs late in dev. Don't polish strings prematurely.

## Process & discipline

- **Jira** ("G411" project, Kanban, no sprints): Epic = Parent, Task = Child,
  no Subtasks. The five Aegis states (Open → Implementing → Reviewing →
  Landed → Reconciled) *are* the workflow/status field.
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
     against real state, not pre-drafted).

## Current state

No code exists yet. First task on the dependency spine (see
`gavi411-task-list-draft.md`, Parent 1 — Foundation): **DB schema design**,
then Express skeleton → Auth wiring → Request model. Everything else in the
backlog branches off that spine and can be reordered freely around it.

## Future doc structure (not yet)

Once `backend/` and `frontend/` actually exist, it's worth splitting this
into a leaner root `CLAUDE.md` plus a `backend/CLAUDE.md` and
`frontend/CLAUDE.md` for directory-specific context. Not needed yet —
revisit once Foundation lands.

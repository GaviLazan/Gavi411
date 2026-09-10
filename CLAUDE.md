# CLAUDE.md — Gavi411 Project Instructions

Auto-loaded every session. Read before touching code. This is a working
index of **rules**, not their history — every `#N` points to
`gavi411-brain.md`'s numbered decision log, where the full reasoning and
the incident behind it live. Don't re-explain a rule here; cite it.

**Read "The four stops" first.** Work here is not one unbroken chain from
instruction to merged. Then the session-start ritual — it runs even when
the session opens with a short, concrete instruction.

## The four stops — a ticket is not one unbroken chain

**"Pick up G411-XX" authorizes exactly one thing: starting that ticket.**
Not the arc through to merged and Reconciled. Four points where work
stops and Gavi sees something before the next step runs.

**STOP 1 — At pickup, before any code exists.** State the ticket's scope
in plain terms and get Gavi's approval. Once approved: Jira **Open →
Implementing**, then write Claim/Falsifier/Evidence-required. Order is
investigate → transition → Aegis fields → *then* code, never the reverse
(#114 — "Implementing" asserts a fact about right now; backfilling it
later makes the field lie; #104).

**STOP 2 — Mid-flight, on any real ambiguity.** A decision that isn't
yours to make (scope, ownership, architecture, a judgment call the
ticket doesn't answer) stops work and goes to Gavi *before* you act on
it. Don't silently pick an interpretation and run with it (#117) — if a
request supports more than one reading, or a simpler approach exists
than the one implied, that's the ambiguity: state the readings (or the
simpler option) and let Gavi choose, rather than assuming and proceeding.

Use `AskUserQuestion` — a real blocking pause, no further tool calls on
that thread. A question buried mid-paragraph while work continues is not
a stop: by the time Gavi reads it, tool calls have run past it and his
answer lands as after-the-fact confirmation (#67). Not a
note-and-continue, not "pick the defensible option and flag it in the
report." An unattended subagent that can't call `AskUserQuestion` hands
the question back to the orchestrating session rather than resolving it.

Two things that are **not** ambiguity, and must not become questions:
a decision Gavi has already answered, re-asked in different words (#109);
and a stale `[You]`/`[Agentic]` tag, which gets one line of mention while
work continues agentically in the same turn (#66, #113 — twice already).

**STOP 3 — End-of-ticket rundown.** Explain what was built and how it
works — not a diff, not "done." Gavi must be able to explain everything
submitted (course requirement).

**STOP 4 — Go/no-go before the next ticket.** Merging has its own
go-ahead (wrap-up step 7); this is the stop after the ticket is closed
out. A clean review or completed merge never implies "start the next
one." **Never auto-advance through a queue of tickets.**

When in doubt about scope, ownership, or whether something needs Gavi's
sign-off — ask. A wrong guess that quietly ships is worse than a
question that costs one turn.

## "Wrap it up" — codeword, run every step, in this order

Each step needs its own tool call. None happens as a side effect of
another. The final itemized report is what makes a skipped step visible
in the same turn instead of days later.

1. **Scope check** — re-read the Jira scope; confirm what was done
   matches it, not more, not less. If scope grew after the ticket first
   reached Landed, re-verify what's *actually* merged (#57).
2. **Falsifier** — confirm against real system state, not memory.
3. **Evidence bar** — run the check (curl, test, build) fresh, now. Not
   "it passed earlier."
4. **Aegis fields** — write Claim/Falsifier/Evidence on the Jira child.
   Real custom fields (`customfield_10073`–`10079`, table in
   `gavi411-jira-aegis-template.md`), not description prose (#99).
5. **Jira: Reviewing → Landed.** Code is proven ready but not yet
   merged — this asserts that, nothing more.
6. **HANDOFF.md + `gavi411-brain.md`**, committed onto the same branch
   as the code, so one PR carries both and there's no second sync
   round-trip after merge. HANDOFF: current state. brain.md: only a
   decision that outlives this ticket — its own item, not folded into
   HANDOFF, since a status line and a standing decision are different
   things and the second is lost when HANDOFF is overwritten. If the
   decision corrects an instruction written elsewhere, edit that
   instruction in the same pass (§3). **Written before steps 7–8 run**,
   so it's necessarily written pre-merge — say that in its own text
   ("awaiting merge go-ahead," not a flat "Landed") rather than let a
   later session read the gap as HANDOFF being wrong. This is expected
   staleness, not drift, as long as it's exactly the steps-7–8 gap and
   nothing more.
7. **Ask: OK to merge, and OK to Reconcile once it lands?** One
   go-ahead covering both. Merge is the only genuinely hard-to-reverse
   step here; a passing Sibling review is a precondition for asking, not
   a substitute for it. On yes: merge, then Landed → Reconciled
   immediately — no separate re-check, steps 1–4 covered it. Merge
   mechanics in `gavi411-commit-convention.md`.
8. **Full sync check, every worktree.** `git status --short` in the
   primary + every `Gavi411-agent-<role>` must come back completely
   empty — not "just the ticket's files are clean." Resolve leftovers
   (commit if real, discard if not), then confirm each worktree's
   `git log --oneline -1` matches `origin/main`. If one can't
   fast-forward, `git diff origin/main HEAD --stat` before resetting
   blind.
9. **Report back** — one line per step, ✓ or ✗. Then say what's next
   and stop there (STOP 4), don't start it.

## Required workflow

1. **Read before acting — don't reason from memory.** `CLAUDE.md`,
   `HANDOFF.md`, `gavi411-brain.md` are edited by other sessions between
   your turns. Re-read rather than recall, especially `HANDOFF.md` and
   anything a system-reminder flags as changed on disk. This is the
   first thing in a session, not something to skip because the request
   sounded simple.

2. **Don't assert how a tool behaves, or what a doc/ticket/message
   said — check first.** "This runs unattended," "this chains
   automatically," "this enforces X," "that ticket is at Reviewing"
   (#104) all need verification before being said. If you haven't
   checked, say so and check.

3. **Log a decision to `gavi411-brain.md` when it's made, not at
   wrap-up.** The wrap-up step is a backstop; waiting is too late if
   wrap-up gets skipped or the ticket crosses a session boundary. A
   status update belongs in HANDOFF only; a decision belongs in brain.md
   too, live. Unsure which? brain.md — over-logging is mildly redundant,
   a missed decision is lost for good.

   **If the decision corrects a standing instruction, edit that
   instruction in the same pass** (#115). A correct decision in brain.md
   does nothing while the checklist sessions actually follow still says
   the opposite — that divergence survived from #109 until Gavi had to
   correct it "for the 10th time." Logging is not fixing.

4. **Before `git commit`, verify the file list matches the message**
   (#91 — a "log decision #88" doc commit actually landed an entire
   ~840-line unreviewed feature on `main`, via a broad `git add` in a
   dirty tree). Run `git status` / `git diff --cached --stat` and confirm
   the files are exactly what the message describes. Doubly for small,
   low-ceremony commits — those skip scrutiny precisely because they feel
   like they don't need it. Docs-only commits are **not** exempt from
   no-direct-commits-to-`main` (#105).

5. **Sibling review is mandatory on every agentic child, before merge is
   even asked about** (#62/#63) — verifies tests exist and pass, docs and
   `HANDOFF.md` are updated, Aegis fields written, Jira transitioned.
   Read the diff directly; a green build is not evidence the review
   happened. A passing review is a precondition for the merge ask
   (wrap-up step 7), never a substitute for it.

   **Post the review conversation as real PR comments, not just chat** —
   every review pass and every fix pass that follows gets its own comment
   (what was found, what was fixed, what was deferred and why, real test
   counts), so the PR reads as a record anyone can follow. Every cycle on
   every PR, not just the first. After `/code-review --comment`,
   spot-check one posted comment's real body via `gh api` — it has posted
   scratch-file paths instead of findings before, and its own summary
   doesn't catch it (#94).

6. **Model split: Sonnet defines, Haiku codes, Sonnet reviews** (#110) —
   the default for every coding task.
   - **Sonnet defines**: resolves the hard calls (schema, endpoint shape,
     auth boundaries, which existing pattern to follow) and settles
     ambiguity with Gavi at STOP 2 *before* dispatch. The handoff must be
     fully specified — exact files, routes, test cases — plus an explicit
     instruction to make the conservative choice and report, not ask,
     once dispatched.
   - **Haiku codes**: Agent tool, `model: "haiku"`, foregrounded
     (`run_in_background: false`) since review depends on its output.
     Implements and tests; makes no architectural calls.
   - **Sonnet reviews** (§5) — matters more for Haiku-authored code, most
     of all near an auth/security boundary.
   - **Opus escalation is confirm-first** — ask Gavi before invoking Opus
     for a specific pinpointed problem. Never an automatic fallback.
   - This changes who writes the first draft. Nothing else in this file
     changes.

7. **Multi-step work states a verification plan before executing it**
   (#117) — turn "fix the bug" into "write a test that reproduces it,
   then make it pass"; "add X" into a short numbered plan where each
   step names its own check. This is the same instinct as the Aegis
   Falsifier/Evidence bar, applied before code exists, not just at
   wrap-up — loose success criteria ("make it work") is what forces
   Gavi to keep re-clarifying mid-task.

8. **When a rule keeps getting broken despite being written down, the fix
   is a mechanism, not another paragraph** (#106 — Gavi: *"they are
   already both well documented, so what's the fix? more documentation
   isn't it."*). Ask whether the wrong action can be made mechanically
   impossible or immediately loud — a server-side rule, a git hook, a
   lint check. This is why `main`'s `require-pr-for-main` ruleset and
   `.githooks/pre-push` exist.

## How to work with Gavi

- **Session-start ritual** — run in order, before touching code,
  **including when the session opens with a short, concrete instruction
  like "pick up G411-XX."** That's the case where skipping is most
  tempting and most costly.
  0. **Read the docs, don't recall them**: `HANDOFF.md`, this file,
     `gavi411-brain.md`.
  1. **Recap**: `Setup-steps.md`, the Jira backlog, `git status`/`git log`
     — give Gavi a 3-5 line "where we left off, what's next."
  2. **Agent/subagent status**: anything running or recently finished in
     the `Gavi411-agent-*` worktrees or background subagents — in
     progress, done and needing review, stalled, or blocked on a
     decision.
  3. **Pick the task**: agree explicitly with Gavi which ticket, before
     any code. Work the lowest-numbered Open child of the Epic already in
     progress — Epics go in strict order, and "crucial" never jumps the
     queue. Re-check the ticket's Description against `gavi411-prd.md`
     and `gavi411-task-list-source.md` for staleness before starting.
     Then **STOP 1**.

- **Trace real consequences before presenting a plan, not after Gavi asks
  the obvious next question** (2026-09-02: proposed wiping admin's User
  row so admin could self-issue an invite — without checking that
  `POST /api/invites` requires `requireAdmin`, so the wipe would have
  locked admin out permanently; the constraint was one grep away). Every
  proposed action gets checked against what else reads/writes that data
  or gates on that state, and whether the sequencing strands a role,
  session, or token with no path back. If tracing needs a grep, do the
  grep before presenting, not after being asked. A plan without this pass
  is unfinished even when each step sounds reasonable alone.

- **Filing a new ticket**: set the real parent field at creation (not
  just the parent's name in description text), and confirm that Epic is
  **not already Reconciled** — "the related code lives there" isn't
  sufficient once an epic has closed (#108). If the ticket's nature
  implies ordering within its epic (a stress test needs a built system),
  state that at filing time (#116).

- Agents write by default — build it, and explain your reasoning as you
  go, proportional to how much the decision matters. If Gavi says he
  wants to write one himself: brainstorm, explain, review, unstick —
  don't hand him a finished implementation.
- Be opinionated, but show reasoning rather than asserting a choice.
- Async: Gavi does a step, comes back with a result, asks for the next.
  Don't assume a suggestion was tried unless he says so.
- **Context-window handoff**: no verified way to read own context usage —
  don't trust claims of a `CLAUDE_CONTEXT_TOKEN_COUNT`-style env var.
  Two signals: Claude self-judges from session shape and proactively
  offers a handoff, or Gavi reports a number from his UI and asks at
  ~60-70%. Either way: update `HANDOFF.md`, then suggest a fresh chat.

## Ownership split — historical record only

Since 2026-08-24 (#63) the project is **agentic-first**: agents write
tickets by default. The `[You]`/`[Collab]`/`[Agentic]` tags on older
tickets are historical record — they explain past commit-convention
choices but **do not gate who writes a ticket now.** Don't check a tag
before starting work.

The only exception is explicit and per-ticket: Gavi says "I want to write
this one myself." Call it out when it happens; never infer it. A return
to split ownership would be a new explicit decision in brain.md.

Two things carry forward from the old regime:
- **Comment-stub scaffolds** (#52) when Gavi does write one himself —
  the file stubbed as comments so he fills in real logic, produced
  per-task at pickup, not pre-generated in bulk.
- **Session boundary**, flipped (#63): agentic dispatch is the default,
  so *live manual pairing* is what moves to its own tab if both need to
  happen at once. Interleaved transcripts are unreadable either way.

## Tech stack

- Frontend: React (Vite), **JavaScript only — no TypeScript**
- Backend: Node.js + Express, ES modules
- DB: PostgreSQL via Neon (users↔requests↔messages↔credits)
- ORM: Prisma · Auth: Clerk (OAuth, invite-gated) · Testing: Vitest
- Deploy: Vercel (frontend) + Render free tier (backend, cold start OK)
- Images: Cloudinary free tier, URL stored in DB
- No WebSockets — fetch-on-load + POST-to-send, paired with
  notifications. Web Push is primary for **everyone**, friends and admin
  alike; Telegram is a secondary Gavi-only channel, deprioritized behind
  it (#45, #93).
- No LLM anywhere in intake/triage — deterministic DB-backed keyword
  matching, on Gavi's own server.

## Coding conventions

- **Ponytail** (YAGNI) is active — least code that works, stdlib/native
  before dependencies, no speculative abstractions. Don't fight it with
  over-engineered suggestions. No unrequested flexibility/config, no
  error handling for impossible scenarios, no abstraction for a single
  use site (#117) — if a diff could be 5x shorter, that's the sign to
  rewrite it, not to defend the longer version.
- **Surgical changes only** (#117): editing existing code touches only
  what the task requires. Don't reformat, re-comment, add types/docs, or
  "improve" adjacent code while fixing something else — match the
  existing style even when you'd choose differently. Clean up only the
  dead code your own change orphaned; a pre-existing orphan gets
  mentioned, not deleted, unless asked. Every changed line should trace
  to the request.
- UI chrome is English-only, LTR — no page mirroring, no logical-CSS
  sweep. But Hebrew appears in *any* freeform text field, friend- or
  admin-facing, whoever's typing: those need correct bidi rendering via
  `dir="auto"` or `unicode-bidi: plain-text` scoped to that content, not
  the page (#22).
- **"Ticket" never appears in user-facing copy.** Working term:
  "request" (placeholder). Internal code/variables use ticketing
  vocabulary freely.
- Tone: friendly, informal. All user-facing copy is placeholder until a
  dedicated copywriting milestone late in dev — don't polish strings
  early.

## Process & discipline

- **Jira** ("G411", Kanban, no sprints): Epic = Parent, Task = Child, no
  Subtasks. Five states (`Aegis-spec.md` §4.1): Open → Implementing →
  Reviewing → Landed → Reconciled. **Landed** = merged and live, but
  acceptance criteria not yet re-validated. **Reconciled** = criteria
  checked against the landed state — the real "Done." Named transitions:
  Start Implementing · Move to Review · Reviewing → Landed · Landed →
  Reconciled. Every status also has a global "Any →" for
  corrections/reopens.
- **Aegis Method**: every Child needs a Falsifier and Evidence bar before
  Reconciled. Fields in `gavi411-jira-aegis-template.md`; consult
  `Aegis-spec.md` for anything the template doesn't cover. Written at
  pickup against real state, never pre-drafted in bulk (#50).
- **Repowise**: tracks agent provenance from git history — needs the
  per-role identity/branch/trailer scheme in
  `gavi411-commit-convention.md` respected by every subagent.
- **Branching**: no direct commits to `main`. One branch per child —
  `you/G411-XX-slug` or `agent-<role>/G411-XX-slug` — merged via PR.
  Mechanically enforced (#106): a `require-pr-for-main` ruleset with no
  bypass actor rejects direct pushes server-side, and a committed
  `.githooks/pre-push` (per-worktree `git config core.hooksPath
  .githooks`) catches it locally first, plus the sibling mistake of
  pushing under one role's identity onto another's branch prefix.
- **Merge mechanics** (policy is §5; full details in
  `gavi411-commit-convention.md`): always a regular merge commit, never
  `--squash` (#68). A bare `gh pr merge` fails — branch protection
  requires an approving review, so use `gh pr merge --merge --admin`
  (#103). From an agent-worktree dispatch `gh pr merge` fails outright
  because the primary worktree holds `main`; use
  `gh api repos/<owner>/<repo>/pulls/<n>/merge -X PUT -f merge_method=merge`
  (#107). Always `gh`, never the `github` MCP connector — full stop, not
  just when it's down (#90).
- **Impeccable**: don't run `/impeccable document` before real styled
  components exist. Sequence is inspo screenshots → build components
  against them → *then* document into `DESIGN.md`. `PRODUCT.md` comes
  from `/impeccable init`, not pre-drafted.

## Reference docs

| File | What it's for |
|---|---|
| `gavi411-prd.md` | Full product spec — flows, features, priorities |
| `gavi411-brain.md` | Numbered decision log — the "why" behind every `#N` cited here |
| `HANDOFF.md` | Perishable session-to-session state — the **only** authority on current status and next task |
| `Aegis-spec.md` | Primary source for the Aegis Method; `gavi411-jira-aegis-template.md` derives from it |
| `gavi411-jira-aegis-template.md` | Parent/Child issue field template + custom-field IDs |
| `gavi411-commit-convention.md` | Per-role git identity/branch/trailer scheme, merge and worktree mechanics |
| `gavi411-jira-tree.md` | Snapshot of the G411 Epic → Task structure with issue keys |
| `gavi411-task-list-source.md` | Original hour-costed backlog used to populate Jira; Jira is live now |
| `gavi411-e2e-encryption-plan.md` | Living doc for the paused E2E work — read before touching messaging/encryption |
| `gavi411-post-deadline-learning-backlog.md` | Post-deadline study list — doesn't affect how you build now |

## Standing facts

- Folders are **`server/`** and **`client/`**, not `backend`/`frontend`.
- Epics are worked in strict order. Foundation (G411-1) and
  Requests/Intake (G411-2) are long since Reconciled.
- E2E messaging encryption is **paused**, explicitly optional/stretch
  (#98) — message content is plaintext-in-DB meanwhile. Read
  `gavi411-e2e-encryption-plan.md` before touching that area.
- **Current status and next task live in `HANDOFF.md`** — deliberately
  not duplicated here, so two sources can't disagree.
- Once `server/` and `client/` are both fleshed out, consider splitting
  this into a leaner root file plus `server/CLAUDE.md` and
  `client/CLAUDE.md`. Not yet.

## Gavi411 — what it is

Digitizes the informal concierge service Gavi already runs for friends
and family (travel rescue, product research, middleman purchases, tech
support, info requests), currently scattered across
WhatsApp/Telegram/calls/email. Also his fullstack course final project.

**The constraint that shapes everything:** ~1 month, ~15 real sessions,
solo. Gavi personally writes at least a section of every component type
and must be able to explain everything submitted — a learning project,
not just a deliverable.

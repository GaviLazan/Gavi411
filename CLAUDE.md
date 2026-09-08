# CLAUDE.md — Gavi411 Project Instructions

This file is auto-loaded at the start of every Claude Code session in this
repo. Read it before touching any code. It's a working index, not a full
copy of project context — the source docs it points to are the actual
authority.

**If you read only one section, read "The four stops" below.** Work here
is not one unbroken chain from instruction to merged-and-Reconciled;
there are four points where it stops and Gavi sees something first. Then
the session-start ritual (under "How to work with Gavi") — it runs even
when the session opens with a short, concrete instruction.

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
| `gavi411-e2e-encryption-plan.md` | Living doc — current status/target architecture/open questions for the E2E messaging encryption reframe (decision #98, 2026-09-02). Read before touching anything messaging/encryption-related; update it as the plan evolves rather than re-deriving from Jira/brain.md each time |

## Ownership split — historical record only (changed 2026-08-24)

As of 2026-08-24 (decision #63, `gavi411-brain.md`), the project moved
to **agentic-first**: agents write tickets by default, full stop. The
`[You]` / `[Collab]` / `[Agentic]` tags that used to appear on tasks are
**historical record only** — they describe how past tickets were
actually built, and explain past commit-convention choices (per-role git
identities, worktrees, the old session-boundary rule), but **do not gate
who writes a ticket going forward.** Do not check a tag before starting
work. They're not fake history — they're just not the regime we're in
anymore. If you need the old tag definitions, they're preserved in git
history for this file (this section, pre-2026-08-24) and in
`gavi411-brain.md`'s decisions #31–#63.

Finding a stale tag on a ticket, or a HANDOFF.md/ticket mismatch, is
worth **one line of mention while work continues agentically in the same
turn** — never a stop-and-ask, via `AskUserQuestion` or otherwise. That
would reopen a decision already made project-wide. This exact mistake has
now happened twice (G411-67 → decision #66; G411-69 → decision #113); a
third time is a signal something structural is wrong, not just another
correction to log.

The only exception is per-ticket and explicit: if Gavi says "I want to
write this one myself" (e.g. to hit the course's per-component learning
requirement), that ticket stays manual for that session — call it out
when it happens, don't infer it from anything else. If the project ever
moves back to a split-ownership regime, this default reverts and tags
become load-bearing again — that would be a new, explicit decision in
`gavi411-brain.md`, not something to infer.

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

## The four stops — a ticket is not one unbroken chain

**A single instruction like "pick up G411-XX" authorizes exactly one
thing: starting that ticket.** It is not advance approval for the whole
arc through to Reconciled. There are four points where work stops and
Gavi sees something before the next step runs. Read these first, before
anything else in this file — everything below assumes they hold.

**STOP 1 — At pickup, before any code exists.** State the ticket's
actual scope in plain terms (so Gavi has it in front of him instead of
scrolling back). Make the Jira **Open → Implementing** transition and
write Claim/Falsifier/Evidence-required *now* — investigate → transition
→ Aegis fields → *then* write or dispatch code, never the reverse
(decision #114: "Implementing" asserts a fact about the present moment;
backfilling it after the code exists makes the field lie). Not optional
busywork deferred until someone asks where the ticket stands
(decision #104).

**STOP 2 — Mid-flight, on any real ambiguity.** If a decision comes up
that isn't yours to make (scope, ownership, architecture, a judgment
call the ticket itself doesn't answer) — stop and bring it to Gavi
*before* acting on it. Don't resolve it and mention it after the fact.

*How to stop, concretely (2026-08-24, real failure):* a question buried
mid-paragraph while work keeps moving is not a stop — by the time Gavi
reads and answers it, tool calls have already run past it, so his answer
lands as an after-the-fact confirmation of something already done
instead of a real go/no-go. Caught live on G411-67: the build agent hit
"what counts as 'closed'?" (a genuine spec ambiguity), picked the
broader reading itself, and only documented the choice in the PR/Jira
for later review — Gavi answered it correctly once he spotted it, but
the code was already written by then. The fix: use `AskUserQuestion` — a
real blocking pause, no further tool calls on that thread of work — not
a note-and-continue, and not "pick the defensible option and flag it in
the final report." This applies even to unattended background agents: if
the dispatched agent itself can't call `AskUserQuestion`, it must stop
and hand the question back to the orchestrating session to ask, not
resolve it unilaterally and move on.

*The mirror-image failure, equally real* (decision #109): once Gavi has
answered a question, that answer is final for that batch. Re-asking it
in different words manufactures false ambiguity out of a plain
instruction. This stop exists for genuinely unresolved questions, not
for re-confirming answers already given. Likewise, a stale
`[You]`/`[Agentic]` tag on a ticket is **not** an ambiguity — it gets
one line of mention while work continues agentically in the same turn,
never a question (decisions #66, #113 — this exact mistake has already
happened twice).

**STOP 3 — End-of-ticket rundown, before/alongside the Sibling review.**
Give Gavi an actual explanation of what was built and how it works — not
just a diff, not just "done." He needs to be able to explain everything
submitted (course requirement).

**STOP 4 — Go/no-go before the next ticket.** A clean Sibling review
does not imply "proceed to the next ticket automatically." Report the
outcome and let Gavi decide whether to continue, even if nothing looks
wrong. **Never auto-advance through a queue of tickets.**

When in doubt about scope, ownership, or whether something needs Gavi's
sign-off — ask. A wrong guess that quietly ships is worse than a
question that costs one turn.

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
changed on disk since you last read it. **This is the first thing that
happens in a session, not something to skip because the request sounded
simple** — see the session-start ritual under "How to work with Gavi."

**2. Don't assert how a tool behaves, or what a doc/ticket/earlier
message said — check first.** Claims like "this will run unattended,"
"this chains into the next step automatically," or "this enforces X"
must be verified against the tool's real description (`ToolSearch`, its
documented behavior) before being said out loud. This project has
already hit real instances: an agentic "pilot" was described as
self-orchestrating when the actual tools only provide background
dispatch + notification; a ticket was reported as "Reviewing" from
memory when it was actually still Open (decision #104); a past message
was claimed to have surfaced an open item when re-reading showed it
hadn't. If you haven't checked, say so and check, rather than presenting
a guess as settled fact.

**3. Log a real decision to `gavi411-brain.md` when it's made, not just
at ticket wrap-up.** (Added 2026-08-31, real gap found live — several
sessions' worth of genuine standing decisions from a single ticket
[G411-81, 2026-08-30] sat only in `HANDOFF.md` for over a day and were
never promoted; they'd have been lost for good the next time
`HANDOFF.md` got overwritten, since nothing forced the check until that
ticket's own wrap-up, which itself never happened as a distinct step.)
The "wrap it up" checklist's brain.md step is the backstop, not the
primary mechanism — waiting until wrap-up is too late if wrap-up gets
skipped, delayed, or the ticket sprawls across a session boundary first.
The moment a real standing decision actually gets made mid-session — an
architectural call, a corrected assumption, a mechanism worth
remembering next time something similar comes up, anything that should
outlive this ticket and this HANDOFF.md cycle — add the numbered entry
to `gavi411-brain.md` right then, the same turn, not deferred to
"later" or "at wrap-up." A one-line status update still belongs in
`HANDOFF.md` only; a decision belongs in `gavi411-brain.md` too, live.
When genuinely unsure which a given item is, log it in `gavi411-
brain.md` — an over-logged status note there is mildly redundant, a
missed decision is easy to lose for good.

**If the decision *corrects* a standing instruction written somewhere
else, edit that instruction too, in the same pass** (decision #115) — a
correct decision sitting in `gavi411-brain.md` does nothing if the
checklist in `CLAUDE.md` that sessions actually follow still says the
opposite. That exact divergence survived from decision #109 (2026-09-03)
until Gavi had to correct the same mistake "for the 10th time." Logging
it is not equivalent to fixing it.

**4. Before running `git commit`, verify the file list matches the
message — never trust stated intent as evidence of the actual diff.**
(Decision #91, real incident 2026-09-01: commit `302f463`, titled as a
small "log decision #88" doc-only commit, actually also committed an
entire ~840-line feature — the pre-review, pre-Sibling-review version of
device-linking — straight onto `main`, bypassing the no-direct-commits
rule and both real review rounds. Root cause: a broad `git add`
[`-A`/`.`/`-a`] in a working tree that had unrelated feature files sitting
modified/untracked, for what was meant to be a two-file commit — the
message was written to match intent, never checked against what was
actually staged.) Before every commit, run `git status` and/or
`git diff --cached --stat` and confirm the file list is exactly what the
message describes — no more, no fewer. This applies doubly to small,
low-ceremony commits (a decision-log entry, a doc fix, a one-line nit) —
those are precisely the ones most likely to skip a deliberate review
step because they don't feel like they need one. **Docs-only commits are
not an exception to the no-direct-commits-to-`main` rule either**
(decision #105) — HANDOFF.md/brain.md updates go through a `you/`-prefixed
branch and PR like everything else.

**5. Sibling review is mandatory on every agentic child, self-merge only
after it passes** (decision #62/#63) — checks tests exist and pass, docs/
`HANDOFF.md` are actually updated, Aegis fields are actually written,
Jira is actually transitioned. No outside human approval is required or
expected (decision #63) — but skipping the review itself, or treating a
green build as sufficient evidence the review happened, is not allowed.
Read the diff directly; don't just trust the review skill's output.
Merging is the genuinely hard-to-reverse step in the whole workflow —
see the "Wrap it up" checklist for how that ranks against the cheap,
reversible steps around it.

**Post the review conversation as real PR comments, not just chat**
(added 2026-08-31) — every Sibling review pass gets posted as a PR
comment (findings, real or via `/code-review ... --comment`) as soon as
it finishes, and every fix pass that follows gets its own PR comment
right after (what got fixed, what got deferred and why, real test
counts). The PR should read as an actual back-and-forth conversation
between the review and the fix — a full record anyone can read later —
not something that only exists in a chat transcript. Applies to every
review/fix cycle on every PR, not just the first one; a PR with 3 rounds
of review gets 3 rounds of comments. After any `/code-review ... --comment`
run, spot-check at least one posted comment's real body via `gh api` —
the tool has posted local scratch-file paths instead of finding text
before, and its own "N comments posted" summary doesn't catch it
(decision #94).

**6. Model split for coding work — Sonnet defines, Haiku codes, Sonnet
reviews** (decision #110, 2026-09-08, confirmed default after a live
trial on G411-43): this is the default execution model for every coding
task now, not just large or mechanical ones.
- **Sonnet writes the definition first** — actually resolves the hard
  calls (schema/data-model shape, endpoint/API shape, auth/security
  boundaries, which existing pattern in the codebase to follow) and
  settles any genuinely ambiguous scope question with Gavi at STOP 2
  before dispatch. The task handed off must be fully specified: exact
  files, exact route/behavior, exact test cases, and an explicit
  instruction to make the most conservative choice and report rather
  than ask if something remains ambiguous once dispatched.
- **Haiku does the coding** — dispatched via the Agent tool with
  `model: "haiku"`, foregrounded (`run_in_background: false`) since the
  next step (review) depends on its output. It implements, writes
  tests, and runs its own build/test pass, but makes no architectural
  calls of its own.
- **Sonnet does the Sibling review** — unchanged and non-negotiable
  (see item 5 above); if anything it matters more for Haiku-authored
  code, especially anywhere near an auth/security boundary.
- **Opus escalation is confirm-first, not automatic** — if Sonnet hits a
  specific, pinpointed problem genuinely too hard to resolve alone (a
  subtle bug, an unresolved design tradeoff), ask Gavi before invoking
  Opus for that sub-problem. Never a default fallback.
- This changes who writes the first draft of the code, nothing else —
  every other rule in this file (the four stops, mandatory Sibling
  review, Aegis fields, Jira transitions, the wrap-up checklist) still
  applies exactly as written.

**7. When a rule keeps getting broken despite already being written
down, the fix is a mechanism, not another paragraph** (decision #106,
Gavi's framing: *"they are already both well documented, so what's the
fix? more documentation isn't it."*). Ask whether the wrong action can
be made mechanically impossible or immediately loud — a server-side
rule, a git hook, a lint check — rather than relying on a re-read
landing at the right second. This is why `main`'s `require-pr-for-main`
ruleset and `.githooks/pre-push` exist (see Process & discipline →
Branching).

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
  with notifications. Web Push is the primary channel for everyone,
  friends and admin (Gavi) alike; Telegram is a secondary channel for
  Gavi specifically, deprioritized behind Web Push (decision #45, PRD
  §6.1 — "Should," acceptable to wait if Web Push alone covers it).
  Corrected 2026-09-01 (decision #93) — previously read "Web Push for
  friends, Telegram for Gavi," which read as an exclusive split; it was
  never meant to forbid admin from also getting Web Push.
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
  **Mechanically enforced, not just documented** (decision #106,
  2026-09-02, after this rule was violated live on G411-38's own wrap-up
  commit): a GitHub ruleset on `main` (`require-pr-for-main`, no bypass
  actor — real for everyone, self included) rejects any direct push,
  server-side, regardless of local git config. A repo-committed
  `.githooks/pre-push` (installed per-worktree via
  `git config core.hooksPath .githooks` — one-time, since `.git/hooks/`
  itself isn't versioned) is a faster local-first tripwire catching the
  same thing plus the sibling mistake (pushing under one agent role's
  identity onto another role's branch prefix) — soft, bypassable with
  `--no-verify`, but installed in all 7 worktrees. Full rationale and
  both mistakes that motivated this in `gavi411-brain.md` decision #106.
- **PR review**: see Required workflow §5 — that's the single statement
  of the policy. Mechanics (merge strategy, `--admin`, branch cleanup,
  worktree resync) live in `gavi411-commit-convention.md`. Two mechanical
  facts worth knowing before you try to merge: every PR merges with a
  regular merge commit, never `--squash` (decision #68), and a bare
  `gh pr merge` fails here — `main`'s pre-existing branch protection
  requires an approving review, so agentic self-merges need
  `gh pr merge --merge --admin` (decision #103). From an agent-worktree
  dispatch, `gh pr merge` also fails outright because the primary
  worktree holds `main` checked out; use the REST form instead —
  `gh api repos/<owner>/<repo>/pulls/<n>/merge -X PUT -f merge_method=merge`
  (decision #107). Always use `gh`, never the `github` MCP connector —
  full stop, not just when it's down (decision #90).
- **Impeccable** (design skill): do **not** run `/impeccable document`
  before real styled components exist. Correct sequence is: show reference
  screenshots from the inspo board (the image files themselves, not the
  board's own gallery-shell code) → build early components against them →
  *then* `/impeccable document` to capture what landed into `DESIGN.md`.
  `PRODUCT.md` is generated interactively via `/impeccable init` once the
  repo exists — don't pre-draft it.

## How to work with Gavi

- **Trace real consequences BEFORE presenting a plan, not after Gavi
  asks the natural next question.** (Added 2026-09-02, real failure —
  proposed "wipe admin's User row, then have admin self-issue an
  invite" as a clean fix for the admin-escrow gap, without checking
  that `POST /api/invites` requires `requireAdmin` — meaning the wipe,
  done first, would have permanently locked admin out of ever issuing
  themself an invite at all. The ordering constraint was one grep away
  and should have been surfaced in the same breath as the proposal, not
  discovered reactively after Gavi asked "how do we self-issue an
  invite?" Same root failure as an earlier session's "test by switching
  users" suggestion that ignored there's no logout button.) Nothing in
  this system is a silo — every proposed action (delete this, disable
  that, reorder these two steps) has to be checked against: what else
  reads/writes this same data or gates on this same state, and does
  sequencing it this way strand something (a role, a session, a token)
  with no path back. This is a mandatory step in forming the plan
  itself, not a follow-up once a gap surfaces — if tracing it requires a
  grep/read, do that grep/read before presenting the plan, not after
  being asked. A plan presented as "here's what we'll do" that hasn't
  had this pass done is unfinished, even if each individual step sounds
  reasonable in isolation.
- **Session-start ritual** (decided together, Setup-steps step 10). Run
  these in order at the start of each work session, **before touching any
  code — including when the session opens with a short, concrete-sounding
  instruction like "pick up G411-XX."** A simple request is not a reason
  to skip the ritual; it's the case where skipping is most tempting and
  most costly, because a session that skipped the recap has no idea what
  the last one left half-finished.
  0. **Read the docs, don't recall them**: `HANDOFF.md`, this file, and
     `gavi411-brain.md` (Required workflow §1). Other sessions edit all
     three between your turns.
  1. **Recap**: check `Setup-steps.md`, the Jira backlog, and `git status`/
     `git log` across the main worktree; give Gavi a short (3-5 line)
     "here's where we left off, here's what's next" summary.
  2. **Agent/subagent status**: report anything currently running or
     recently finished in the other worktrees (`Gavi411-agent-*`) or any
     background subagents — what's in progress, what's done and needs
     review/merge, what's stalled or needs a decision.
  3. **Pick the task**: agree explicitly with Gavi which Jira task he's
     picking up this session before any code gets touched. Work the
     lowest-numbered Open child of the Epic already in progress — Epics
     go in strict order, and a ticket being "crucial" never jumps it
     ahead of the queue. Re-check the task's Description field against
     `gavi411-prd.md` and `gavi411-task-list-source.md` for staleness
     (2026-08-19: descriptions were batch-populated from these sources —
     if the PRD or source doc changed since, the ticket's description may
     be out of date; fix it before starting work, don't silently work
     against a stale one). Then proceed to **STOP 1** — state the scope,
     transition Open → Implementing, write the Aegis fields, and only
     then write code.
- **Filing a new ticket**: set the real parent field at creation (not just
  the parent's name in the description text), and check the candidate
  parent Epic is **not already Reconciled** — "this is where the related
  code lives" isn't sufficient if that epic has closed (decision #108).
  Pick whichever currently-open epic is the next-best fit. If the ticket's
  own nature implies an ordering constraint within its epic (a stress test
  needs a built system to stress-test), state that explicitly at filing
  time rather than leaving it implicit (decision #116).
- Agents write by default (see "Ownership split" above) — build it, and
  explain your reasoning as you go, at a strength proportional to how much
  the decision matters. If Gavi explicitly says he wants to write a
  specific ticket himself: brainstorm, explain, review, unstick — don't
  hand him a finished implementation for that one. He wants to submit work
  he actually did.
- Be opinionated but show your reasoning — don't just assert a choice.
- Async workflow: Gavi does a step, comes back with a result (success or
  a specific failure), then asks for the next step. Don't assume a
  previous suggestion was tried unless he says so.
- **"Wrap it up"** — codeword. Run every step below, every time, in the
  order given — this is now real execution order (merge *before* the
  status that claims the code is merged), not the order they were
  historically written in. This replaces the old prose version of this
  instruction — that version is why G411-11's Jira ticket sat at Open
  for multiple sessions after "wrap it up" was said twice: the habitual
  steps (commit, HANDOFF.md) ran, the one requiring a separate tool call
  (Jira transition) silently didn't, and nothing surfaced the gap. The
  fix is the final step — a mandatory itemized report, not a summary —
  so a skipped step is visible in the same turn instead of discovered
  days later.

  Each step needs its own tool call. None of them happens as a side
  effect of any other.

  1. **Scope check** — re-read the task's actual Jira scope, confirm what
     was done matches it (not more, not less). If the scope grew after
     the ticket first reached Landed, re-verify what's *actually* merged
     before trusting any later status (decision #57).
  2. **Falsifier** — confirm or re-confirm it against real system state,
     not memory of what should be true.
  3. **Evidence bar** — actually run the check (curl, test, build) fresh,
     right now — not "it passed earlier."
  4. **Aegis fields** — write/update Claim, Falsifier, Evidence on the
     Jira child. These are real Jira **custom fields**
     (`customfield_10073`–`10079`), not description prose or a comment —
     the field-ID table lives in `gavi411-jira-aegis-template.md`
     (decision #99).
  5. **Merge** — the one genuinely hard-to-reverse action in this list.
     Self-merge if routine, once the Sibling review has passed (see
     Required workflow §5); flag for a live review first if load-bearing.
     See `gavi411-commit-convention.md` for identity/branch/worktree
     mechanics.
  6. **Jira transition** — now that code is actually merged/live, move
     the status field explicitly using the named transitions: "Reviewing
     → Landed", then "Landed → Reconciled" once acceptance criteria are
     re-checked against that landed state (spec §5.5). Two separate
     transitions, not one — don't collapse them.
     **Landed → Reconciled is NOT hard-to-reverse and does NOT need a
     confirm-first pause** (decision #115 — this line previously said the
     opposite and Gavi had to correct it live repeatedly, "for the 10th
     time" on the most recent; a Jira status field is cheap and trivially
     reversible). Do it directly, same as every other step here. But a
     wrap-up report must never show a ticket sitting at Landed with a
     transition checkmark and no mention of the open Reconcile question —
     Landed is not a done state (decision #104).
  7. **HANDOFF.md** — update with current state.
  8. **`gavi411-brain.md`** — its own step, not a sub-clause of
     HANDOFF.md (added 2026-08-31, real gap found live: several sessions'
     worth of genuine standing decisions accumulated only in HANDOFF.md
     and were never promoted, going stale/lost once HANDOFF.md's own
     perishable content got overwritten). If this ticket produced a
     decision that should outlive it — a real architectural/process call,
     a corrected assumption, a mechanism worth remembering next time —
     add it to the numbered log now, not "later." A one-line status
     update belongs in HANDOFF.md only; a decision belongs here too. When
     genuinely unsure which a given item is, err toward brain.md — an
     over-logged status note there is mildly redundant, a missed decision
     is easy to lose for good. And if the decision corrects a standing
     instruction elsewhere, edit that instruction in the same pass
     (Required workflow §3).
  9. **Full sync check, every worktree** (added 2026-08-25, real gap
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
  10. **Report back** — one line per step above, ✓ or ✗, so a skipped
     step is visible immediately. Example: "Scope ✓ · Falsifier ✓ ·
     Evidence ✓ · Aegis fields ✓ · Merged ✓ · Jira → Reconciled ✓ ·
     HANDOFF.md ✓ · brain.md ✓ (or N/A if nothing decision-worthy) ·
     Worktrees synced ✓." Then say what's next on the spine — and stop
     there (STOP 4), don't start it.
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

**Real-time status and the next task live in `HANDOFF.md` — read that,
not a summary here.** This section previously carried a hand-maintained
narrative of which Epics/children were Reconciled; it went stale
repeatedly (it still described work as "active as of 2026-08-30" long
after encryption was paused per decision #98 and later epics were
underway), which is exactly the failure Required workflow §1 exists to
prevent. Removed deliberately rather than re-written, so there is one
authority for current state instead of two that can disagree.

Standing structural facts that don't go stale:
- Folder naming is **`server/`** and **`client/`**, not
  `backend`/`frontend`.
- Epics are worked in strict order; Foundation (G411-1) and
  Requests/Intake (G411-2) are long since Reconciled.
- E2E messaging encryption is **paused** and explicitly optional/stretch
  (decision #98) — the rest of the product finishes first. Message
  content is plaintext-in-DB in the meantime. Read
  `gavi411-e2e-encryption-plan.md` before touching anything in that area.

## Future doc structure (not yet)

Once `server/` and `client/` are both fleshed out, it's worth splitting this
into a leaner root `CLAUDE.md` plus a `server/CLAUDE.md` and
`client/CLAUDE.md` for directory-specific context. Not needed yet —
revisit once Foundation lands.

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

2026-08-18, mid-session (Claude platform-wide outage, write-path safety
classifier down — see status.claude.ai).

## Where things stand

- **G411-10 (DB schema)**: Landed on `main` (commit `90cad6c`). Not yet
  Reconciled — needs a real `prisma migrate dev` against Neon, which
  naturally happens once G411-11's server needs a live DB connection.
- **G411-11 (Express skeleton)**: code is done and verified — `server.js`
  boots, mounts `requests` router, cors + JSON middleware, health check.
  Falsifier confirmed live: `curl localhost:3000/api/health` → `200
  {"status":"ok"}`. **Still uncommitted** on branch
  `you/G411-11-express-skeleton` — commit was attempted repeatedly but
  blocked by the platform outage (safety classifier overloaded on every
  write-type tool call: git commit, ScheduleWakeup, WebFetch all failed
  identically). Not a code problem — just needs the commit to actually go
  through once the outage clears.
- Branch/PR policy (routine self-merge vs. load-bearing Sibling review) is
  live in `gavi411-commit-convention.md` and `CLAUDE.md` as of this session.

## Open threads

- **Codeword "wrap it up"**: not yet written into `CLAUDE.md` — outage hit
  before that doc edit landed. Meaning: when Gavi says it, check his work
  against the current task's scope, confirm the falsifier, write/update
  Aegis fields, commit (self-merge if routine / flag load-bearing for
  review first), then say what's next — without him re-explaining each
  time.
- **Context-window alert feature**: requested but not built. Constraint:
  no tool currently gives Claude Code introspective access to its own
  context-usage %, so a self-monitoring "alert at 60%, force switch before
  70%" can't be built as literally described. A Reddit thread
  (r/ClaudeAI, "is there a way for claude code the model to see...") was
  suggested as a possible mechanism — not yet confirmed, fetch attempt hit
  the same outage. Revisit once reachable. This HANDOFF.md file is the
  first half of the fix regardless of the detection mechanism (the
  brain-dump target); still need to decide how the "getting close" signal
  actually fires.

## Immediate next step, once things are working again

1. Retry the G411-11 commit (message already drafted, was mid-attempt).
2. Add the "wrap it up" codeword definition to `CLAUDE.md`.
3. Revisit the context-window alert mechanism (check the Reddit thread).

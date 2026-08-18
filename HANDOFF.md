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

2026-08-18, end of session — clean stopping point, Gavi starting a fresh
chat by choice (not forced by context limit or an outage).

## Where things stand

- **G411-10 (DB schema)**: Landed on `main`. **Not yet Reconciled** — needs
  a real `prisma migrate dev` against Neon. This will naturally happen
  early in G411-12/whenever the server first needs a live DB connection.
  Don't forget to close this out once that migration runs.
- **G411-11 (Express skeleton)**: **Landed on `main`**, self-merged
  (routine, evidence bar met — confirmed live via `curl localhost:3000/
  api/health` → `200 {"status":"ok"}`). Branch `you/G411-11-express-
  skeleton` merged and deleted. `server/server.js`, `server/routes/
  requests.js` have working skeletons; `server/lib/prisma.js` and
  `server/middleware/auth.js` are still comment-stubs (prisma.js is
  needed once DB calls start; auth.js is `[Agentic]`/Clerk, G411-13, not
  yet started).
- **Branch/PR/review policy**: live as of this session in
  `gavi411-commit-convention.md` and `CLAUDE.md`. One branch per child
  (`you/G411-XX-slug`), no direct commits to `main` for actual Jira
  children (process/doc housekeeping without a Jira-Issue is the
  exception — committed straight to `main`). Routine children self-merge
  once their Evidence bar is met; load-bearing children (credits, auth,
  encryption, lifecycle state machine) get a live Sibling review from
  Claude Code first.
- **"Wrap it up" codeword** is live, defined in `CLAUDE.md` under "How to
  work with Gavi." Use it to trigger: check scope, confirm falsifier,
  write/update Aegis fields, commit (self-merge or flag for review per
  the policy above), report what's next.
- **Context-window signal policy** is live in `CLAUDE.md`: no verified way
  for Claude Code to read its own token usage (a Reddit-sourced claim
  about `CLAUDE_CONTEXT_TOKEN_COUNT` env vars was checked and rejected as
  unconfirmed/likely fabricated). Two parallel signals instead: Claude
  self-judges from session shape and proactively flags when things feel
  long; Gavi can also report a real number if his UI shows one. Either
  triggers a `HANDOFF.md` update + suggestion to start fresh — which is
  what's happening right now.
- **`gavi411-task-list-draft.md` renamed** to `gavi411-task-list-source.md`
  — it's the doc Jira was populated from, not an active draft. References
  updated in `CLAUDE.md`, `gavi411-jira-tree.md`, this file.
- Folder naming is **`server/`** and **`client/`** (not `backend`/
  `frontend`) — `client/` doesn't exist yet.

## Open threads / nothing currently blocking

None — this handoff is a clean checkpoint, not a recovery from an outage
or an interrupted task. Everything above is committed and landed.

## Next on the spine

**G411-12 — React frontend setup (Vite, JS-only)** — `[You]`, not started.
Per the "starting any Jira task" rule in `CLAUDE.md`, state its Jira scope
plainly before diving in, and run the session-start ritual (recap → agent/
subagent worktree status → agree on the task) before touching code, same
as this session opened.

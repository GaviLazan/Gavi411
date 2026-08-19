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

2026-08-19, end of session — clean stopping point, Gavi ending by choice
(not forced by context limit or an outage).

## Where things stand

- **G411-11 and G411-12 ownership retagged**: both moved from `[You]` to
  `[Collab]` this session. Definition for these two specifically (added to
  `CLAUDE.md`'s ownership-split section): Gavi sets up the base scaffold,
  then the real logic gets built together step by step, same collaborative
  model as Testing/CI-CD. This does **not** undo G411-11's existing
  comment-stub scaffolding (`server/server.js`, `server/routes/
  requests.js` landed; `server/lib/prisma.js` and `server/middleware/
  auth.js` still stubs) — it changes how the remaining work on 11 and all
  of 12 gets finished, not what's already down.
  - Updated in three places: `CLAUDE.md`, `gavi411-jira-tree.md`,
    `gavi411-task-list-source.md`, plus the live Jira issues (Owner/
    Authorship custom field, `customfield_10077`, option id `10028` =
    "Collaborative") for both G411-11 and G411-12.
  - Committed straight to `main` (doc/process housekeeping, no Jira child
    of its own) — commit `15ed522`.
  - Scanned the rest of the backlog (Parents 2–9) for other automatable
    non-logic tasks per Gavi's request. Only real candidate found was
    "Trigger taxonomy seed data" (Parent 2) — Gavi chose to keep it
    `[You]` since the seed content shapes intake behavior. Nothing else
    in the list is boilerplate; the rest is genuinely request/messaging/
    lifecycle/admin/credits logic and stays as originally tagged.
- **G411-10 (DB schema)**: Landed on `main`. **Still not Reconciled** —
  still needs a real `prisma migrate dev` against Neon. Will naturally
  happen once G411-11/12 work needs a live DB connection. Don't forget to
  close this out when that migration runs.
- **G411-11 (Express skeleton)**: Landed on `main` (self-merged, evidence
  bar met — `curl localhost:3000/api/health` → `200 {"status":"ok"}`).
  Ownership now `[Collab]` (see above) for whatever's left on it — check
  with Gavi whether he considers 11 itself done or whether the Collab
  retag reopens any of its remaining scope.
- **Branch/PR/review policy, "wrap it up" codeword, context-signal
  policy**: all still live as documented in `CLAUDE.md` — unchanged this
  session.
- Folder naming is **`server/`** and **`client/`** — `client/` doesn't
  exist yet.

## Open threads / nothing currently blocking

None — clean checkpoint, not a recovery from an outage or interrupted task.
Everything above is committed.

## Next on the spine

**G411-12 — React frontend setup (Vite, JS-only)** — now `[Collab]`, not
started. Per the "starting any Jira task" rule in `CLAUDE.md`, state its
Jira scope plainly before diving in, and run the session-start ritual
(recap → agent/subagent worktree status → agree on the task) before
touching code. Since it's now Collab, agree explicitly with Gavi on the
scaffold/logic split before writing anything — who does the initial Vite
setup vs. where the step-by-step collaboration starts.

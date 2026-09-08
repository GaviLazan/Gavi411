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

## Where this session left off (2026-09-08) — G411-42 and G411-43 both Reconciled, live-verified.

### What shipped
- **G411-42** — Trigger/keyword admin UI (`/api/triggers` CRUD, `TriggerAdmin.jsx`). PR #65.
- **G411-43** — Manual online/offline presence toggle (PRD §4.5). New singleton `Presence` model, public `GET /api/presence`, `requireAdmin`-gated `PATCH /api/presence`, admin-only "Go offline"/"Go online" button in the top nav, friend-facing offline banner. PR #67.
- Both Reconciled against real live walkthroughs (dev servers started, DB/API checked directly, not just automated tests) — not just build/test evidence.

### New process this session: Haiku-drafts / Sonnet-reviews split, tried once
For G411-43, all architectural decisions (schema shape — single singleton row, `id: "singleton"`; endpoint shape — separate public `GET /api/presence` rather than folding into `/api/me`) were made by hand first, confirmed with Gavi via AskUserQuestion, then a fully-specified implementation task was dispatched to a Haiku subagent for the route/test/client scaffolding. Sonnet (this session) then ran a full Sibling review (`/code-review`, which itself fans out into ~7 parallel review angles — correctness, reuse, simplification, efficiency, altitude, cross-file, conventions — each returning as a separate background notification, not a separate "mode" Gavi chose) and fixed the real findings by hand before merge. Worked well for a well-scoped, non-security-boundary-heavy ticket; worth reusing for similarly-shaped tickets, but schema/auth-boundary decisions stay hand-made, not delegated.

### Real state, right now
All 7 worktrees (primary + 6 role worktrees) synced and clean at `fc810a1`. Dev servers (backend :3000, client :5173) were started twice this session for live walkthroughs — check before assuming either is running next session, they may have been left up or killed depending on how this session ended.

### What's next, concretely
Epic 5 (Admin Cockpit) still-Open children, in strict key order (per project convention — always work Epics in order, no jumping ahead for perceived urgency): **G411-44** is next up. Others still open: G411-68, 69, 80, 89, 90, 91, 93 (G411-92 is parented under Epic 3). Of the non-next-in-order ones, worth flagging when their turn comes:
- **G411-90** (reopen + credit re-charge) — most correctness-sensitive, money-adjacent.
- **G411-91** (friend close-confirm UI) — real, small, missing-UI-only gap.
- **G411-93** (nudge UX decision) — small, unblocks re-exposing the hidden G411-88 button.
- **G411-89** (list refetch perf) — real but lower urgency.

No task has been explicitly picked up yet for the next session — agree with Gavi which one before touching code, per the session-start ritual (though per Epic-order convention it should default to G411-44 unless Gavi says otherwise).

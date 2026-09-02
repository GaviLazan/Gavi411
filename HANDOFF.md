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

## Where this session left off (2026-09-02) — E2E encryption reframed and paused (decision #98). PLANNING ONLY, no code touched. Full detail moved to its own doc.

**Read `gavi411-e2e-encryption-plan.md` in full before touching anything
messaging/encryption-related.** That's now the living doc for this
topic — current status, target architecture (escrow-only, replacing
device-linking), the wipe plan, what reverting to plaintext actually
requires, and every open question still unresolved. Don't duplicate that
content here; update it directly as the plan evolves. `gavi411-brain.md`
decision #98 has the full reasoning/history of how this was decided, if
context on *why* is needed beyond the plan doc's current-state summary.

**One-line summary**: after G411-85's findings (real bugs in
device-linking — decision #97), Gavi and Claude worked through the
actual architecture live. Conclusion: replace device-linking with a
single escrow-only mechanism, wipe all accounts (including admin) and
re-onboard through it, and pause E2E entirely to finish the rest of the
product first (Lifecycle, Cockpit, Credits, Notifications) — E2E reverts
to stretch-goal-if-time-remains, matching the PRD's original framing.
**Nothing has been implemented yet** — Gavi's explicit instruction is to
keep planning and confirm before any code changes.

### Also this session, already done and confirmed (unrelated to the reframe, real and shipped)
- **A real production bug, fixed**: `CLOUDINARY_URL` was never set on
  Render (confirmed via Render logs: "Must supply api_key"), pre-dates
  this session. `render.yaml` now declares it + the three `VAPID_*` vars
  (commit `e006295`); Gavi added the real values in Render's dashboard
  and redeployed — confirmed fixed live (image upload succeeded).
- **G411-29 (Web Push infra)** — Reconciled, merged PR #37 (`42c2501`).
  Full Sibling review, 7 correctness fixes, doc correction for the
  admin-channel question (decision #93). Real, confirmed, unaffected by
  the later architecture reframe.
- **G411-28 (target E2E's stated scope)** — Reconciled earlier this
  session; confirmed live via real git history. The infra itself
  (device-linking, search index) works as built — it's what gets built
  ON that infra going forward that's now in question, per the reframe.

### Real state, right now
Primary worktree (`Gavi411`) on `main`. Worktree sync across all 7 not
re-verified since before tonight's planning conversation — re-check at
next session start, don't assume clean.

### What's next, concretely
1. **Keep planning with Gavi** — see `gavi411-e2e-encryption-plan.md`
   §2/§4/§5/§6 for the specific open questions. No code until planning
   is confirmed done.
2. Once confirmed: likely order is (a) resolve G411-85/G411-83/G411-84's
   ticket disposition per the plan doc §7, (b) build the wipe +
   plaintext reversion, (c) resume normal epic-order work on the rest of
   the product, (d) escrow-only E2E rebuild later if time remains.
3. The E2E encryption explainer deck — still owed, more relevant now
   given tonight's real architecture work, but only worth writing once
   the final shape is known.

### Other loose ends, unchanged from before
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- Memory note saved (not Jira): admin can currently open/message a
  Request with themself — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

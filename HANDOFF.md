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

## Where this session left off (2026-09-08) — G411-42, 43, 44 all Reconciled, live-verified. Haiku/Sonnet split now the standing default (decision #110).

### What shipped
- **G411-42** — Trigger/keyword admin UI. PR #65.
- **G411-43** — Manual online/offline presence toggle. PR #67.
- **G411-44** — Gavi-initiated request flow (admin creates a request for an existing user, selected from a dropdown, opt-in credit charge, Web Push notify). PR #70, plus a same-day follow-up (#72) for live usability fixes caught during the walkthrough.
- All three Reconciled against real live walkthroughs (dev servers started, DB/API checked directly), not just build/test evidence.

### Process changes this session
- **Decision #110**: Sonnet-defines/Haiku-codes/Sonnet-reviews is now the DEFAULT execution model for every coding task, confirmed by Gavi as a standing rule (not just a one-off trial). Full mechanics in `gavi411-brain.md` and `CLAUDE.md`'s "Required workflow" §8. Opus escalation is confirm-first, not automatic.
- **Decision #111**: admin never gets a separate self-service "create a request for myself" path — the admin cockpit has exactly ONE "new request" entry point, always the on-behalf-of-a-friend flow. Caught live on G411-44 (an early draft added a second, confusingly-labeled button) — Gavi corrected it directly, referencing a standing complaint from weeks earlier. `AdminList.jsx`'s existing button now opens the on-behalf-of-a-friend flow; the old self-service `NewRequest.jsx` form is friend-only now.
- **G411-44's Sibling review caught a real regression before merge**: Haiku's draft replaced `lib/credits.js`'s real `deductCredit`/`refundCredit` with no-op mocks in the shared test file, silently breaking 3 pre-existing tests. Fixed with `vi.importActual` + per-test `vi.spyOn`. Worth remembering: when dispatching test-file changes to Haiku, watch for wholesale module-mock replacements that widen beyond the new test's own needs.
- **A real security gap caught in review, not by the ticket's own spec**: G411-44's first draft let admin select themselves in the "which friend" dropdown — fixed with both a query filter (`GET /users` excludes `role: ADMIN`) and a server-side guard on `POST /admin-create` (defense in depth against a direct API call).

### Live-verified specifics worth remembering
- **Push notifications are not actually working yet** — confirmed live during G411-44's walkthrough: `sendPushToUser` fires cleanly (VAPID configured correctly, no errors logged) but there are ZERO `PushSubscription` rows in the real DB. Nobody has ever subscribed because the subscribe-flow/permission UI (G411-49) hasn't been built. This is expected/known, not a new bug — but worth remembering next time a ticket assumes push notifications are live end-to-end.
- **AdminCreateRequest.jsx and the top-nav had zero dedicated CSS** — same gap pattern as the standing `check-css-imports-before-adding-classes` memory: admin pages built this session (`InviteAdmin`/`TriggerAdmin`/`AdminCreateRequest`) never got their own stylesheet the way `NewRequest`/`RequestDetail` did, and it was genuinely unusable on mobile (not just unpolished) — Gavi called this out directly rather than letting it slide as "not designed yet." Fixed: `AdminCreateRequest.css` added (fields stack one-per-line), and the top-nav split into two rows (logo/account on its own line, all toggle/admin buttons below it) rather than one overflowing row.

### Real state, right now
All 7 worktrees synced and clean at `808596d`. Dev servers were started/stopped twice this session for live walkthroughs — not running at session end.

### What's next, concretely
Epic 5 (Admin Cockpit) still-Open children, in strict key order: **G411-68** is next up (per key-order convention; G411-58/59/60 are v2/stretch tickets referenced by 42/43/44 but not in Epic 5's own sequence — check Jira directly rather than assuming). Others still open: G411-69, 80, 89, 90, 91, 93 (G411-92 is parented under Epic 3). Worth flagging when their turn comes:
- **G411-90** (reopen + credit re-charge) — most correctness-sensitive, money-adjacent.
- **G411-91** (friend close-confirm UI) — real, small, missing-UI-only gap.
- **G411-93** (nudge UX decision) — small, unblocks re-exposing the hidden G411-88 button.
- **G411-49** (push subscribe flow) — not in this session's radar but directly relevant now that G411-44 has a real, wired, currently-inert push call site waiting on it.

No task has been explicitly picked up yet for the next session — agree with Gavi which one before touching code, per the session-start ritual (though per Epic-order convention it should default to G411-68 unless Gavi says otherwise).

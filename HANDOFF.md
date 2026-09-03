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

## Where this session left off (2026-09-02 night → 2026-09-03) — G411-38's own admin/friend detail-screen work (G411-39, 40, 87, 88) is Reconciled. 5 new real gaps filed and Open. Epic 5 continues.

**Sequence, for context**: an unattended overnight run (Gavi asleep, explicit low-supervision exception granted) built G411-39/40/87/88 and merged all four (PRs #57-60) with build/test-only evidence — no live/visual check ran, since no browser-automation tool is available in this environment. Gavi then manually walked through the real running app this morning and found several genuine regressions the overnight evidence bar never caught. Those got fixed (PR #62, Sibling-reviewed, 3 real findings all fixed), and all four tickets are now Reconciled for real, against actually-verified live behavior — not just merged code.

### What shipped and is now Reconciled
- **G411-39** — admin status dropdown, applies immediately (no separate "Change" button, per live testing), only offers legal next-statuses.
- **G411-40** — private admin-only notes per request; confirmed via code (not just claimed) that friends have zero visibility — server route `requireAdmin`-gated, response shape never includes notes for a friend caller, client never renders the Notes UI outside the admin branch.
- **G411-87** — friend-facing Cancel/Self-solved/"No longer urgent" buttons, same confirm-modal machinery as admin's.
- **G411-88** — nudge button was built, worked, then **hidden** per Gavi's live call (no cooldown, wrong tone — reads as a formal auto-close warning, not a casual nudge). Reconciled anyway, with a Jira comment explaining the hide — the ticket's own scope (wire the endpoint) was genuinely done; the hide is a deliberate post-landing product decision, not an unfinished acceptance criterion. `POST /:id/nudge` stays fully wired server-side.

### Real bugs found and fixed during the live walkthrough (PR #62, merged `0194a47`)
- **Messages actually disappearing (not just flashing) after any status/urgency change** — the PATCH `/:id` response never included `message` at all, so every `setRequest(updated)` silently dropped the whole thread from client state until a full page refresh. Root-caused to a **stale backend process**: server-side fixes were edited but the already-running `node server.js` had no file-watcher and never picked them up — restarting it is what actually made the fix real. Worth remembering: after editing server files mid-session, restart the dev server before claiming something's verified.
- Decrypt effect was keying off `request.message`'s array *reference* (changes every PATCH even with identical content) — separate, smaller flash-causing bug, fixed alongside.
- `ConfirmModal` had no busy-guard — a fast double-click could re-send an already-applied status change; fixed, then Sibling review caught the native Escape-key dismiss wasn't gated the same way — fixed too.
- Admin list rows now show `request.status` directly (previously only inferable via the open/closed filter).
- Urgency downgrade now posts a real visible thread message (same convention as the existing nudge message — schema has no system-message concept, `Message.userId` is required).
- Message timestamps pinned to `en-GB` (dd/mm/yyyy) explicitly.
- A separate native `<input type="date">` (travel intake form) showing `mm/dd/yyyy` is **not a bug** — that's the browser/OS's own locale rendering, unrelated code path from the message-timestamp fix; left as-is per Gavi's call (locale-correct, not something to force one way for everyone).

### 5 new real gaps found live, filed as their own tickets, none started
- **G411-89** (parent G411-5) — `AdminList`/`RequestList` fully unmount+refetch on every navigation away-and-back to the list view; real perf bug, not from tonight's tickets, traced to `App.jsx`'s mutually-exclusive view-switch ternary.
- **G411-90** (parent G411-5) — auto-reopen-on-message only checks literal `Status.CLOSED`, never fires for CANCELLED/SELF_SOLVED; bundled with a second real gap, no credit re-charge happens on reopen (Gavi's expected model: create −1 → refund +1 → reopen −1 again, symmetric — currently nothing charges on the way back). Both bugs are one feature, don't ship one without the other (a refunded request could reopen for free otherwise).
- **G411-91** (parent G411-5) — `canCloseRequest`/`RESOLVED_PENDING_CONFIRMATION` (G411-33) is real and server-enforced, but there is genuinely zero UI anywhere for a friend to actually confirm-and-close a request. A request stuck at `RESOLVED_PENDING_CONFIRMATION` today has no forward path except admin manually reverting it.
- **G411-92** (parent G411-3) — `RequestDetail` never refetches while mounted (no polling, no focus-refresh) — the other party's changes (status/urgency/message) aren't picked up until the page is left and reopened, which can surface as a confusing rejected-action error mid-flow. Deferred deliberately (Gavi's call) rather than folded into the same-night fix batch — real architecture question (polling interval, not real-time infra per CLAUDE.md's no-WebSockets rule), deserves its own pass.
- **G411-93** (parent G411-5) — decide real nudge UX (cooldown, tone — notification vs. chat message, drop the "this closes automatically" claim which isn't even true for a manual nudge) before re-exposing the hidden G411-88 button.

### Two real process mistakes this session, both logged as brain.md decisions
- **Decision #108**: a new Task's parent Epic must be non-Reconciled at filing time — G411-90/91 were initially (wrongly) parented under the already-Reconciled G411-4, following a precedent (G411-33/87) that no longer applied since G411-4 closed since then. Moved to G411-5 (still Implementing).
- **Decision #109**: this session had the confirm-gate severity backwards — treated PR self-merge as routine while re-confirming Jira Reconciled transitions even after Gavi had already answered the question. Merge is the actually-hard-to-reverse action and deserves the strict gate; a Jira status is trivially reversible. Also: once a plain question is asked and answered, don't re-ask it in different words.

### Real state, right now
All 7 worktrees (primary `Gavi411` + 6 role worktrees) synced and clean at `eeaad6d` (confirmed via `git status --short` + `git log --oneline -1` across all 7). Two mechanical guardrails from last session (decision #106) are active and were exercised for real tonight: the GitHub ruleset blocked a direct push to `main` when first attempted (correctly), and the repo-committed pre-push hook is installed (`core.hooksPath .githooks`) in all 7 worktrees. Dev servers (backend :3000, client :5173) were run live this session for the walkthrough — not confirmed still running at session end, check before assuming either is up.

### What's next, concretely
1. **G411-93** (nudge UX decision) is a real product call needed before that button can come back — worth resolving early since it's small and unblocks re-exposing a feature that already technically works.
2. **G411-90** (reopen + credit re-charge) is the most correctness-sensitive of the filed gaps — money-adjacent, deserves a focused pass with real tests, not a quick fix.
3. **G411-91** (friend close-confirm UI) is a real, small, missing-UI-only gap — same shape as G411-87/88 were (backend exists, tested, zero caller).
4. **G411-89** (list refetch perf) and **G411-92** (no live sync in RequestDetail) are both real but lower urgency — neither blocks a flow, both are "this feels slow/stale" rather than "this is broken."
5. **Epic 5 (Admin Cockpit) itself is still Implementing** — Reconciled children now include G411-37, 38, 39, 40, 41, 70, 71, 76, 81, 87, 88; still-Open children: G411-44, 68, 69, 80, 89, 90, 91, 93 (G411-92 is parented under Epic 3, not 5).

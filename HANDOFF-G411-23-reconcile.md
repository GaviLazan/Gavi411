# HANDOFF — G411-23 Reconcile process (special, narrow-scope doc)

Not a replacement for `HANDOFF.md` (the session-continuity doc) — this is a
focused trail for one specific in-flight process: closing out G411-23,
which turned out to have more moving parts than a normal wrap-up because its
scope grew mid-flight (handleSubmit got folded in) and a gap-analysis pass
happened in parallel. Delete this file once G411-23 is actually Reconciled;
its content should not outlive that event.

## Where this stands right now

**G411-23 is Landed, NOT Reconciled — correctly blocked, not forgotten.**

### Why it's blocked (the real reason, not a checklist afterthought)

G411-23's scope grew mid-session: `handleSubmit` (wiring `NewRequest.jsx` to
actually call `POST /api/requests`) was explicitly folded into this ticket
after Gavi confirmed it wasn't owned anywhere else. That work is real,
built, and live-verified — but it currently only exists on an **unmerged
branch**, PR #4 (`you/G411-23-wire-handlesubmit`), open and awaiting
**Matan's review**.

"Reconciled" means acceptance criteria are re-checked against the **landed**
state (CLAUDE.md's own definition, per Aegis-spec.md §5.5). If PR #4 hasn't
merged, part of G411-23's own current scope isn't in the landed state yet —
Reconciling now would be certifying work as done against a reality that
doesn't fully exist. Gavi caught this live; it was about to be skipped.

### What's already been verified (does NOT need to be redone)

All of this was run fresh, live, this session, against real Neon:

1. **Core create+deduct transaction** — request created, balance
   decremented atomically, one ledger row, `typeDetails` round-trips
   correctly through Postgres JSONB (key-reorder on storage confirmed
   harmless, not a bug).
2. **Race-condition fix** — balance re-checked fresh inside the `$transaction`
   (not the stale `req.user` snapshot); a second attempt against a
   balance of 0 correctly blocked before any write.
3. **stripEmpty, scalar fields** — `"0"`/`false` kept as real values,
   `""`/`null`/`undefined` dropped.
4. **stripEmpty, `flights` array (gap-analysis finding C4)** — re-verified
   fresh per Gavi's explicit request, right before this doc was written:
   - Multiple flights + one fully-empty entry + one partially-empty entry
     → empty one dropped, partial one keeps only its real fields.
   - All flight entries empty → `flights` key vanishes from the object
     entirely (not saved as `flights: []`).
   - No `flights` key in input at all → no crash.
   - Single flight, nothing else in the object → survives with minimal
     shape.
   - All 4 cases, 8 assertions, ALL PASSED. Test script written, run,
     then deleted (not left in the repo — matches the project's own
     pattern of not leaving scratch verification files behind).
5. **401 on unauthenticated request** — confirmed via curl against the
   real route.
6. **Migration** `20260823_add_type_details` applied to live Neon,
   `Request` table confirmed empty before migrating.
7. **`handleSubmit` itself** (the part still gating Reconciled) — verified
   live via Playwright: real POST fires with the full payload, gets a
   real 401 (no sign-in screen exists yet, G411-66), error surfaces to
   the user correctly ("Unauthorized"), submit button re-enables after
   the error, zero unexpected console errors.

**None of the above needs re-running once PR #4 merges.** The only new
thing needed at that point is confirming the merge itself happened and
doing the actual Jira transition — not re-verifying logic already proven.

## What's left, in order

1. **Wait for Matan's review on PR #4.** Nothing to do here except wait —
   don't ping, don't remind, don't merge preemptively. Read-only access
   collaborators (Matan, eldaduz) were deliberately set up for exactly
   this kind of review-only role this session.
2. **Once Matan approves and the PR is merged** (by Gavi, or by Matan if
   he's later given write access — currently he's read-only, so Gavi
   merges):
   - `git fetch origin && git checkout main && git merge origin/main --ff-only`
     to sync local `main`.
   - Confirm `gh pr view 4 --json state,mergedAt` shows `MERGED`.
3. **Then, and only then, run the actual Reconciled step:**
   - Re-confirm the Falsifier one more time against the now-fully-merged
     state (a fresh curl/Playwright check covering both the backend
     route AND the now-merged frontend wiring together, end-to-end as
     far as G411-66's absence allows) — not because the individual
     pieces weren't already tested, but because "Reconciled" specifically
     means checking the *combined*, *landed* state, which doesn't exist
     until after the merge.
   - Post a final Aegis evidence comment on G411-23 noting the merge
     landed and citing this doc's earlier verification runs (no need to
     literally re-paste all of them — link back to the existing
     Landed-stage evidence comment already on the ticket).
   - Ask Gavi directly, plain text (not AskUserQuestion — see
     `~/.claude/projects/-home-gavi-Desktop-Gavi411/memory/reconcile-confirm-plain-question.md`):
     confirm the Landed → Reconciled transition.
   - Transition Jira: Landed → Reconciled.
   - Delete this file (`HANDOFF-G411-23-reconcile.md`) — its job is done
     once the ticket is actually Reconciled.

## Context: this happened mid-gap-analysis-followup work

This pause came up while working through the 2026-08-23 gap analysis
(`gavi411-gap-analysis.md`) findings one by one, per Gavi's explicit
"run me through Medium/Low one by one" instruction. Specifically:
finding **C4** (stripEmpty's `flights`-array branch had no falsifier
evidence on record) was deliberately deferred earlier ("not running it
now, running it when [G411-23's Reconciled check] happens") — then Gavi
asked to actually do that check, which surfaced this real question about
whether G411-23 could even be Reconciled yet given PR #4's open state.

The gap-analysis followup list itself is **not paused** by this — it's a
separate, parallel thread. Findings A1/A4/C4/C5 are done (G411-68, note on
G411-45, this verification, G411-69 respectively). Next up whenever this
resumes: **C6** (the `GroupTag` enum mismatch), then continuing through the
rest of Medium, then Low. See `gavi411-gap-analysis.md`'s own "Prioritized
list" section for the full remaining order if this file and `HANDOFF.md`
are both stale by the time someone reads them — the gap-analysis doc itself
doesn't get overwritten each session the way `HANDOFF.md` does.

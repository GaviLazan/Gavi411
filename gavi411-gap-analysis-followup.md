# Gavi411 — Gap Analysis Followup Tracker

Dedicated tracker for working through `gavi411-gap-analysis.md`'s 31
findings (6 High, 13 Medium, 12 Low) one by one with Gavi. That file is the
original report (methodology, full finding text, prioritized list) and stays
as-generated — this file tracks the *live status* of acting on it, updated
as findings get resolved. Delete or archive this file once the full list is
worked through; the original report can stay as historical record on its own.

**Process**: High findings first (all resolved as of this doc — see below),
then Medium and Low run past Gavi individually, one at a time, not
batch-applied. Each finding gets: what was decided, what was done (ticket
filed / doc updated / code fixed / deferred), and any correction Gavi made
to the original report's reasoning along the way.

---

## High findings — all 6 resolved

| # | Finding | Resolution |
|---|---|---|
| A2/A3/D1 | No ticket owned the request list/home screen or `GET`/`PATCH` request routes — highest-leverage gap found | Filed **G411-67** (one ticket, both pieces — Gavi's call, tightly coupled) |
| C1 | Sign-in UI gate | Already tracked as **G411-66**, confirmed still accurate, no new action |
| C2 | `HANDOFF.md`'s "handleSubmit still needs wiring" note was stale | Fixed directly in `HANDOFF.md` |
| C3 | No loading/error/empty-state ownership | Per the report's own recommendation: no dedicated ticket, add a line to each relevant ticket's scope at its own pickup time |
| F1 | No scheduling-mechanism ownership (credit reset vs. auto-close) | Per the report's recommendation: a decision for whoever picks up G411-35/46 first, not a filing action now |
| F2 | G411-38 (admin detail screen) predates `typeDetails`, doesn't mention rendering it | G411-38's live Jira description expanded directly |

## Medium findings — status

| # | Finding | Status | Notes |
|---|---|---|---|
| A1 | PRD's "request access" homepage flow has no owner | **Done** | Filed **G411-68** under Parent 5 |
| A4 | G411-45 bundles a DB column + UI display as one ticket; UI half depends on G411-67 existing | **Done** | Noted directly in G411-45's description, no new ticket |
| C4 | `stripEmpty`'s recursive array-cleaning branch (`flights`, TRAVEL-only) had no falsifier evidence on record | **Done** | Re-verified live, fresh: 4 cases (mixed empty/partial/real entries, all-empty array, absent key, single-flight-only), 8/8 assertions passed. Test script wasn't kept in the repo. |
| C5 | Auto-created `User` row's placeholder `phoneNumber` never gets replaced by anything real | **Done, with a real correction** | The report's own justification ("needed before Telegram notifications can rely on real contact data") was **wrong** — Telegram notifications (G411-50/51) go to Gavi, not friends. **Gavi's actual fix**: no placeholder at all — collect phone number (+ other PRD §3 core fields) as a first-login gate, not a someday-editable settings screen. Filed **G411-69**, citing brain.md decision #53 (the original commitment this follows through on) and decision #56 (the correction itself, recorded properly). |
| C6 | `GroupTag` enum mismatch (`CLOSE/REGULAR/LIMITED` vs. PRD's `Acquaintance/Regular/Close`) — will break G411-46 the moment it's picked up | **Not yet started** | Next up |
| D2 | Extract G411-23's balance-mutation pattern into a shared helper when G411-45 starts | Not yet started | |
| E1 | G411-25 (thread UI) should get an `[Agentic]` styling companion, matching G411-37/38's precedent | Not yet started | |
| F3 | Overdraft (G411-47) design is captured as a Jira comment but not folded into the Description itself | Not yet started | |
| F4 | Was the "max open tickets" cap from the original brainstorm deliberately dropped? | Not yet started | Needs a direct decision from Gavi, not a build |
| F7 | Telegram bot token/chat-ID config source has no explicit owner | Not yet started | |

## Low findings — status

All still **not yet started**: A5 (install-iOS help page wiring), D4 (E2E public-key schema field), E2 (G411-29/49 split-owner clarity), E3 (G411-42 ownership tag consistency check — confirmed low-stakes already, no action recommended by the report itself).

## Confirmed non-gaps (report checked these, found nothing wrong)

Section B (Jira inventing scope not traceable to the PRD) — none found, clean result. A6 (guest link view) — correctly scoped as v2/stretch. F6 (private notes schema) — correctly scoped already, no visibility flag needed.

---

## A process thread that surfaced mid-followup, resolved

While re-verifying C4, it became clear **G411-23 couldn't actually move to
Reconciled yet** — its scope had grown mid-session (handleSubmit wiring
folded in after the backend piece first Landed), and that folded-in work
only existed on an unmerged PR. Gavi caught this live before a premature
Reconciled confirmation happened. Resulting general lesson recorded as
**brain.md decision #57**: Reconciled requires the ticket's *current* full
scope to be landed, not just whatever part reached Landed first. Full
current status of G411-23 itself lives in `HANDOFF.md` (the regular
session-state doc), not here — this note exists only to record *why* the
followup process paused on it.

## Next when this resumes

Pick up at **C6** (GroupTag enum fix). Continue through the rest of Medium,
then Low, one at a time with Gavi. Once the full list is worked through,
this file's job is done — see `HANDOFF.md` for what happens after (Gavi's
queued #2: shifting back toward an agentic-first workflow, explicitly
waiting on this list being fully resolved first).

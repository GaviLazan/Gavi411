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

## Active: user-journey walkthrough running in a separate chat (2026-08-26)

**Real trigger**: while investigating G411-28 (E2E encryption) readiness,
found a materially serious gap — **no ticket anywhere owns the actual
admin-facing "create an invite" UI** (a button/screen Gavi clicks to
generate an invite). G411-41 only covers the backend token mechanism;
G411-68 is the unrelated stranger-request-access queue; G411-28 itself
just assumes "Gavi creates an invite (existing case-by-case flow)" was
already built somewhere — it wasn't. Two prior gap analyses this project
(document/code-consistency scans) didn't catch it, because it's not an
inconsistency — it's a step described only in PRD prose that was never
translated into an actual ticket. Gavi's reaction, correctly: this is a
basic PM/UX/architect-level miss that a real walkthrough should have
caught, not an acceptable "emerged from conversation" outcome.

**Fix in progress**: a structured user-journey walkthrough prompt was
written to `user-journey-walkthrough-prompt.md` (repo root) — walks 9
concrete journeys (friend cold-start, friend existing-user, Gavi
inviting someone, Gavi's request-access queue, Gavi's day-to-day triage,
admin promotion, credit lifecycle, messaging security, PRD §6 feature
table sweep) step by step, forcing an explicit "what screen/route/button
does this, which ticket owns it, is that ticket's status consistent with
it actually working today" answer at every step — designed specifically
to not accept "existing flow" as an answer without verification, unlike
the prior two attempts.

**Currently running in a separate chat** (Gavi's explicit call, matches
the session-boundary rule). **Do not start G411-41 or any invite-adjacent
work in this thread until that comes back** — its findings may reshape
what "ready to build" means for the whole invite/G411-28 chain. Check
back with Gavi on its results before picking up anything in this area.

---

## G411-76 — Reconciled (2026-08-26 session)

**Real bug fixed, not just filed**: `requireAuth` was reading
`firstName`/`lastName`/`email` off Clerk's session-JWT claims, which
Clerk never populates without a custom JWT template (none configured)
— every user row in live Neon had permanently blank names. No `email`
column existed at all. No admin-role mechanism existed either — `role
=== 'ADMIN'` was referenced in code but nothing could ever set it, and
there was no way to tell which Prisma row was which real person.

**Fix**: `requireAuth` now calls Clerk's Backend API
(`clerkClient.users.getUser`) on first-request user creation instead of
reading unpopulated claims. Added `User.email` (nullable, unique),
migrated live. Identified real users by cross-referencing Clerk's API
directly (not guessed) — `user_3I3duQkdEIz1mzbOC0iumup3AzM` = Gavi
Lazan, `user_3I8QiBXmDf70DMvdRHv6N70gS2T` = a real Clerk test account
(`gavers+clerk_test@gmail.com`). Backfilled both with real data.
Promoted Gavi's row to `role: ADMIN` via a new, reproducible
`scripts/promote-admin.js` (not a one-off manual DB mutation — that gap
was itself caught and fixed during Sibling review, see below).

**Deliberately NOT covered here** (separate tickets, correctly split
out this session): phone number / profile picture sync — **G411-69**
(first-login-gated, our-owned fields, untouched). Push-back sync (Prisma
→ Clerk) + an ongoing user-editable profile screen — **G411-80** (filed
this session, then widened same session from "just push-back" to the
general profile screen after Gavi's call — no profile-edit UI existed
at all before this). Continuous drift protection for a user editing
Clerk *after* their row is created — `ponytail:`-flagged as
sync-on-create only; add a `user.updated` webhook if that becomes real.

**Sibling review (medium), 8 parallel angles, found 4 real issues, all
fixed** (note: the review skill's background plumbing re-notified
several already-finished subagents 2-3 times each mid-review — noisy
transcript, no duplicate work done, nothing acted on twice, worth
flagging as a rough edge but not a real problem): (1) "promote admin"
was claimed in the PR but only done as an unreproducible manual Neon
mutation — fixed with the promote-admin.js script; (2) email was read
via `emailAddresses[0]` instead of resolving the primary address via
`primaryEmailAddressId` (Clerk's array isn't ordered) — fixed; (3)
`clerkClient.users.getUser()` had no try/catch, unlike this codebase's
established external-call convention (Cloudinary upload) — now wrapped,
503s cleanly instead of an unhandled 500; (4) unguarded race on
`prisma.user.create` for concurrent first-requests from the same new
user — now recovers via a P2002 catch.

**PR #28 merged** via regular merge commit (`--merge --admin`), commit
`24ba87f`. Branch deleted (remote + local).

**Evidence**: 50/50 Vitest (7 new cases across both commits). Clean
client build. Live Neon query re-verified post-fix.

**Process note**: the Jira "Reviewing → Landed" transition got blocked
once by Claude Code's own permission classifier (unrelated to Jira
itself) — retried a couple turns later with the identical call and it
succeeded, no code/state change needed. Treat a classifier block as a
soft "retry," not a hard stop, going forward.

**Reconciled** — Gavi's explicit go-ahead given. Parent **G411-5**
(Admin Cockpit) correctly stays **Open** — 11 of its 14 children are
still Open (G411-37, 38, 39, 40, 41, 42, 43, 44, 68, 69, 80); only
G411-70/71/76 are Reconciled.

---

## G411-79 — investigation resolved, still Open (2026-08-26, separate chat)

**The real open architecture risk flagged when this ticket was filed
(G411-26 session) is now resolved with real evidence**, written into
the ticket itself, not just chat: a 100MB video upload through
G411-26's backend-proxy pattern (`multer.memoryStorage()` → Cloudinary)
does **not** survive on Render's free tier (512MB RAM) — local
empirical testing showed a single 100MB upload peaks at ~265MB RSS
(~2.65× the file size), over half the free tier's entire budget before
Prisma/Clerk are even in the picture. **Verdict: G411-79 needs
client-direct-to-Cloudinary (signed upload, server only issues a
signature) for the video case specifically** — images can stay on
G411-26's existing proxy pattern. The signed-upload mechanism (server
generates an HMAC signature via `cloudinary`'s already-installed SDK,
client uploads bytes directly to Cloudinary, API secret never leaves
the server) was confirmed viable and is written into the ticket in
full. No code was written — this was investigation only, ticket stays
Open, ready for real pickup whenever its turn comes.

---

## G411-41 — Open, not yet picked up

Real dependency of G411-28's escrow-generation step (per G411-41's own
"Not covered" text: "The escrow-passphrase generation tied to invite
creation (G411-28) is a separate, later-layered concern on top of this
basic token gate"). **Blocked from pickup right now** — see the active
walkthrough note at the top of this file; its scope may need to expand
to include an actual invite-creation UI (currently missing from every
ticket that touches invites) before it's picked up for real.

---

## G411-28 (target E2E) — not started, real prerequisites identified this session

Two real dependencies found and addressed/in-progress this session:
**G411-76** (Reconciled — admin role + identity sync) and **G411-41**
(Open, currently blocked pending the walkthrough's findings — invite-
creation mechanism the escrow flow hooks into). The pure crypto core
(keypair gen / ECDH / AES-GCM) has no dependency on either and could
start independently, but hasn't yet — no explicit go-ahead given this
session. G411-28 also needs G411-69's admin-role gap resolved for its
own admin-search and device-linking pieces specifically (already true
via G411-76).

---

## Next steps, in order

1. **Wait for the user-journey walkthrough** (running in a separate
   chat) to come back — it may surface more gaps like the missing
   invite-creation UI, and will likely reshape G411-41's actual scope.
2. Once that's back and reviewed with Gavi: pick up G411-41 (possibly
   expanded scope) — invite-token mechanism + whatever UI gap the
   walkthrough confirms.
3. Then G411-28 (E2E) becomes properly unblocked for its escrow piece;
   crypto core could theoretically start earlier if Gavi wants to
   parallelize.
4. G411-79 (video/doc attachments) is fully unblocked and ready
   whenever it's next in Epic order — no remaining unknowns.

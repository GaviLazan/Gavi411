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

## Active plan: G411-28 (target E2E), one pass across 4 stages (2026-08-30)

**Gavi's explicit sequencing, pre-approved as one pass** — report back after
each stage, flag genuine ambiguity via `AskUserQuestion`, but don't stop for
a go-ahead between stages unless something real comes up:

1. **G411-28, pieces #1–2 first**: keypair generation (Web Crypto API,
   client-side, private key in IndexedDB, public key on server) + per-
   conversation ECDH shared secret + AES-GCM message/image encryption. No
   dependency on anything below — genuinely startable now.
2. **G411-41**: invite token generation (admin creates a one-time token,
   stored server-side) + a real admin-facing invite-creation UI (this was
   just added to G411-41's scope 2026-08-27 — previously the ticket only
   described the backend mechanism, no UI existed anywhere to trigger it).
3. **G411-81** (new ticket, filed 2026-08-27): decide + implement the
   actual mechanism that makes an invite token block Clerk sign-up — app-
   side token validation vs. Clerk allowlist (two real options, not
   equivalent, ticket lays out both). Test one real invite end-to-end in a
   real browser. **G411-81 is not a duplicate of G411-41** — G411-41
   produces the token, G411-81 is what makes possessing it matter (right
   now Clerk sign-up is still fully public, nothing enforces anything).
4. **Back to G411-28**: escrow generation + CSV export (unblocked by
   G411-41 existing), admin-side client search index + admin-approved
   device-linking flow (unblocked by G411-76, already Reconciled).

**Stage 1 done (2026-08-30), moving to stage 2.** G411-28 crypto core
landed: `client/src/lib/crypto.js` (keypair gen, ECDH, AES-GCM, Web Crypto
API only, no deps) + `client/src/lib/keyStore.js` (IndexedDB wrapper,
browser-only, untested by design) + `client/src/lib/crypto.test.js`.
Sibling review found and fixed a real bug (`bufToBase64` stack-overflowed
on real image-sized payloads via spread — chunked the encode instead,
added a 200KB regression test). 56/56 Vitest passing. PR #29 merged
(regular merge commit), G411-28 Landed in Jira (Reconciled deferred —
this is one child issue covering the whole target-E2E scope, stages 2-4
still open under it, so Reconciled waits for the full pass to finish, not
per-stage). Standalone subsystem per decision #28 — not yet wired into
the live message send/receive flow, that's still ahead.

**Stage 2 done (2026-08-30), moving to stage 3.** G411-41 landed:
`PendingInvite` Prisma model (token PK, label, usedAt/usedByUserId set
together), `server/routes/invites.js` (admin create/list, no-auth
`GET /:token/valid` — the pre-signin check), `server/middleware/auth.js`
now marks a token used via `x-invite-token` header (best-effort, doesn't
block signup — G411-81's job), `client/src/lib/inviteToken.js`
(sessionStorage stash, survives Clerk's OAuth redirect unlike a bare URL
param), `client/src/App.jsx` (signed-out visitors blocked from Clerk
SignIn without a valid stashed token; returning signed-in users skip the
check), `client/src/pages/InviteAdmin.jsx` (minimal admin screen — create
+ copy link + list, admin-only "Invites" header button). Sibling review
found and fixed a real race (App.jsx fires several first-sign-in requests
concurrently; only the one that wins `requireAuth`'s user-creation race
used to mark the invite, so the token-bearing request could lose the race
and silently discard the token forever) — mark-used logic moved outside
the `if (!user)` block, guarded idempotent via `usedByUserId: null` in
the where clause. 70/70 Vitest passing. PR #31 merged, G411-41 Landed in
Jira (Reconciled deferred to a later confirm, same reasoning as G411-28).
Migration applied live against the real Neon DB.

Note logged on the ticket: G411-41's Jira description still carries the
historical `Owner: [You]` tag (pre-2026-08-24). Per CLAUDE.md decision
#63 this doesn't gate who builds it — flagged, not treated as a stop.

**Next up**: G411-81 (decide + implement the actual Clerk-gating
mechanism), same `agent-backend` worktree. Not started yet this session.

**Deliverable owed once the whole E2E pass is done**: a 2-page PDF/slide
deck explaining how the E2E encryption works in practice, including which
files are involved — Gavi asked for this on 2026-08-30, to hand over once
all 4 stages land, not per-stage.

### DESIGN.md — resolved, no action needed
The uncommitted DESIGN.md diff flagged earlier this session turned out to
be Gavi's own WIP, since committed — findable on `docs/design-product-md-
refresh` (commits `9a93ee4`, `5b7ea6a`), not yet merged into `main`. Not
touched by this pass; his branch to merge when ready.

### Prerequisites already resolved, don't re-derive
- **G411-76** (Clerk↔Prisma sync + admin role) — Reconciled. Real admin
  identity exists (`user_3I3duQkdEIz1mzbOC0iumup3AzM` = Gavi, promoted via
  `scripts/promote-admin.js`), name/email sync from Clerk works correctly.
- **G411-79** (video/doc attachment architecture) — investigation resolved
  (separate chat), written into the ticket. Not part of this pass, unrelated.

### Worktree/role assignment for this pass
- **Stage 1 (G411-28 crypto core)**: use the **`agent-e2e`** role —
  dedicated worktree already exists at `../Gavi411-agent-e2e` (currently on
  branch `agent-e2e/base`, 2 commits behind `main` at `c32c95e` vs. main's
  `5a50a4b` — resync it before starting, per the commit-convention's
  "resync the role worktree right after its own PR merges" section, since
  it missed G411-76's merge). Git identity: `git-as-agent-e2e` /
  `agent-e2e@gavi411.local`.
- **Stages 2-3 (G411-41, G411-81)**: use **`agent-backend`** — same role
  that built G411-76, dedicated worktree at `../Gavi411-agent-backend`
  (currently on stale branch `agent-backend/G411-73-theme-toggle`, also 2
  commits behind — resync before use). Git identity: `git-as-agent-backend`
  / `agent-backend@gavi411.local`.
- **Stage 4 (G411-28 completion)**: back to `agent-e2e`.
- Every stage: one branch per child issue (`agent-<role>/G411-XX-slug`),
  Sibling review before merge (all of this is load-bearing — auth, crypto,
  identity), regular merge commit (`--merge`, never squash), branch deleted
  after merge, HANDOFF.md updated, Jira transitioned through the real named
  states (Open→Implementing→Reviewing→Landed→Reconciled — Landed→Reconciled
  needs Gavi's explicit confirm per the hard-to-reverse-action rule).

### Known rough edges to remember mid-pass
- **Jira transition calls can get blocked once by Claude Code's own
  permission classifier** (unrelated to Jira) — retry once or twice before
  treating it as a real failure; this happened on G411-76 and resolved on
  retry with zero state change needed.
- **`/code-review` skill's background plumbing can re-notify already-
  finished subagents 2-3 times** mid-review — noisy transcript, not
  duplicate work, nothing to act on twice. Also happened on G411-76.
- **Full worktree sync check** (git status + git log hash match against
  `origin/main`, every worktree) is a required step before calling any
  stage's wrap-up complete — don't skip it because "the ticket's own files
  are clean."

---

## G411-81 — Open, not started (filed 2026-08-27)

Invite-link gating mechanism for Clerk sign-up. Carries forward G411-71's
real remaining scope (G411-71 stayed Reconciled per Gavi's explicit call —
not reopened; a comment on G411-71 points here). Full scope: two candidate
mechanisms (app-side token validation vs. Clerk allowlist), pick one,
implement it, test one real invite end-to-end. Depends on G411-41 existing
first (or being built in parallel) for its own test step.

---

## G411-41 — Open, scope updated 2026-08-27, not started

Now explicitly includes the admin-facing invite-creation UI (previously
missing — this was the real gap found while checking G411-28's readiness,
via a full user-journey walkthrough). Needs: token generation + storage,
a real (can be minimal) admin screen to trigger it and get the resulting
link, token validation on signin, mark-used. Does NOT include deciding the
actual Clerk-gating mechanism — that's G411-81.

---

## G411-76 — Reconciled (2026-08-26 session, unchanged, for reference)

Clerk↔Prisma sync fixed (real name/email now populate on user creation via
Clerk's Backend API, not blank JWT claims), `User.email` column added,
admin role mechanism built (`scripts/promote-admin.js`, reproducible, not a
manual DB mutation). Sibling review found and fixed 4 real issues (primary-
email resolution via `primaryEmailAddressId` not array index, try/catch
around the Clerk API call, a P2002 race-recovery on concurrent user
creation, the promotion script itself). PR #28 merged, 50/50 Vitest passing
as of the last schema change (see below).

---

## Gap-triage session — closed out 2026-08-27, decisions #70/#71 logged

A user-journey walkthrough (`gavi411-user-journey-walkthrough.md`, full
output preserved in repo root) found 17 candidate gaps; Gavi's review
rejected 12 of them as a category error — **"ticket is Open, feature isn't
built yet" is not a gap on a project that isn't half-built**, it's just the
backlog. See `gavi411-brain.md` decision #71 for the corrected definition
of what counts as a real finding going forward (must cite either a current
blocker on in-progress work, or a genuine status/reality mismatch). Decision
#70 covers the specific mechanism that caused one real mismatch: "Reconciled"
has no Cancelled/Won't-Fix sibling, so a ticket whose *original premise* gets
corrected mid-life can end up Reconciled without its *actual* (pivoted)
remaining scope ever being checked — this is what happened to G411-71.

**4 real items actioned this session** (all committed, `5a50a4b`):
- `prisma/schema.prisma`: `Request.updatedAt` and `User.updatedAt` were
  both missing `@updatedAt` — fixed, migrated live (`20260827_add_updated_at_directive`).
- G411-71: comment added pointing to G411-81 (its real remaining scope),
  not reopened.
- G411-69 (profile completion): bumped to Priority: High — every signed-in
  friend today carries a permanent fake `phoneNumber: "pending-<clerkId>"`.
- G411-45 (credit schema+display): description updated to explicitly
  require granting the correct initial tiered balance on user creation —
  currently every new user gets `creditBalance: 0` with no grant mechanism,
  blocking a real new user's very first request.

**Nothing else from that walkthrough needs action** — the other 13 items
were withdrawn as non-gaps or already correctly tracked as Open.

---

## Next steps, in order

1. **Start here on a fresh session**: G411-28 stage 1 — keypair gen + ECDH
   + AES-GCM message/image encryption, in the `agent-e2e` worktree
   (resync it against `main` first).
2. Report back to Gavi, then move to G411-41 (`agent-backend` worktree).
3. Report back, then G411-81 (same worktree/role).
4. Report back, then return to G411-28 for escrow/CSV export + admin
   search index + device-linking.
5. Each stage gets its own Sibling review, Jira transitions, and a
   HANDOFF.md update — don't batch these to the end of the whole pass.

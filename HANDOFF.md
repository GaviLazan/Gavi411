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

## Where this session left off (2026-09-01)

**Sync status**: primary + all 6 role worktrees clean, all at `5c9dc51`,
matching `origin/main`. No code changes this session — pure verification +
live DB work, no commits needed.

**G411-82 is now Reconciled** (Jira transitioned, Aegis comment posted).
This was the one open thread carried over from last session's handoff:

- Restarted Prisma Studio (`agent-e2e` worktree, port 5555) and confirmed
  dev servers (client 5173, server 3000) were still live.
- Got a second real signed-in party via a real invite link (you generated
  it from the admin UI) — `g411_second_party+clerk_test@gmail.com`,
  password `2ndPartyAccount`, Clerk test-mode account (OTP always
  `424242`). Playwright automation hit a Cloudflare bot-check on repeat
  signup attempts (expected, not a bug — stopped scripting past it) —
  you completed that one signup manually.
- Seeded a throwaway request directly in the DB (id 22, since the intake
  wizard is multi-step and automating it wasn't worth it for a one-off
  check) and drove a real two-way message exchange: second-party sent via
  Playwright (using a persistent browser profile so its IndexedDB/private
  key survived across script runs), admin (you) replied live in your own
  Firefox session.
- **Verified directly in Neon**: every message row round-tripped as real
  `{iv, ciphertext}` AES-GCM ciphertext, `encrypted: true`, no plaintext
  anywhere. Confirmed `POST/GET /:id/messages` never touches keys/crypto
  server-side — it's a pure pass-through, so encryption is genuinely
  client-side E2E. Confirmed a device with no local key fails closed
  (blocks send, shows "[Unable to decrypt this message]") instead of
  leaking plaintext or crashing.
- **One real point of confusion during the check, worth remembering**:
  each fresh Playwright browser profile (or your own browser, if it never
  ran that account's keygen) has empty IndexedDB and looks like a "new
  device" to the app — it can't decrypt anything encrypted to a different
  device's key, including messages that account itself sent from another
  browser. This isn't a bug; it's the same real gap G411-83 already
  tracks (no cross-device key sync/recovery yet). Confirmed live when you
  opened the second-party account in your own Firefox and saw "Unable to
  decrypt" even on its own latest message — that browser had never
  generated a key for that account.
- You confirmed Reconciled explicitly; Jira transitioned Landed →
  Reconciled (transition id 3), Aegis Falsifier/Evidence write-up posted
  as a Jira comment on G411-82.

**Cleanup done after the check, per your explicit request**:
- Deleted the stray `pr34-wt` git worktree (leftover from PR #34's
  review, no longer needed).
- Deleted all test/throwaway `Message`, `Request`, `Note`, and
  `CreditTransaction` rows from the real Neon DB (20 messages, 15
  requests, 14 credit transactions).
- Deleted 8 test/throwaway `User` accounts (escrow test, `gavers`,
  `gavi.lazan@gmail.com` invite-test, `gavi.lazan+clerk_test`, `work`,
  `lastone`, `testing`, and a stray `falsifier-flights-...` row with a
  null email that a `notIn` filter silently missed on the first pass —
  SQL `NOT IN` doesn't match `NULL`, caught and cleaned up separately).
  Their used `PendingInvite` tokens were reset to unused (`usedByUserId`/
  `usedAt` cleared) rather than deleted, to keep the invite audit trail.
- **Kept**: Gavi's admin account, Allysa Jeret, and the new
  `g411_second_party+clerk_test@gmail.com` test account (per your
  explicit instruction) — these 3 are the only `User` rows left in the
  real DB. Zero `Request`/`Message`/`Note`/`CreditTransaction` rows
  remain.
- Prisma Studio (port 5555) and the dev servers (client 5173, server
  3000) were left running out of `Gavi411-agent-e2e` — check `lsof -i
  :3000 -i :5173 -i :5555` before assuming they're still up next session.

### Still true from before, unchanged
- **G411-83** (key-recovery gap: admin's own key has no escrow, no way to
  nudge/help other keyless accounts) — still Open, not started. Real
  design work needed at pickup for the admin self-escrow mechanism; the
  keyless-user-nudge UI is more straightforward. This session's live
  testing reconfirmed the gap is real (see above) but didn't change its
  scope or start it.
- **G411-28 itself**: stays Landed, not Reconciled — its remaining real
  scope (client-side search index, admin-approved device-linking) is
  still unbuilt, now unblocked by G411-82 but not started. G411-28's own
  Reconciled shouldn't happen until that scope is actually built or
  explicitly re-scoped.
- **Deliverable still owed**: a 2-page PDF/slide deck explaining how the
  E2E encryption works in practice, once the full G411-28 pass is done —
  hand over at the end, not per-stage (asked 2026-08-30).
- Known rough edges from prior sessions (branch-protection blocking
  admin merges on PRs, spend-limit-can-look-like-a-stuck-agent, role
  worktree checkout-vs-merge quirk) are unchanged — see git history of
  this file if you need the details again, not reproduced here since
  nothing new happened with them this session.

### Next steps, in order
1. **G411-83** — pick a real design for the admin self-escrow mechanism
   (no existing invite/passphrase to hook into, since the admin account
   predates invites) and build the keyless-user nudge UI. Not started.
2. **G411-28's remaining scope** (search index, device-linking) — now
   unblocked by G411-82's Reconciled, not started.
3. **The E2E encryption explainer deck** — owed once G411-28's full scope
   lands, not before.

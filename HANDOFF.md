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

## Where this session left off (2026-08-31, context running full)

**Sync status**: primary + all 6 role worktrees clean, all at `fcdd815`,
matching `origin/main`. Nothing uncommitted, nothing to resync.

**G411-28's 4-stage E2E pass — 3 of 4 stages done, stage 4 done in a
narrowed form:**
- Stage 1 (crypto core), stage 2 (invite tokens/G411-41), stage 3
  (invite-gating/G411-81) — all Landed, all from a prior session
  (2026-08-30).
- Stage 4 (originally: escrow + search index + device-linking) —
  **narrowed to escrow-only this session**. Search index and device-
  linking need real encrypted messages to operate on, which didn't exist
  until the wiring below landed — building them against synthetic data
  would've been infrastructure theater. Escrow (PR #33) landed clean:
  passphrase generation, CSV export (fixed twice from real live-testing —
  1Password doesn't auto-map columns at all, it's fully manual, and a
  header row was being imported as a bogus second item), recovery flow.
- **G411-82** (new ticket, filed this session): the real gap G411-28
  never covered — wiring the actual live `Message` thread
  (`POST/GET /:id/messages`, `MessageThread.jsx`, `RequestDetail.jsx`,
  previously 100% plaintext) to the crypto core from stages 1-3. **Landed
  this session, PR #34**, after 3 rounds of Sibling review (7 angles each,
  one round included a critical regression *I* introduced fixing a prior
  round's finding — caught by the next review pass, fixed). 135/135
  Vitest passing. Full review conversation posted as real PR comments
  (new standing rule, see below) — read PR #34's comment history directly
  for the blow-by-blow if picking this back up, it's genuinely detailed.

**G411-82 Reconciled verification — in progress, not finished. This is
exactly where to pick back up.** Started the real Falsifier check (two
signed-in parties exchange a message, confirm real ciphertext in Neon,
both sides decrypt correctly) and found a real, live problem before
finishing it:

- **Every `User` row in the real DB had `publicKey: null`**, including
  Gavi's own admin account — nobody could actually send an encrypted
  message yet. Root cause: all these accounts predate G411-82's
  keygen-at-signup wiring.
- Gavi used `InviteAdmin.jsx`'s "Generate my encryption key" button live
  to give his own admin account a real key — **confirmed working,
  `publicKey` is now real in the DB.**
- **But that surfaced a second, more serious problem, live**: that button
  calls the plain (non-escrow) keygen path — there's no `PendingInvite`
  token for an already-existing admin account to escrow against. So
  Gavi's admin key now exists with **zero recovery path** — if he loses
  his device, every encrypted message he's party to is gone permanently.
  This is a real, live risk on the actual account today.
- Also found live: a real pre-existing friend account (Gavi's cousin,
  shown the app before G411-82 fully landed) is stuck the same way —
  keyless, no self-service fix, and architecturally **admin can't
  generate a key for someone else** (Web Crypto's `generateKeypair()` is
  client-side by design, private key never leaves the browser that
  generates it — only the account's own signed-in session can fix it).
- **Filed G411-83** (parented under Messaging epic, Open) to own this —
  scope per Gavi's direction: admin panel gets a view of keyless users
  and can flag/nudge them; any signed-in user with no key sees an
  in-app prompt to generate one in their own session; admin's own
  escrow-backup gap needs a real fix (self-issued backup mechanism, not
  tied to an invite token — exact design not yet decided, do that at
  pickup). **Not blocking G411-82's Reconciled** — G411-82's own scope
  (wiring live send/receive to real encryption) is independently
  complete and correct; this is a separate, real gap in account/key
  lifecycle.
- Logged as `gavi411-brain.md` decision #86.

**What's actually still needed to finish G411-82's Reconciled check**:
now that Gavi's admin account has a real key, the live two-party
Falsifier can actually run — need a **second** real signed-in identity
with a key (a fresh signup through a real invite link would get one
automatically via the code this session built). Was about to set this up
with Playwright (a real devDependency, `client/package.json`) driving a
fresh signup through a real invite when the context ran full. Prisma
Studio was running on `localhost:5555` against the `agent-e2e` worktree's
DB to inspect real rows after — **that process was killed** before this
handoff, restart it (`cd Gavi411-agent-e2e && npx prisma studio --port
5555 --browser none`) if picking this back up. Dev servers (client
`5173`, server `3000`) were running out of `Gavi411-agent-e2e` — check
`lsof -i :3000 -i :5173` before assuming they're still up; may need a
restart too.

**G411-28 itself**: stays Landed, not Reconciled — real scope (search
index, device-linking) is still unbuilt underneath it, now unblocked by
G411-82 but not started. G411-28's own Reconciled shouldn't happen until
that scope is actually built or explicitly re-scoped.

### New standing rules from this session, both in `CLAUDE.md` now
- **Post the Sibling review + fix conversation as real PR comments** —
  every review pass and every fix pass gets its own `gh pr comment`, not
  just a chat summary. First applied on PR #34 (including backfilling
  its earlier rounds).
- **Log a real decision to `gavi411-brain.md` the moment it's made**, not
  deferred to a ticket's own wrap-up — the wrap-up checklist's brain.md
  check is the backstop, not the primary mechanism. This was added
  specifically because several real decisions from a 2026-08-30 session
  (G411-81's invite-gating mechanism, a two-phase-claim pattern, a
  stale-Sibling-review lesson) sat only in HANDOFF.md for over a day and
  were never promoted — backfilled as decisions #77-80 once caught.

### Known rough edges, still true
- **`main`'s branch protection has now blocked 2 PRs (#33, #34)** despite
  the merging account being an admin with `enforce_admins: false` (should
  be exempt). Root cause still not found. Gavi's standing call: bypass
  via `gh pr merge --merge --admin`, always ask first, never assume.
  Logged as brain.md decision #81 — worth someone actually digging into
  repo settings if a third PR hits this.
- **Hitting the account's monthly spend limit mid-session can cause a
  background review/agent loop to look stuck** (agents silently
  fail/resume into the same cycle instead of surfacing the real error).
  If a review loop looks stuck for many minutes with zero forward
  progress, check for a spend-limit error before assuming it's just
  noisy plumbing.
- **A role worktree can't `git checkout <branch>` if the primary
  worktree already holds that branch** (git's one-worktree-per-branch
  rule) — `git merge origin/main --ff-only` on the worktree's own current
  branch achieves the same sync without the checkout.
- `npx prisma migrate status` / similar can get blocked once by Claude
  Code's own permission classifier, unrelated to the command itself —
  retry, or check from a different worktree.

### Next steps, in order
1. **Finish G411-82's live Reconciled verification** — get a second real
   signed-in party with a key (Playwright through a real invite signup,
   or manually), exchange messages, verify real ciphertext in Neon via
   Prisma Studio, confirm both sides decrypt correctly. Then transition
   G411-82 Reviewing→Landed(already there)→Reconciled with Gavi's
   explicit confirm.
2. **G411-83** (key-recovery gap) — real design work needed at pickup for
   the admin self-escrow mechanism; the keyless-user-nudge UI is more
   straightforward. Not started.
3. **G411-28's remaining scope** (search index, device-linking) — now
   unblocked by G411-82, not started. G411-28 stays Landed until this is
   done or explicitly re-scoped.
4. **Deliverable still owed**: a 2-page PDF/slide deck explaining how the
   E2E encryption works in practice, once the full G411-28 pass is done
   — Gavi asked for this 2026-08-30, hand over at the end, not per-stage.

### Prerequisites already resolved, don't re-derive
- **G411-76** (Clerk↔Prisma sync + admin role) — Reconciled. Real admin
  identity exists (`user_3I3duQkdEIz1mzbOC0iumup3AzM` = Gavi, promoted via
  `scripts/promote-admin.js`), name/email sync from Clerk works correctly.
- **G411-79** (video/doc attachment architecture) — investigation resolved
  (separate chat), written into the ticket. Unrelated to current work.
- **DESIGN.md** — Gavi's own WIP on `docs/design-product-md-refresh`, not
  yet merged into `main`, not touched by any of this. His branch to merge
  when ready.

### Worktree/role reference
- 7 worktrees: primary (`Gavi411`) + 6 roles (`Gavi411-agent-backend`,
  `-cicd`, `-design`, `-e2e`, `-frontend`, `-test`).
- `agent-e2e` is the role for E2E crypto work — currently on its
  `agent-e2e/base` idle branch, synced. Git identity already configured
  per-worktree (`git config --worktree`), no need to re-run `git-as-*`
  unless starting genuinely fresh.
- `.env` / `client/.env` in every role worktree are **symlinks** back to
  the primary worktree's real files, not copies — if a role worktree's
  dev server throws a missing-env-var error, check for a missing symlink
  (`ln -s`, never `cp`) before assuming a code bug. Confirmed this was
  the actual cause of a real white-page failure earlier this session.

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

## Where this session left off (2026-09-02) — G411-86 (plaintext reversion) Landed, live-verified. E2E fully paused per decision #98.

**Read `gavi411-e2e-encryption-plan.md` §8 for full detail before touching
anything messaging/encryption-related.** One-line summary: `E2E_ENABLED =
false` (client + server twin configs) gates every real encrypt/decrypt/
device-link call site off — sendMessage() always sends plaintext, decrypt
still works for pre-pause encrypted rows on a device/origin that holds
the right key. Crypto/escrow/device-linking modules untouched on disk —
decoupled, not deleted, per Gavi's explicit correction on scope.

PR #38 (agent-e2e/G411-86-plaintext-revert) merged, commit `a584353`.
Sibling review found and fixed one real bug same round (decrypt effect
would've broken pre-pause encrypted rows — fixed via a `hasEncrypted`
guard). Live click-through verified on both localhost and Vercel: new
message stored `encrypted: false` plaintext; old encrypted message still
decrypts correctly on the origin holding its key.

### A real process gap found and fixed this session
Jira's Aegis fields (Claim/Falsifier/Evidence/Scope/Role/Owner-
Authorship/Reviewer-type) are real custom fields on the Task screen
(`customfield_10073`-`10079`), not description prose — this had already
been corrected once before and got rediscovered live a second time on
G411-86 because the field-ID mapping was never written down anywhere
durable. Fixed: `gavi411-jira-aegis-template.md` now has the real
field-ID table, single-select `{"id": ...}` write format, the 255-char
cap on Evidence bar met, and a warning against concluding "field doesn't
exist" from a `customfield_*: null` dump. PR #39, merged.

### Known, accepted gap (not a regression) — see plan doc §8 for full detail
With device-linking/escrow recovery UI gated off along with the rest of
E2E, an old encrypted message is unreadable on any device/browser origin
that doesn't already hold the original private key — no in-app recovery
path today. Gavi confirmed this is fine: the affected message set is
small and fixed (nothing new joins it, since all new messages are
plaintext going forward).

### Also this session — a real false alarm, worth remembering
Local dev ("couldn't load requests," "something went wrong matching your
request") turned out to be the backend simply not running — `npm run
dev` from the worktree root works correctly, no env/symlink problem.
Don't assume a missing `server/.env` or broken symlink again without
first checking whether the backend process is actually up
(`curl localhost:3000/api/health`).

### Real state, right now
Primary worktree (`Gavi411`) and all 6 role worktrees (`Gavi411-agent-
backend/cicd/design/e2e/frontend/test`) fully synced to `origin/main` at
`b7d0318` as of this session's full sync check — confirmed via `git
status --short` (empty everywhere) and matching `git log --oneline -1`.
Role worktrees are sitting on their own old branch names (not literally
checked out to `main`, since only one worktree can hold that branch name
at a time) but their branch content is byte-identical to `origin/main` —
0 unique commits either direction, confirmed.

### What's next, concretely
1. **Log this session's decisions to `gavi411-brain.md`** — not yet done
   as of this HANDOFF.md write, do it as part of this session's wrap-up
   if not already done by the time this is read.
2. E2E is paused. Resume normal epic-order work on the rest of the
   product (Lifecycle, Cockpit, Credits, Notifications) — the actual bulk
   of the course deliverable, per decision #98.
3. G411-86 needs an explicit Gavi confirm before Landed → Reconciled
   (hard-to-reverse-action rule) — not done automatically even after live
   verification.

### Other loose ends, unchanged from before
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- Memory note saved (not Jira): admin can currently open/message a
  Request with themself — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

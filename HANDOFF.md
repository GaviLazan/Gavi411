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

## Where this session left off (2026-09-02) — the wipe is DONE and verified. Plaintext-reversion is next, not yet started. Paused by Gavi's explicit call.

**Read `gavi411-e2e-encryption-plan.md` §1 and §4 for full detail before
touching anything messaging/encryption-related.** One-line summary: all
accounts were wiped (`scripts/wipe-users.js`, reviewable/dry-run-able),
admin re-signed up through a real self-issued invite, got a genuine
escrow backup for the first time, and a real message round-trip
(encrypt → send → decrypt → display) was confirmed working live. `role`
restored to `ADMIN` via `scripts/promote-admin.js`.

**Not yet done, explicitly paused**: reverting `sendMessage()` to always
send plaintext (the plan doc's §5). Encryption is still technically live
in the code. Gavi's explicit instruction: pick this up as its own next
step, don't touch the E2E/escrow-only architecture question (§2) at all
right now.

### Real correction from tonight, worth remembering
**Allysa Jeret is a real person — Gavi's cousin — not a test/throwaway
account.** She was mislabeled as one earlier this session before Gavi
corrected it directly. Her account was wiped along with everything else;
she needs a fresh invite + real signup to be re-added. Gavi may also
reset her Clerk identity separately (outside anything Claude can do, not
executed this session).

### A new standing rule, added live after a real near-miss
`CLAUDE.md`'s "How to work with Gavi" section now has: **trace real
consequences BEFORE presenting a plan, not after Gavi asks the natural
next question.** Real incident: proposed wiping admin's own `User` row
without first checking that `POST /api/invites` requires `requireAdmin`
— which would have permanently locked admin out of self-issuing an
invite if the wipe had happened first. Caught before it caused damage,
but only because Gavi asked "how do we self-issue an invite?" — it
should have been surfaced unprompted. Read the full rule before
proposing any plan that deletes/disables/reorders something — trace what
else reads/writes that state first.

### Also this session, unrelated, already done and confirmed
- **G411-85** filed — 4 real regressions in the (now-being-replaced)
  device-linking mechanism, found via live testing. Full detail in
  `gavi411-brain.md` decision #97 and the ticket itself.
- **A real production bug, fixed**: `CLOUDINARY_URL` was never set on
  Render — `render.yaml` now declares it + `VAPID_*`; Gavi added the
  real values and redeployed, confirmed fixed live.
- **G411-28 and G411-29** both Reconciled earlier this session — real,
  confirmed, unaffected by the later architecture reframe.

### Real state, right now
Primary worktree (`Gavi411`) on `main`, `fe28ed7`. `scripts/wipe-users.js`
and `scripts/promote-admin.js` both exist and were used successfully
tonight. Worktree sync across all 7 not re-verified since before
tonight's wipe — re-check at next session start, don't assume clean
(the wipe itself only touched the database, not any worktree files, so
this is a routine check, not an expected problem).

### What's next, concretely
1. **Confirm with Gavi that §5 (plaintext reversion) is still the right
   next step** before starting — this doc may be read by a fresh
   session, and Gavi's own priorities may have shifted.
2. Scope §5's actual code checklist for real, file by file, the way the
   wipe itself was traced (§5's list in the plan doc is still a guess,
   not yet verified against the real code the way §4 was before
   execution).
3. Do NOT touch the escrow-only/device-linking architecture question
   (§2) — explicitly out of scope right now per Gavi.
4. Once §5 lands: resume normal epic-order work on the rest of the
   product (Lifecycle, Cockpit, Credits, Notifications) — the actual
   bulk of the course deliverable, per decision #98.

### Other loose ends, unchanged from before
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- Memory note saved (not Jira): admin can currently open/message a
  Request with themself — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

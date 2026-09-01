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

## Where this session left off (2026-09-01) — PR #35 MERGED, G411-28 still open (search-index half not started)

**Status update (later same day, again):** Matan approved PR #35
("APPROVE WITH COMMENTS," two non-blocking nits) after the fix round
described below. Both nits were fixed anyway before merging
(`wrapMissingConversationKeys` now wraps via `Promise.all` instead of a
sequential loop; `GET /api/devices/my-status` now scopes by an optional
`?deviceId=` instead of always returning the account's most-recently-
created device row). **PR #35 is merged** — regular merge commit
`e47df21` on `main`, branch `agent-e2e/G411-28-device-linking` deleted
both locally and remotely. All 7 worktrees (primary + 6 role) are synced
to `e47df21`, confirmed via a full `git status --short`/`git log -1`
sweep — every one clean, every one at the same commit.

**Real process incident found and fixed mid-session**: right before
Matan's approval was checked, `main` had accidentally gained an entire
unreviewed, pre-Sibling-review copy of the device-linking feature via a
mislabeled commit (`302f463`, titled as a docs-only commit but actually
committing ~840 lines of feature code via a broad `git add` in a dirty
working tree) — this caused real merge conflicts on PR #35. Resolved by
merging `main` into the PR branch and taking PR #35's reviewed version on
every conflicting file. Full root-cause writeup and the new standing
git-hygiene rule are in `gavi411-brain.md` decision #91 and `CLAUDE.md`'s
Required workflow rule 4 (verify `git status`/`git diff --cached --stat`
matches the intended file list before every commit).

**G411-28 is NOT Reconciled, NOT Landed yet** — device-linking is only
part of its scope (see the ticket's own summary: keypair gen, ECDH,
AES-GCM, admin client-side search index, escrow+CSV, device-linking).
The search-index half was never started this session. Ticket stays at
**Implementing**. Don't transition it further until that remaining scope
is actually built or a scope-split decision is made with Gavi.

**What's next, concretely:** either continue G411-28 (search-index half)
or pick a different ticket — needs an explicit pickup decision with Gavi,
same as any session start.

The original fix-plan section below is kept for reference (what was
actually built across both PR #35 review rounds), not as a to-do list
anymore.

### Where things stand right now, precisely
- **PR #35**: branch `agent-e2e/G411-28-device-linking`, currently at
  commit `ac11a13` (worktree `Gavi411-agent-e2e`, clean, checked out on
  that branch). This commit already fixed the FIRST round of Sibling
  review findings (the cross-tenant key leak, `requireAdmin` middleware,
  per-key unwrap isolation, etc. — see that commit message for the full
  list, already merged into this branch, don't redo any of it).
- **Matan then did a SECOND, independent review round** (as a real human,
  not an agent) and requested changes — 2 High-severity bugs, 1 Medium,
  some nits. His full review is PR #35's own comment thread on GitHub —
  read it directly (`gh pr view 35 --comments`) for his exact wording,
  file/line citations, and suggested fixes. Do not skip reading his
  actual comment — this summary is not a substitute for it.
- **Gavi and I then went through the actual mechanism together**, live,
  using a flowchart artifact I built
  (https://claude.ai/code/artifact/8afe8f89-36ec-4975-9f36-505bc942e7c6)
  to make sure the fix direction was actually understood, not just
  agreed to reflexively. The fix plan below is the result of that
  conversation — it is Gavi's own considered decision, not just my
  suggestion.
- **The fix plan is posted in two places already** — do not re-post it,
  just implement it:
  1. Jira: a comment on G411-28
     (https://gavi.atlassian.net/browse/G411-28) with the full plan.
  2. GitHub: a comment on PR #35 itself, tagging @MatanLazimi, saying
     "implementing now, will push and re-request review once done."
     **That comment is a real promise to Matan that hasn't been kept
     yet** — he's expecting a follow-up push, not silence.
- **A new, separate Jira ticket was filed**: G411-84
  (https://gavi.atlassian.net/browse/G411-84), parented under Messaging
  (G411-3). This is a DEFERRED, FUTURE idea (push-notification-driven
  background key-wrap so admin's PWA self-heals even while asleep) — it
  is explicitly NOT part of what needs to be built to unblock PR #35.
  Do not confuse the two. G411-28's fix (below) stands on its own and
  does not depend on G411-84 ever being built.

### The exact fix to implement (both halves — this is not optional/either-or)

**Fix 1 — Matan's High finding #1: new conversations after device
approval silently corrupt across devices.**

Root cause (confirmed in the flowchart, and in the actual code): in
`client/src/lib/conversationCrypto.js`, `getConversationKey(requestId)`
checks `linkedConversationKeys` (a Map seeded ONCE, at device-approval
time, from `deviceLinking.js`'s `loadLinkedConversationKeys()`) — if the
request isn't in that Map (because it didn't exist yet when the device
was approved), it falls through to the normal ECDH derivation path
(`deriveSharedKey(privateKey, otherPublicKey)`), using the LINKED
DEVICE'S OWN keypair — which the other party never received/exchanged
keys with at all. This produces a real, non-null, but WRONG shared key.
No error surfaces anywhere; messages just permanently render
`[Unable to decrypt this message]` (see `RequestDetail.jsx`'s decrypt
effect around line 132-160, the `catch` block there).

Two changes needed together, per Gavi's explicit decision — do not do
only one:

- **(b) Fail loud instead of silently wrong.** In
  `conversationCrypto.js`'s `getConversationKey`, the fallback ECDH
  derivation path needs to know "is this device a LINKED device with no
  seeded key for this request" and return `null` in that case instead of
  deriving a value. How to detect "this device is linked": check
  `loadDeviceId()` from `keyStore.js` — if it resolves to a non-null
  value AND `requestId` is not in `linkedConversationKeys`, this is a
  linked device missing a wrap for this specific request → return `null`
  rather than falling through to `deriveSharedKey`. (A device with NO
  `deviceId` at all — i.e. never linked, this IS its own primary
  keypair — should still use the normal ECDH path exactly as today; only
  skip the ECDH fallback for a device that IS registered as linked via
  `loadDeviceId()` but doesn't have this particular request's key yet.)
  This alone makes the existing `needsKeypair`/error-banner machinery in
  `RequestDetail.jsx` fire correctly instead of silently succeeding with
  a wrong key — but it does NOT restore access. That's fix (a):

- **(a) Self-healing sweep — re-run the wrap step for missing
  conversations.** Something needs to re-wrap a linked device's newly-
  created requests periodically. Gavi's explicit call on trigger cadence
  (do not substitute a different trigger without asking): **NOT** "on
  Clerk sign-in" — a PWA install effectively never re-triggers a real
  sign-in event (people don't sign out of an installed app), so that
  event might fire once, ever, per device. Instead:
  1. **On every app load/mount** where admin is signed in — this should
     live alongside the existing `useEffect` in `client/src/App.jsx`
     (around line 102-105) that already calls
     `loadLinkedConversationKeys().then(seedLinkedConversationKeys)` on
     `[isSignedIn]` — but that effect is the LINKED DEVICE's own side
     (loading ITS keys). What's needed here is the ADMIN side: on load,
     admin's browser should check every Request it's party to, find any
     APPROVED Device that's missing a `ConversationDeviceKey` row for
     that Request, and wrap+POST one. This needs a new server endpoint
     (or extending an existing one) to tell admin's browser "which
     (device, request) pairs are missing a wrap" — that doesn't exist
     yet, needs designing at pickup. A reasonable shape: `GET
     /api/devices/missing-wraps` (admin-only) returning
     `[{ deviceId, requestId, devicePublicKey }, ...]` for every
     APPROVED device + Request-the-device-owner-owns pair with no
     existing `ConversationDeviceKey` row (a `LEFT JOIN`/`NOT EXISTS`
     query in Prisma — `findMany` with a `NOT: { conversationKeys: { some: { requestId } } }`
     filter, or similar — needs checking against Prisma's actual query
     capabilities at pickup, not assumed). Admin's browser then calls the
     EXISTING wrap logic (`wrapConversationKey` in `crypto.js`,
     `approveDevice`'s per-request wrap loop in `deviceLinking.js` is
     close but was written assuming a single fresh approval — likely
     needs a small refactor to be reusable for "wrap these specific
     (device, request) pairs" rather than "wrap every request for this
     one newly-approved device"). POSTs results to a route that persists
     them (extend `/api/devices/:id/approve`'s persistence logic, or add
     a new one — `POST /api/devices/:id/wrap-additional` is a reasonable
     name, needs designing at pickup, don't just reuse `/approve` as-is
     since that route also flips status to APPROVED, which shouldn't
     re-fire).
  2. **Also on admin opening a specific Request's detail page** — same
     mechanism, scoped to just that one Request, as a second trigger
     point so a long admin session (tab left open for days, no reload)
     still eventually self-heals for whichever conversations admin
     actually looks at. This is a smaller, more contained version of the
     same missing-wraps check, scoped by `requestId`.

**Fix 2 — Matan's High finding #2: recovery button can destroy a working
key.**

In `RequestDetail.jsx`, `needsKeypair` (state declared line 71, comment
right above it) is set to `true` whenever `getConversationKey` returns
`null` — but that happens for TWO different, unrelated reasons (see
`conversationCrypto.js` lines ~64-70): (i) `loadPrivateKey()` returns
`null` — THIS device genuinely has no key at all, or (ii) the fetch to
`/public-keys` returns `{ other: null }` — the OTHER PARTY has no public
key yet. The UI shows the same "request access to your existing
messages" button (calls `requestDeviceLink()` in `deviceLinking.js`,
which UNCONDITIONALLY calls `generateKeypair()` +
`savePrivateKey(...)`, overwriting whatever key IndexedDB already held)
regardless of which cause is real. Under cause (ii), clicking it
destroys a perfectly good, working key for no benefit — the actual
problem (other party has no key) is untouched by it.

Fix: `getConversationKey` needs to return enough information to
distinguish the two causes (e.g. throw/return a distinguishable
sentinel, or have two separate null-returning branches the caller can
tell apart — exact mechanism to decide at pickup, several reasonable
options exist, don't just guess one). `RequestDetail.jsx`'s
`needsKeypair` logic (or a new, more specific flag) should then only
offer/enable the destructive "request access" button for cause (i).
Under cause (ii), the UI should show something else instead — the
send-error text already says "Your device isn't set up for encrypted
messaging yet (or the other side isn't)" (line ~218-220 in the send
handler) — under cause (ii) specifically, this should probably become a
non-actionable message like "waiting on the other side to set up
encryption" with NO button, rather than offering a destructive fix for
a problem that isn't on this device.

**Matan's Medium finding (admin's own second device silently gets zero
keys)** — not discussed as deeply live, but Matan's own suggested fix is
reasonable and can likely be implemented directly at pickup: either hide
the device-linking self-service flow entirely for admin accounts (admin
recovery is G411-83's job, a different mechanism, see decision #87), or
have `approveDevice`/the server surface an explicit warning when the
resulting wrapped-key count is zero for a reason OTHER than "friend has
no key yet" (i.e., zero because `requestIds` itself was empty, which is
what happens for an admin — `device.userId` never matches a `Request.userId`
since admin never owns a Request).

**Matan's nits** (nice to fix while in the file, not blocking):
- `server/routes/devices.js`'s error message has a stray escaped
  apostrophe (`owner\'s`) inside a single-quoted string — switch to
  double quotes.
- `InviteAdmin.jsx`'s skipped-requests error message renders "request #
  5, 12" (singular "request" for a plural list) — minor copy fix,
  everything on this surface is explicitly placeholder copy anyway.

### After implementing: the required process, don't skip any step
1. **Tests** — write real tests for the new logic (both the `getConversationKey`
   cause-distinction and the sweep mechanism). Matan's review explicitly
   called out "no tests exist for `deviceLinking.js` or the new
   `conversationCrypto.js` path — exactly where the two High findings
   live" as its own Medium finding. Don't repeat that gap.
2. **Push to the same branch** (`agent-e2e/G411-28-device-linking`) —
   don't open a new PR, this is a continuation of #35.
3. **Comment on PR #35 again** (via `gh pr comment 35`, NEVER the GitHub
   MCP connector — see decision #90/`gavi411-commit-convention.md`,
   explaining what was fixed, referencing Matan's specific findings by
   name so he can see his own feedback was addressed point by point.
4. **Explicitly tag/notify Matan that it's ready for re-review** — the
   whole point of sending this to him was a real second reviewer; don't
   self-merge once tests pass, wait for his actual re-review.
5. Only after Matan approves: normal merge process (regular merge
   commit, never squash — `gavi411-merge-strategy-regular-not-squash.md`
   memory; delete the branch after merge per
   `gavi411-commit-convention.md`).
6. Once merged: G411-28 itself likely STILL isn't done — the search-index
   half of its remaining scope was never started this session (device-
   linking was the only piece worked on). Don't close/Reconcile G411-28
   thinking device-linking alone completes it.

### Standing rules from this session, now documented project-wide
- **Sibling review and any code-fixing are separate steps — review
  findings get posted as comments THE MOMENT the review finishes, BEFORE
  any fix is applied**, not batched together with the fix afterward.
  This was a real mistake this session (a full review ran, found real
  issues, and I went straight to fixing without posting first) — Gavi
  caught it and corrected it live. Do not repeat this ordering mistake.
- **Always use the `gh` CLI for GitHub operations — never the `github`
  MCP connector, full stop, not just when it happens to be down.**
  Logged as decision #90 in `gavi411-brain.md`, documented in
  `gavi411-commit-convention.md`, and saved as a standing memory
  (`use-gh-not-github-mcp.md`). Do not even try the MCP first "to
  check" — go straight to `gh`.
- **When Gavi sets up a real external human reviewer (Matan) for a PR,
  do NOT also run a full agentic Sibling review on it first** unless
  explicitly told to — that was also a real mistake this session (I ran
  a Sibling review immediately after Gavi said he wanted Matan to review
  it, without connecting the two instructions). If Gavi's intent for a
  given PR is a genuine outside-human review, respect that as the actual
  review mechanism for that PR, don't pre-empt it. This session did end
  up running one anyway after Gavi said "just fix it, you already wasted
  my tokens" — but that was a recovery from an already-made mistake, not
  the right sequence, and it did partially compromise the value of
  Matan's from-scratch review (he was reviewing already-touched code,
  not the true first draft).

### Other current state (unrelated to PR #35, unchanged from before)
- **G411-83** (key-recovery bootstrap patch) — still Open, not started.
- **The E2E encryption explainer deck** — still owed, not delivered,
  waiting on G411-28's full scope (including search index) to land.
- Primary + 6 role worktrees: all synced at `9bbd224` on `main` EXCEPT
  `Gavi411-agent-e2e`, which is correctly on its own PR branch
  (`agent-e2e/G411-28-device-linking` at `ac11a13`) and will resync once
  PR #35 merges — don't try to force-sync it before then.
- Clerk + Postgres `User` tables were both cleaned this session to just
  3-4 real accounts (Gavi/admin, Allysa, the E2E test second-party
  account, plus a deliberately-kept `gavi.lazan@gmail.com` "Invite Test"
  account in Clerk only) — see git history of this file if the exact
  list matters again.

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

## Where this session left off (2026-09-01, later still) — G411-85 filed: real E2E messaging regressions found live-testing. This supersedes the earlier G411-83→84→79 queue plan.

**Read this before picking anything up.** G411-28 and G411-29 both landed
and Reconciled earlier this session (full detail below), but live
testing immediately after found real, confirmed bugs in the E2E
messaging/device-linking mechanism those tickets shipped. **G411-85 is
now the most urgent item in the Messaging epic** — more urgent than the
previously-agreed G411-83 → G411-84 → G411-79 order, since G411-83/84
both build directly on the same device-linking mechanism G411-85 found
broken. Confirm with Gavi whether G411-85 should be picked up before
G411-83, but treat that as the live default unless told otherwise —
building more on top of a confirmed-broken mechanism without fixing it
first is the wrong order.

### G411-85 — 4 real, confirmed findings (filed, Open, parented under G411-3)
All confirmed against real DB timestamps and actual on-screen behavior
during a live test session (admin phone + a real test-account PC), not
theorized:

- **(A)** A device-linked browser can read messages after a page refresh,
  but the send path (`sendMessage()` in `RequestDetail.jsx`) doesn't
  recognize it as usable and still blocks with the generate/request
  prompt. Read path and send path disagree about whether the device is
  ready.
- **(B)** "Generate my encryption key" is destructive and **unrecoverable
  through the UI** once a browser has ever called `requestDeviceLink()` —
  `getConversationKey()` (`client/src/lib/conversationCrypto.js`)
  permanently short-circuits to linked-device-only mode via a
  `deviceId != null` check, never falling back to direct ECDH again, and
  nothing anywhere clears the saved `deviceId` (`keyStore.js`'s
  `saveDeviceId` is write-only, confirmed via grep). Real repro: a
  working, readable message became unreadable the moment the test user
  clicked "generate" after already being device-linked.
- **(C)** Images are never encrypted — contradicts `gavi411-brain.md`
  decision #47 and the PRD's explicit line ("Images get the same
  treatment — encrypt before upload, decrypt on display"). This was a
  scope cut made silently during G411-82's build, justified only in a
  code comment, never surfaced to Gavi for sign-off.
- **(D)** The generate/request-key recovery flow is only reachable as a
  side effect of a failed send attempt — not a standing, visible state
  when a user opens a thread they can't yet decrypt.

**Real damage from this session's testing** (test data only, request
#23): message id 22 (pre-dates any device link) is permanently
unreadable by design — expected, not fixable retroactively. Message id
24 was readable, then made unreadable again by finding (B) — this WOULD
be equally destructive against real friend data, with no UI recovery
path today.

**G411-82 (Reconciled) has a real status/reality mismatch** — flagged via
a comment on that ticket, not unilaterally reopened (Gavi's call per the
hard-to-reverse-action rule). Its Falsifier text implies full encryption
coverage; finding (C) shows that's false for images.

### G411-29 (Web Push infra) — Reconciled, merged as PR #37 (`42c2501`)
Full Sibling review (10 findings, 7 fixed — VAPID-fail-loud, stale-sub
cleanup logging, type validation, guarded JSON parse, env-var guards,
res.ok checks + rollback). Top finding (Web Push for admin vs. CLAUDE.md's
old phrasing) resolved as a doc correction (decision #93), not code —
Web Push is the primary channel for everyone, Telegram secondary for
Gavi. Merged via `--admin` (Gavi's explicit per-PR call to bypass
GitHub's required-review gate). Aegis fields written in the real Jira
custom fields this time (Falsifier/Evidence-required/Evidence-bar-met/
Role/Reviewer-type) — a real gap on older tickets that's still
unaudited, not urgent.

### G411-28 (target E2E) — Reconciled, full stated scope shipped
Device-linking (PR #35) + admin search index (PR #36) both merged, both
Matan-reviewed. Confirmed live via real git history (merge commits +
source files present), not just trusting the Jira comment. **But**:
G411-85's findings above show real correctness gaps in what actually
shipped here — Reconciled being accurate for "did the described pieces
land" doesn't mean the mechanism is bug-free; see G411-85.

### A real production bug, found and fixed this session: image-send never worked in production
`CLOUDINARY_URL` was never declared in `render.yaml`, so Render's
dashboard never prompted for it and it was never set on the live
service — confirmed via Render's own logs (`Error: Must supply api_key`
from Cloudinary's SDK). Pre-dates this session, not a G411-28/29
regression. Same gap found for the three `VAPID_*` vars (added this
session, same oversight, caught same-day). `render.yaml` now declares
all four (commit `e006295`); Gavi manually added the real values in
Render's dashboard and redeployed — **confirmed fixed live** (image send
succeeded after redeploy, before findings A-D above surfaced during the
same test).

**Standing gap, not yet closed**: nothing currently catches
`render.yaml`/`.env.example` drift automatically. This is the second
time a required env var was added to `.env.example` without a matching
`render.yaml` entry. Worth a lightweight check before/at deploy-affecting
tickets, though no such check exists yet.

### Queue order — G411-85 changes the plan
Earlier this session, explicit order was: G411-83, then G411-84, then
G411-79 (ahead of normal epic/key order — decision #95, a one-time
override, not a standing policy). **G411-85's findings likely change
this** — G411-83/84 both build on the same device-linking mechanism
G411-85 found broken (finding B in particular: G411-83's whole point is
key-recovery bootstrap, which is exactly the mechanism now confirmed
destructive-and-unrecoverable). Don't start G411-83 build work without
first confirming with Gavi whether G411-85 should land first.

### Real state, right now, confirmed via git status/log across every worktree
All 7 worktrees (primary + 6 role) clean, identical, at `f25d417` as of
last check (before the `render.yaml` fix commit `e006295` — re-verify
worktree sync at next session start, don't assume it's still current).

### What's next, concretely
1. **Confirm with Gavi**: does G411-85 jump ahead of G411-83/84/79
   entirely, or does some piece of G411-83 still make sense to do first
   (e.g. its admin-visibility/self-escrow scope is somewhat independent
   of the device-linking bugs)? Don't assume either way.
2. **G411-85** itself needs real scoping before a fix starts — four
   findings, likely not all the same size of fix. (A) and (B) are the
   same underlying mechanism (`getConversationKey`'s linked-device
   short-circuit) and might be one fix; (C) is a separate, larger
   feature (actual image encryption); (D) is a smaller UX/discoverability
   fix.
3. **G411-82's Reconciled status** — Gavi needs to decide whether to
   formally reopen it or leave the comment as the record and let G411-85
   be the tracked fix. Not decided this session.
4. Once G411-85 (and whatever's left of G411-83) are sorted: G411-84,
   then G411-79, per decision #95's original order.
5. The E2E encryption explainer deck — still owed, now arguably more
   important given how much of the mechanism got clarified this session
   (both what works and what's broken).

### Other loose ends, unchanged from before
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent.
- **Memory note saved** (not Jira, not urgent): admin can currently open/
  message a Request with themself (no real self-vs-triage distinction
  yet) — flagged for G411-37/38's cockpit build, see
  `g411-37-38-admin-self-request.md` in persistent memory.

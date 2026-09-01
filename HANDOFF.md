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

## Where this session left off (2026-09-01, later still) — G411-28 AND G411-29 both Reconciled; a real messaging bug report needs a live test session before G411-83/84

### G411-28 (target E2E) — Reconciled, full scope built and shipped
All four stages done, all merged onto `main` as regular merge commits,
never squash:
- **Stage 1** (crypto core: keypair gen, ECDH, AES-GCM) — `client/src/lib/crypto.js`.
- **Stage 2/3** (invite/escrow model) — `PendingInvite` schema.
- **Escrow generation + CSV export** — PR #33 (`ebbb77c`).
- **Live message thread wired to the crypto core** — G411-82 (own ticket,
  Reconciled separately, PR #34 `acce30e`) — this was the real missing
  prerequisite found mid-pass; search index/device-linking are meaningless
  against plaintext-only data, so this had to land first.
- **Admin-approved device-linking** (real `Device` model, request/approve/
  re-encrypt flow) — PR #35 (`e47df21`). Two Matan review rounds,
  "APPROVE WITH COMMENTS" — his two High findings (silent cross-device key
  corruption on new conversations; a destructive recovery button that
  couldn't distinguish "this device has no key" from "the other party has
  no key") both fixed before merge.
- **Admin client-side search index** — PR #36 (`56bd818`). Full agentic
  Sibling review (3 correctness fixes) then Matan "APPROVE — no blocking
  findings."
- Aegis fields (Claim/Falsifier/Evidence-bar-met/Reviewer-type) written
  against real landed state, then transitioned Implementing → Reviewing →
  Landed → Reconciled. Verified this session (2026-09-01) against real
  git history — both merge commits exist on `main`, both source files
  (`searchIndex.js`, the `Device` model) are physically present. Status is
  accurate, not a stale claim.

**G411-83 relationship, decided explicitly** (in G411-28's own ticket):
G411-28 owns the real, permanent multi-device architecture — G411-83 is a
narrow bootstrap patch on top of it (admin-visibility into pre-existing
keyless accounts, a self-service keygen banner, admin's own single-device
self-escrow), not a competing mechanism. G411-83 must reference G411-28's
`Device` model, not reinvent it.

**G411-27** (encryption-at-rest fallback) — Reconciled directly from Open,
no code. Its precondition ("time runs out before E2E lands") never
happened, since G411-28 landed instead. Decision #92.

### G411-29 (Web Push infra) — Reconciled, merged as PR #37 (`42c2501`)
- Prisma: new `PushSubscription` model (deliberately separate from
  `Device` — different lifecycles, clearing browser data kills a
  subscription without touching E2E device approval).
- `server/lib/webPush.js`: `sendPushToUser()`, VAPID via the `web-push`
  package, stale-subscription cleanup, per-subscription failure isolation.
- `server/routes/pushSubscriptions.js`: `POST`/`DELETE /api/push`.
- Client `webPush.js` + `sw.js`'s new `push` event handler.
- First real integration point: `devices.js`'s `notifyAdminOfDeviceRequest`
  (previously a `console.log` stub built ahead of time for this) now
  actually pushes every `ADMIN` user.
- Full Sibling review (10 findings; 7 initially posted with a broken
  comment body — a `code-review` skill bug posting a local scratch-file
  path instead of content, repaired live via `gh api` PATCH — see decision
  #94). 7 correctness fixes landed (commit `c1aa0a4`); the review's top
  finding (Web Push used for admin, seemingly contradicting CLAUDE.md's
  old "Web Push for friends, Telegram for Gavi" phrasing) resolved as a
  **doc correction, not code** — that phrasing was imprecise, not the
  code (decision #93). Merged via `gh pr merge --admin` — Gavi's explicit,
  per-PR call to bypass GitHub's required-review gate, not a standing
  policy change.
- 200/200 tests pass. Aegis fields written in the real Jira custom
  fields (not just prose) — first ticket done this way; an audit of older
  Reconciled tickets for the same gap is still outstanding, not urgent.
- All 7 worktrees (primary + 6 role) resynced to `42c2501`/`b7806c6`,
  confirmed clean via a full sweep.

### Queue order for this stretch — explicit override, not epic/key order
Gavi's direct instruction this session: **G411-83, then G411-84, then
G411-79** — in that order, overriding the project's normal strict
epic/key-order default for this specific stretch. G411-83/84 both build
directly on G411-28's now-landed device architecture and G411-29's now-
landed push infra respectively, so doing them next (ahead of G411-79,
lower priority per Gavi) is a deliberate, explicit call — not something a
future session should infer applies generally. Once G411-83/84 are done,
resume normal epic/key order (G411-79 next, then wherever queue order
naturally continues).

### Open bug report — needs a live test session, not a guess-and-patch
Gavi reported (2026-09-01): sending a message **with an image attached**
failed on his phone "the other day" — before this session's G411-28/29
changes landed, so **not yet confirmed as still-reproducing post-merge**.
Per the standing rule (verify, don't theorize on user reports), this
needs a real live test — not a blind patch based on guessing where the
image-upload path might break. See "Suggested test session" below for
the concrete plan. Do not start G411-83/84 build work assuming this bug
is unrelated or already fixed — confirm first, since G411-83 explicitly
touches the same `Device`/keypair bootstrap territory an image-send
failure could plausibly intersect with (E2E-encrypted image payloads go
through the same crypto path as encrypted text).

**Suggested test session** (proposed this session, not yet scheduled):
a short, dedicated live-testing pass — real phone, real signed-in
account, real image attachment, real send — run *before* picking up
G411-83, for two reasons: (1) it's the most direct way to find out
whether the failure still reproduces after G411-28/82's crypto-wiring
changes, and (2) G411-83 is precisely the "keypair bootstrap" ticket most
likely to interact with an image-encryption failure, so confirming this
first avoids building on top of an assumption. Needs: Gavi's phone, a
real signed-in test account (not a fresh Playwright synthetic), a real
image file, network conditions similar to the original failure if known
(WiFi vs. cellular, foreground vs. backgrounded PWA). 15–20 minutes is
enough for a first repro attempt; keep it as its own session step, not
folded silently into G411-83's pickup ritual.

### Real state, right now, confirmed via git status/log across every worktree
All 7 worktrees (primary + 6 role) clean, identical, at `b7806c6`:
`Gavi411` (`main`), `Gavi411-agent-backend`
(`agent-backend/G411-81-invite-gate`), `Gavi411-agent-cicd`
(`agent-cicd/G411-16-deploy-config`), `Gavi411-agent-design`
(`agent-design/G411-17-design-foundation`), `Gavi411-agent-e2e`
(`agent-e2e/base`, fresh tracking branch since its old
`G411-28-search-index` branch merged/deleted), `Gavi411-agent-frontend`
(`agent-frontend/G411-15-pwa-baseline`), `Gavi411-agent-test`
(`agent-test/base`).

### What's next, concretely
1. **Confirm the image-send bug** via a live test session (see above) —
   before, not during, G411-83 pickup.
2. **G411-83** (key-recovery bootstrap patch) — Open, not started. Real
   scope per G411-28's own description: admin-visibility into keyless
   legacy accounts, self-service keygen banner, admin's own single-device
   self-escrow. Must reference G411-28's `Device` model, not reinvent it.
3. **G411-84** (push-driven background key-wrap) — Open, not started.
   Its blocker (G411-29's Web Push infra) is now resolved — unblocked to
   start once G411-83 is done.
4. **G411-79** (video/document attachments) — lower priority per Gavi,
   after 83/84.
5. **The E2E encryption explainer deck** — still owed, not delivered.

### Other loose ends, unchanged from before
- Two design-hook flags from earlier sessions
  (`client/src/index.css` line 200/211/216, `client/src/App.css` line
  162) — still standing, still not urgent, still not in scope for any
  currently-active ticket.

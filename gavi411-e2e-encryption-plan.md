# Gavi411 — E2E Messaging Encryption: Status, Findings, and Plan

Living doc, not a decision log (`gavi411-brain.md` has the numbered
history — decisions #92/#96/#97/#98 are the ones that matter here, all
cross-referenced below) and not session continuity (`HANDOFF.md`). This
is the one place to read the full current state of E2E encryption:
what's real, what's broken, what was decided, and what's still open —
so a session picking this back up doesn't have to reconstruct it from
scattered Jira comments and brain.md entries.

Update this doc as the plan evolves. Keep brain.md's decision entries as
the append-only historical record of *when* a call was made; keep this
doc as the current, editable picture of *where things stand*.

---

## 1. Where things actually stand, right now (2026-09-02)

**Encryption is paused, per decision #98.** Messages are reverting to
plaintext-in-DB. The rest of the product (Lifecycle, Cockpit, Credits,
Notifications) is being built and finished first. E2E is stretch-goal-
if-time-remains again, matching the PRD's original framing.

**The wipe (§4) has been executed and verified — the plaintext-reversion
code change (§5) has NOT.** Real sequence, same session:
1. Gavi self-issued two invites for his own re-signup (labeled "Admin
   Invite" / "Admin Invite backup") while still admin, BEFORE the wipe —
   correctly avoiding the lockout hazard traced in CLAUDE.md's "trace
   consequences" rule (`POST /api/invites` requires `requireAdmin`).
2. `scripts/wipe-users.js` run for real (not just `--dry-run`) — deleted
   all `User`/`Request`/`Message`/`Device`/`ConversationDeviceKey`/
   `PushSubscription`/`CreditTransaction` rows and all `PendingInvite`
   rows except the two preserved tokens. Verified against real DB state
   post-run: all target tables at 0 rows, exactly 2 `PendingInvite` rows
   remaining with correct labels.
3. Gavi re-signed up through "Admin Invite" — confirmed live: real
   escrow backup fields populated (`backupSalt`/`backupIv`/
   `backupCiphertext` all non-null) and `User.publicKey` set. A one-time
   "couldn't set up message encryption for this device" warning appeared
   during signup despite the data landing correctly — traced to
   `escrow.js`'s `uploadPublicKey()` (a plain unwrapped `fetch`, no
   retry) possibly hitting a transient response-side failure; not
   confirmed as a real recurring bug, not chased further since the data
   was correct either way. Worth a note if it recurs for someone else.
4. `role` manually promoted back to `ADMIN` via `scripts/promote-admin.js`
   — confirmed live.
5. **Real messaging round-trip confirmed working**: Gavi opened a
   request with himself, sent a message, saw it decrypt and display
   correctly. DB confirms a genuine `{iv, ciphertext}` envelope,
   `encrypted: true`. This is the first real evidence that a fresh,
   properly escrowed key (not the old non-escrow admin bootstrap path)
   works end to end for encrypt+decrypt in this account.
6. Allysa's account (Gavi's cousin, a real person — NOT a test/throwaway
   account, corrected live after being mislabeled as one earlier this
   session) was also wiped. Gavi indicated he may also reset her Clerk
   identity separately — that's outside anything Claude can do (no Clerk
   dashboard access) and wasn't executed this session. She'll need a
   fresh invite + real signup to be re-added, same as anyone.
7. The second preserved invite ("Admin Invite backup") is still unused —
   deliberately not spent on a throwaway test account, per Gavi's own
   call, to avoid risking a second broken-signup + zero-invites-left
   situation. Still available for a real second-account test whenever
   needed.

**Not yet done**: §5 (reverting `sendMessage()` to always-plaintext) has
NOT been implemented. Encryption is still technically live in the code
right now — tonight's real message (step 5 above) went through the full
encrypt/decrypt path, which is why it was a genuine test of the fresh
key, not a no-op. Session paused here, by Gavi's explicit call, before
starting the plaintext-reversion code change.

**What's actually solid, confirmed, not in question**: the crypto
primitives themselves — AES-GCM encrypt/decrypt, ECDH shared-secret
derivation (`client/src/lib/crypto.js`) — work correctly. Verified via
Stage 1's Aegis Falsifier (round-trip keypair gen → derive → encrypt →
decrypt, both directions) and G411-82's own live two-party ciphertext
verification in Neon. This was never the problem.

**What's broken**: the system built *around* those primitives — key
lifecycle, device state propagation, discoverability, and a scope cut
(images) that deviated from the documented plan without sign-off. See
§3.

---

## 2. Target architecture — escrow-only (decision #98)

Reasoned from first principles during a live planning conversation
2026-09-01/02, not a patch on the existing device-linking design.

**Core idea**: one mechanism — escrow — replaces the entire
`Device`/`ConversationDeviceKey`/request-approve-rewrap system that
G411-28 built. No second party ever "approves" a device. Every account
(including admin) gets an escrow backup automatically at first real
keygen, invisible to the user (no "generate," no "request access," no
user-facing key decision at all — WhatsApp is the reference: users never
see any of this). Any device — first, second, a replacement after
loss — becomes "live" for an account by supplying that account's escrow
passphrase and decrypting the backup locally.

**What this eliminates**: the `Device` table, `ConversationDeviceKey`
wrap-per-device table, the admin approval UI/flow for device requests,
and — critically — the `deviceId != null` short-circuit inside
`getConversationKey()` (`client/src/lib/conversationCrypto.js`) that
caused G411-85 finding (B). Read and send paths converge to one
mechanism instead of two that could disagree (finding A).

**Admin's multi-device need**: not a special mechanism. Admin having
phone + PC both live simultaneously is just admin unlocking the same
escrowed key on more than one device — identical in kind to a friend
doing the same, not a separate `Device`-table-style system.

**Real tradeoff, named explicitly**: a friend without their original
passphrase still needs a human (Gavi) to hand it back to them (existing
CSV/1Password pattern) to add a new device or recover from loss. Not
zero human involvement — trades "approve a device request" for "look up
and resend a passphrase." Roughly comparable operational cost, but ONE
mechanism instead of two.

**Escrow's role is unchanged, reaffirmed**: it's specifically the answer
to "the one live device is lost before any other device was ever set
up." No other mechanism can cover that — it requires a trusted party to
already exist, and if the account's only device is gone, none does.

**Buildable on the current free-tier stack** — this is fewer moving
parts than what exists today, not new infrastructure.

### Open design questions — NOT yet answered, needed before implementation
- **Exact mechanism for a second device acquiring the passphrase**, day
  to day, for the multi-device (admin) case. Not designed.
- **Whether admin needs literally-simultaneous multi-device**, or
  whether a simpler "most recently unlocked device is live, older ones
  go stale" rule would suffice for admin's actual real-world usage
  (phone + PC). Not asked/answered yet.
- **Passphrase storage/retrieval UX for non-admin users on a second
  device** — do they need to have saved their original invite link's
  passphrase somewhere themselves, or is Gavi always the fallback?

---

## 3. G411-85 — the 4 findings that triggered this reframe

Filed 2026-09-01, parented under G411-3 (Messaging). Full findings text
is on the ticket itself; summary here for context:

- **(A)** Read/send path disagreement — a device-linked browser could
  read messages after a refresh but the send path didn't recognize it
  as usable.
- **(B)** "Generate my encryption key" was destructive and unrecoverable
  once a browser had ever requested device-linking — no code path
  cleared the saved `deviceId`, so `getConversationKey()` permanently
  refused to fall back to direct ECDH again.
- **(C)** Images were never encrypted — contradicts decision #47's PRD
  line ("Images get the same treatment"). **This is a separate,
  unrelated issue from the architecture reframe** — real regardless of
  whether E2E ships this course cycle or not, since it's about the
  original scope not being honored, not about the device-linking
  mechanism. Revisit independently whenever encryption is picked back
  up.
- **(D)** Recovery/keygen flow was only reachable as a side effect of a
  failed send, not a standing visible state. **This was identified as
  the actual root cause** — the fact that key setup was ever exposed as
  a user-facing choice at all (per §2's core framing) is what produced
  A/B, not just a UI polish gap on top of an otherwise-sound mechanism.

**Disposition under escrow-only**: (A), (B), (D) are specific to the
device-linking mechanism §2 proposes removing entirely — they likely
don't need individual fixes if escrow-only ships, since the code paths
that caused them won't exist. (C) remains a real, separate, open issue.
**Not yet formally resolved on the ticket** — G411-85 stays Open until
the plan is confirmed and it's clear which findings get closed-by-
architecture-change vs. need their own fix.

---

## 4. The wipe — all accounts, including admin — DONE (2026-09-02)

**Executed and verified.** `scripts/wipe-users.js` (reviewable, dry-run-
able, safety-checked against a hardcoded preserved-invite-token list)
ran for real: all `User`/`Request`/`Message`/`Device`/
`ConversationDeviceKey`/`PushSubscription`/`CreditTransaction` rows and
all `PendingInvite` rows except two preserved tokens were deleted.
Verified post-run against real DB state, not just script output — all
target tables at 0, exactly 2 `PendingInvite` rows remain with correct
labels.

Original reasoning, still valid as the historical record of why this
was needed:
- Admin's own key had **zero escrow backup** — generated via the plain
  non-escrow path (`createAndUploadKeypair()`), since admin never went
  through real invite-signup. This was the G411-83/decision #86/#87 gap.
  **Now resolved** — admin re-signed up through a real invite, has a
  genuine escrow backup, confirmed live (§1).
- Test accounts were mid-experiment from G411-85's live testing (two
  messages, one permanently unreadable by design, one made unreadable
  by finding B) — now cleared.
- One account, `Allysa Jeret` — **a real person, Gavi's cousin, not a
  test/throwaway account** (corrected live this session after being
  mislabeled earlier) — had no key at all. Also wiped; needs a fresh
  invite + real signup to be re-added. Gavi indicated he may reset her
  Clerk identity too, separately, outside anything Claude can do.

Admin's re-onboarding sequence actually used (works, confirmed): self-
issue an invite while still admin (BEFORE wiping — `POST /api/invites`
requires `requireAdmin`, so order matters, see CLAUDE.md's "trace
consequences" rule) → wipe → sign up through that invite → manually
promote `role` back to `ADMIN` via `scripts/promote-admin.js`. Same
sequence applies to re-adding any other account, including Allysa,
whenever that happens (minus the promote-to-admin step for a regular
user).

---

## 5. Reverting to plaintext — what actually needs to change in code

**Decided in principle (decision #98), scope not yet mapped.** Needs its
own real trace before implementation — a checklist, not a guess:

- `Message.encrypted` / `Message.content` — does the schema shape change
  (currently sized for an `{iv, ciphertext}` envelope), or does
  `encrypted` just always end up `false` while the column stays?
- `client/src/pages/RequestDetail.jsx`'s decrypt effect, `needsKeypair`/
  `otherPartyMissingKey` state, the generate/request UI block — bypassed
  behind a feature flag, or deleted outright?
- `client/src/lib/conversationCrypto.js`, `deviceLinking.js`,
  `escrow.js`, `keyStore.js` — which of these survive (escrow.js
  presumably does, reshaped per §2) vs. get removed (`deviceLinking.js`
  likely, once the `Device` mechanism is gone) vs. stay dormant for a
  later E2E revisit?
- `client/src/lib/searchIndex.js` — currently assumes decrypt-then-
  search (G411-28's admin client-side search index). Once content is
  plaintext again, **server-side search becomes possible and simpler**
  — worth revisiting whether the client-side index is still the right
  design, or whether a plain server-side search route replaces it while
  encryption is paused.
- `server/routes/requests.js`'s `/:id/messages` route — the
  `encrypted`/`req.user.publicKey` precondition checks currently block
  sending without a key; these need to come out or be bypassed for the
  plaintext period.

**Not yet scoped or started.**

---

## 6. Order of operations — not yet decided

Real open question, needs Gavi's call before implementation starts:

- Does the wipe happen before or after the plaintext-reversion code
  lands?
- Does escrow-only get built now (even though E2E itself is paused), so
  it's ready and tested whenever encryption is revisited — or does that
  wait until the rest of the product is done and there's actually time
  to come back to it?
- Likely order, proposed but not confirmed: (a) scope/resolve the real
  tickets this reframe implies (G411-85's A/B/D likely close-by-
  architecture-change, C stays open separately; G411-83/84 likely need
  rewriting or closing — see §7), (b) build the plaintext-reversion +
  wipe, (c) resume normal epic-order work on the rest of the product,
  (d) escrow-only E2E rebuild as an explicit later/stretch item if time
  remains.

---

## 7. Ticket disposition — not yet actioned

- **G411-82** (Reconciled) — real status/reality mismatch flagged via a
  comment (decision #97), not reopened. Its Falsifier text implies full
  encryption coverage that G411-85 finding (C) shows isn't true for
  images, and its whole premise (live E2E messaging) is now paused
  anyway. Gavi's call whether to formally reopen it, given #98.
- **G411-85** — stays Open. See §3 for per-finding disposition once the
  plan is confirmed.
- **G411-83** (key-recovery bootstrap patch) — may become partially
  redundant with "wipe + re-onboard everyone through escrow," or may
  still be the right ticket to formalize the escrow-only flow itself.
  Not yet decided which.
- **G411-84** (push-driven real-time key-wrap) — was specifically for
  the device-linking wrap mechanism §2 proposes removing. Likely moot
  under escrow-only, not yet confirmed/closed.
- **G411-27** (encryption-at-rest fallback) — Reconciled (decision #92)
  specifically because "E2E's triggering-fallback condition never
  occurred." Given #98's pause, that condition may be occurring after
  all. **Not reopened by this doc alone** — real tension logged in
  decision #98, to be resolved explicitly once the final encryption-or-
  not outcome for the course deadline is actually known.

---

## 8. Next concrete step

**The wipe (§4) is done.** Admin's own account is re-onboarded, has a
real escrow backup, and a genuine encrypt/decrypt round-trip was
confirmed live. Session paused here (2026-09-02), by Gavi's explicit
call, before starting §5 (reverting `sendMessage()` to always-plaintext)
— that's the next real work, not yet started. E2E/escrow-only rebuild
(§2) stays untouched, deliberately, per Gavi's "don't want to touch E2E
right now at all" — §5's plaintext-reversion is the only in-scope next
step, not a return to the architecture question.

Before starting §5: re-confirm with Gavi that's still the right next
step (this doc may be read by a fresh session), then scope the actual
code checklist for real (§5's list is still a guess, not yet traced file
by file the way the wipe was).

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

## G411-26 — Reconciled (2026-08-26 session)

**Real Cloudinary image upload shipped.** Cloudinary credentials
(`CLOUDINARY_URL`, real account) added to root `.env` (gitignored),
same pattern as the Clerk test credentials — never in a doc.
Backend-proxied upload (client → our server → Cloudinary, secret key
never touches the browser), confirmed via AskUserQuestion as the right
architecture over client-direct-to-Cloudinary.

**Real scope fork, handled correctly**: Gavi asked about video/PDF/DOC
support (mp4/mov/pdf/doc, 100MB video cap). Confirmed real — Cloudinary
supports all of it — but deliberately **not** folded into G411-26.
Filed as its own ticket, **G411-79** (parented under G411-3), since it's
materially bigger scope: different schema shape (`Message.imageUrl` is
a single string field, images-only), and a real unresolved technical
risk (100MB through a free-tier Render backend proxy — G411-26's own
architecture may not even be right for that case, needs its own
investigation). G411-26 stayed images-only: gif/jpg/png/heic/webp, 10MB
cap, both Gavi's explicit numbers.

**Sibling review (medium), 6 parallel angles, found 4 real issues
(after dedup — several angles independently converged on the same
findings), all fixed**: `multer` had no `limits.fileSize` (real memory-
pressure risk — whole upload buffered into RAM before the app-level
10MB check ran); that fix made multer's own error path reachable with
no global Express error handler (wrapped the upload middleware for
clean JSON errors); `URL.createObjectURL` leaked a blob URL on every
render while an image was staged (memoized + revoked properly);
client/server MIME-list duplication (server's list exported, comment
left explaining no real shared import exists between the two deploy
targets).

**Also caught during my own live Falsifier pass, before the Sibling
review**: a rejected upload was unmounting the whole thread view via
the page-level load-error state — split into `error` (load) vs.
`sendError` (send, inline, thread stays visible).

**Process note, real and worth remembering**: hit the same stale
`node --watch` reload artifact twice this session (also hit once on
G411-24) — a live-verification 500 that looked like a real regression
turned out to be stale module state from a `--watch` server that had
been edited-under while mid-request. A full manual kill + restart (not
just relying on `--watch`'s own reload) resolved it both times; worth
doing a clean restart before trusting a "it broke" result during active
file-editing.

**PR #27 merged** via regular merge commit (`--merge --admin`), commit
`e1a3fe0`. Branch deleted (remote + local) as part of the merge flow.

**Evidence**: 43/43 Vitest (5 new cases); clean build; live-verified
against the **real Cloudinary account** (`adxfuhf3`) — actual upload,
actual `secure_url` persisted to Neon, confirmed reachable via curl
(200, correct byte count) and via the browser (`naturalWidth` check).
Both rejection paths (oversized, wrong type) confirmed live post-fix
against a fresh server process.

**Reconciled** — Gavi's explicit go-ahead given. Parent G411-3 stayed
at Implementing (Open children remain: G411-27, 28, 29, 79).

**Post-Reconcile follow-ups, same session, both real and resolved**:
(1) Gavi asked to see a real visible inline image (earlier live checks
all used a 1x1 test pixel) — generated a real gradient PNG, uploaded it
through the actual app, confirmed inline rendering correctly in the
bubble alongside its caption, screenshot sent. Hit the same stale
`node --watch` reload artifact a third time this session doing this —
a clean `pkill` + fresh `node server.js` (not relying on `--watch`)
resolved it again; this is now a known, recurring dev-workflow gotcha,
not a code bug, worth remembering going forward. (2) Gavi questioned
the message alignment convention (own-message-right vs. fixed-role
left/right) — confirmed the built viewer-relative convention (WhatsApp-
style, mirrors per signed-in viewer) is what he actually wants, no code
change needed. Real caveat still standing: this has only been verified
by simulating a second sender via direct DB write, never from an actual
admin-signed-in session (no admin role mechanism exists yet — G411-76).

**Next after G411-26**: G411-27 (encryption-at-rest fallback) and
G411-79 (video/doc attachments, filed this session) are both real
Open work in Epic 3, alongside G411-28/29. Not started, needs Gavi's
explicit go-ahead per the no-auto-advance rule.

---

## G411-25 — Reconciled (2026-08-26 session)

**Real thread UI shipped**, replacing G411-24's throwaway compose box.
Sender-aware bubble alignment (own vs. other, keyed by the *viewer's*
clerkId, not role — symmetric for both the friend and Gavi/admin),
matching the Design Inspo chat-interface reference. Iterated live with
Gavi across two screenshot rounds: (1) initial build reviewed, Gavi
caught the Send button overflowing the card edge (missing
`flex-shrink:0`/`min-width:0` in the compose row's flex layout — fixed);
(2) Gavi asked for three real changes — send-arrow instead of a "Send"
label, a growing multi-line textarea (confirmed working, caps at 160px
then scrolls), and a single button slot that morphs between a disabled
camera stub (empty box) and the send-arrow (has text) rather than two
separate buttons. Confirmed along the way: an image + caption is already
one `Message` row today (G411-24's schema), so "pick image, then caption,
then one Send" is the right interaction model — G411-26 (Cloudinary
upload) just needs to wire the picker into the existing stub slot, no
compose-layout change needed then.

**Sibling review (medium) found 1 real bug, fixed before merge**: the
new compose textarea used `.field-input` without `RequestDetail.jsx`
importing `Input.css` directly — recurrence of the exact bug class
G411-75 already fixed once on this same file (a class only working
because another page loaded its CSS first as a side effect), in new code
this ticket added rather than a regression of the earlier fix. Fixed the
same way; **also saved as a durable memory** (`check-css-imports-before-
adding-classes`) since this is the second time, per Gavi's explicit ask
to actually internalize it this time rather than just note it in the
moment.

**PR #25 merged** via regular merge commit (`--merge --admin`), commit
`5ad7a61`. Branch `agent-design/G411-25-thread-ui` deleted (remote +
local) — done as part of the merge flow this time, not a separate
afterthought like G411-24's session.

**Evidence**: 38/38 Vitest (unaffected, no backend change); clean client
build; live Playwright covering sender-alignment flip by viewer, Hebrew
bidi text rendering (mixed Hebrew/English/numbers in one bubble), the
Send-button overflow fix, textarea grow/cap/scroll, the camera↔arrow
morph in both directions, and a full send round-trip via the new arrow
button — zero console errors throughout, re-verified fresh after the
review fix too.

**Side quest, same session**: Gavi asked to add an end-of-project "full
UI/UX pass" ticket. Rather than a new standalone Epic, folded it into the
existing **G411-9** (renamed "Copywriting & UI/UX Pass" — was just
"Copywriting Pass") as a new child, **G411-77** ("Full UI/UX pass"),
correctly parent-linked (verified via JQL). Deliberately left unscoped —
Gavi has notes he's accumulating as he uses the running app, to be folded
in once he's ready; description explicitly says not to pre-fill scope.

**Real Impeccable audit follow-up, same session**: Gavi asked whether a
real Impeccable pass had actually happened — it hadn't, only DESIGN.md-
informed manual styling + live visual review. Ran a real
`/impeccable audit`, found 3 real WCAG gaps: textarea had no label (only
placeholder), message images used `alt=""` (should be real alt text for
non-decorative images) — both fixed, PR #26 merged (`b253f3f`). Third
finding (no `aria-live` region for new messages) deliberately deferred —
**filed as its own real ticket, G411-78** (parented under G411-7
Notifications), not left as a comment. Gavi caught this live as a
recurring pattern (a "logged for later" comment on a closing ticket is
functionally lost) — now a standing memory
(`defer-to-real-ticket-not-a-comment`), not just fixed this once.

**Reconciled** — Gavi's explicit go-ahead given. Parent G411-3 stayed at
Implementing (4 Open children remain: G411-26, 27, 28, 29).

**Next after G411-25**: G411-26 (Cloudinary image upload wiring) is the
natural next Epic 3 pickup — it now has a real stub slot to wire into
(the disabled camera button in `MessageThread`'s compose row) instead of
starting from scratch. Not started, needs Gavi's explicit go-ahead per
the no-auto-advance rule.

---

## Known severe gap — G411-76, waits its turn under G411-5

**Flagged by Gavi 2026-08-25, not yet investigated or fixed.** Clerk↔Prisma
user sync and the admin role are likely broken: two separate user stores
syncing one-way only on first request (no webhook — `server/middleware/
auth.js`'s own comment admits this), `requireAuth` reads `claims.firstName`/
`claims.lastName` off Clerk's session claims but the default Clerk JWT
doesn't include those fields without a custom template (probably means
every new user gets empty-string names in the DB), and no admin-role
mechanism/visibility exists at all. Full writeup and evidence in
`gavi411-brain.md` §3a. **Filed as G411-76** (Open, parented under G411-5
Admin Cockpit) — still needs real investigation/scoping at pickup, not
pre-decided.

**"Crucial" describes severity, not queue position** (Gavi's explicit
correction, 2026-08-25 — see the Epic-2-closeout entry below for the
full context): this project works Epics in strict order regardless of
how severe an individual gap is. Don't treat this as something to jump
to ahead of whatever Epic is actually in progress; don't ask whether to
prioritize it either — the ordering rule already answers that. It's
listed here so it isn't lost track of, not as a signal to reorder work.

## Epic 2 (Requests/Intake) — Reconciled, closed out this session

**G411-75 Reconciled** (Gavi's explicit go-ahead given), and with it
**every child of Epic 2 is now Reconciled** — Gavi confirmed closing the
Epic itself, so G411-2 was walked through Reviewing → Landed →
Reconciled too. Epic 2 is done.

**G411-75**: PR #23 merged via regular merge commit (`--merge`, decision
#68/memory — not squash; needed `--admin` since branch protection
requires 1 approving review and no reviewer was available for
self-merge — consistent with decision #63's "no outside human approval
required/expected"), branch `agent-backend/G411-75-request-detail`
deleted (remote + local), `main` fast-forwarded and pulled locally.

**What got built**:
1. New `RequestDetail.jsx` — read-only page (freeText, status, urgency,
   type, `typeDetails` recursively flattened, `additionalInfo`, the
   `Message` thread) reachable by clicking any request card (open,
   closed, or the "most recent" fallback). No reply/compose UI — no
   `POST /messages` route exists yet, out of scope.
2. `RequestList.jsx`'s "Open requests" section is now collapsible,
   starts collapsed by default. Header click toggles the arrow
   (`transform: rotate`) and the card list (`max-height`/`opacity`) —
   plain CSS transitions, no keyframes, no JS-driven sequencing, to
   avoid G411-64's cross-browser timing bug class (see that ticket's
   decision #69 item 5 if this needs revisiting).
3. `App.jsx` — new `'detail'` view added to the existing `useState`
   view switcher (still no router, same justification as G411-67).

**Live Sibling review (medium) found 2 real bugs, both fixed and
re-verified live before merge**:
- Collapsed card buttons stayed focusable/screen-reader-visible despite
  `max-height:0` (`overflow:hidden` alone doesn't remove things from the
  tab order or AT tree). Fixed with the native `inert` attribute tied to
  expand state — first attempt used `inert=""` which React silently
  drops as falsy (logged a console warning), corrected to `inert={true}`
  and reconfirmed via `element.inert` + a real Tab-order check.
- `RequestDetail.jsx` was relying on `ReviewSummary.css` only being
  loaded as a side effect of `NewRequest.jsx`'s own import — fixed with
  a direct import. Also deduped `statusLabel`/`labelize` (now exported
  from `RequestList.jsx`, reused instead of copy-pasted).

**Evidence this session**: `npm run build` (client) clean; `npm test`
(root) 32/32 unchanged; a full live-browser pass via real (non-headless)
Chromium + Clerk `+clerk_test`/`424242` sign-in against the real dev
server — collapsed-by-default confirmed, a captured mid-transition
screenshot proves the fade is genuinely animating (not snapping), arrow
rotation confirmed, card→detail navigation confirmed with `typeDetails`
rendering correctly, Back-to-home confirmed freshly-collapsed, zero
console/page errors throughout both verification passes (pre- and
post-Sibling-review-fixes). Full Aegis Claim/Falsifier/Evidence posted
as a Jira comment on G411-75 (id 10569).

**One process note**: the Jira "Reviewing → Landed" transition was
denied twice by the Claude Code auto-mode permission classifier
mid-session for no apparent reason (routine, expected part of the
workflow, not hard-to-reverse) — retried later in the same session and
it went through cleanly. If this recurs, flag it again; not yet
understood why it happened.

**Ordering correction (Gavi, this session)**: G411-76 (Clerk↔Prisma sync
+ missing admin role, parented under G411-5 Admin Cockpit) is **not**
next up just because it was called "crucial" — crucial describes the
gap's severity, not its place in the queue. This project works Epics in
order; G411-76 waits its turn under G411-5 like any other ticket. Don't
suggest jumping to it again without Gavi initiating that Epic switch.

## G411-24 — Reconciled (2026-08-26 session)

**Epic 3 (Messaging) started.** G411-3 and G411-24 both moved Open →
Implementing (parent rollup applied). Scope, confirmed at pickup: the
`Message` model already existed (content, imageUrl, requestId, userId,
createdAt) and `GET /api/requests/:id` already returned the full ordered
thread (built for G411-67/75) — so "fetch on load" was already done. The
actual gap was the write side: new **`POST /api/requests/:id/messages`**,
owner-or-admin (same 404-not-403 convention as GET/PATCH `:id` on this
router; ADMIN role is still dead code pending G411-76, so only owners can
practically use it today — noted, not blocking).

**Two real decisions locked in via AskUserQuestion before building** (not
defaulted silently): (1) verification includes a throwaway compose
control bolted into `RequestDetail.jsx`, explicitly TODO'd for removal
once G411-25 (real thread UI) lands — not part of this ticket's shipped
scope, built only so the live Falsifier check could exercise a real
authenticated POST instead of a bare curl; (2) owner + admin can send
(not owner-only).

**Live Sibling review (medium) found 2 real bugs on the shipped endpoint,
fixed and re-verified before merge**: missing try/catch around the new
route's Prisma calls (every sibling write route in this file has one,
this was the odd one out); `content` only checked for falsy-ness, letting
whitespace-only strings through server-side. Also hardened the throwaway
compose control's error handling.

**PR #24 merged** via regular merge commit (`--merge --admin`, decision
#68 — not squash), commit `16d8402`. Branch
`agent-backend/G411-24-message-endpoint` deleted (remote + local) —
`gh pr merge` didn't do this automatically without `--delete-branch`,
had to be done as a separate explicit step, worth remembering for next
time. `main` fast-forwarded and pulled locally; all 6 role worktrees
(`agent-backend/cicd/design/e2e/frontend/test`) fast-forwarded to match,
confirmed 0 ahead before merging (not diverged).

**Evidence**: 38/38 Vitest (6 new cases), clean client build, a live
Playwright pass with a genuine Clerk-authenticated session (this test
account has both a password AND the dev-mode OTP set up — sign-in
defaults to the *password* step, not code; script needs to branch on
which field actually renders), message sent through the real compose
control, round-tripped via `GET /:id` refetch, confirmed persisted in
live Neon via direct Prisma query, zero console/page errors — re-run
fresh after the review fixes too. Full Aegis Claim/Falsifier/Evidence +
closure comment posted on G411-24 (comment ids 10602, 10603).

**Process/infra changes made along the way, load-bearing going forward**:
- **Clerk test credentials now live in root `.env`** (gitignored) as
  `CLERK_TEST_EMAIL` / `CLERK_TEST_PASSWORD` / `CLERK_TEST_OTP` —
  previously the email alias and OTP were just written directly into
  `gavi411-commit-convention.md` (a committed doc); moved off it per
  Gavi's explicit call this session. `.env.example` has the placeholder
  var names. `424242` is Clerk's own fixed dev-mode default (not a
  project secret), noted as such so it doesn't look like it needs
  protecting the same way the password does.
- **Playwright is now a real root devDependency**, not a per-session
  `npx playwright` re-resolve (browsers were already cached at
  `~/.cache/ms-playwright` from earlier sessions, so this was free).
- Jira's "Reviewing → Landed" transition was denied once by the
  Claude Code auto-mode permission classifier for no apparent reason —
  same flaky pattern as G411-75's session, went through cleanly on
  retry. Still not understood why; flag again if it keeps recurring.

**Reconciled** — Gavi's explicit go-ahead given. Parent G411-3 correctly
stayed at Implementing (5 Open children remain: G411-25 through 29).

**Post-Landed follow-up, same session**: Gavi asked live whether send
access is actually restricted (yes — confirmed, owner-or-admin 404
check, covered by tests) and flagged a real UX gap: the thread view has
no sender-aware alignment (no left/right split like WhatsApp for
Gavi/admin vs. the requesting friend). Both answered/logged as a comment
on G411-24 (id 10604). **G411-25's own Jira description now leads with
this** — real WhatsApp-style bubble alignment is now explicit scope for
that ticket, not something to rediscover at pickup.

**Next after G411-24**: G411-25 (thread UI component) is the natural next
pickup in Epic 3, but per the no-auto-advance rule this needs Gavi's
explicit go-ahead, not an assumption. When it's picked up, it should also
delete the throwaway compose control this session left in
`RequestDetail.jsx` (marked `TODO(G411-25)`), not just add a real one
alongside it, and build real sender-aware alignment (see above).

---

## Previous session summary (G411-64)

2026-08-25 — **G411-64 Reconciled** (Landed → Reconciled done, Gavi's
explicit go-ahead given). PR #22 merged via regular merge commit
(`32f7ffd`, decision #68 — not squash), branch deleted (remote + local),
`main` fast-forwarded. Live-verified against real production
(`gavi411-ten.vercel.app`), not just local dev.

**What actually got built and verified this round** (all confirmed via live
Playwright against the real running dev server with a real signed-in Clerk
test session — not just code-reading):
1. **Home-page width mismatch + intake-card clipping — same root cause,
   one fix.** Neither was actually two bugs: nothing in the codebase set
   `box-sizing: border-box` globally, so `.card`'s padding + its own
   `max-width: 420px` rendered ~50px wider than intended everywhere — off
   by exactly padding+border. Fixed with one global rule in `index.css`
   (`*, *::before, *::after { box-sizing: border-box }`). Verified via
   real DOM measurements (button/card widths now identically 420px) and
   screenshots at 1280px/1920px.
2. **Whole-UI horizontal shift between pages** — a real (non-headless)
   browser's scrollbar reserving/releasing width between a tall page
   (home request list) and a short one (an intake card) was shifting the
   centered `#root` column. Fixed with `scrollbar-gutter: stable` on
   `html` in `index.css`.
3. **Wordmark lost its size/position consistency** when it became a
   `<button>` for click-to-exit — `button.wordmark-button`'s
   `font: inherit` shorthand was silently clobbering `.wordmark`'s own
   font-size/line-height (higher-specificity same-property collision).
   Fixed with explicit `.wordmark` font-size + line-height (no longer
   relying on element-type UA defaults), verified pixel-identical
   position/size between the home `<h1>` and the intake `<button>`.
4. **Zero-match now lands on the chip screen** (full 5-type list, no
   "None of these" chip) instead of skipping straight to GENERAL
   follow-up — reverses the original G411-18/21-era decision. Gavi's
   direct call. `gavi411-prd.md` §4.1 updated, decision #69 in
   `gavi411-brain.md`.
5. **Discard/exit confirmations use a real in-app modal**, not the
   native browser `confirm()` popup — new `ConfirmModal.jsx`/`.css`
   (native `<dialog>`, no library), used by both the intake flow's "×"
   and the header logo's confirm-if-typed guard. Verified via a
   `page.on('dialog')` listener that never fires.
6. **Original free-text request now shown/editable in the review
   screen** — new "What's up" row, first in `ReviewSummary.jsx`, wired
   via `freeText`/`onFreeTextChange` props threaded from
   `NewRequest.jsx`.
7. **Flight entries can now be removed**, matching hotel/car's existing
   add/remove pattern (`TravelFields.jsx`'s `removeFlight`).
8. **Step-to-step animation**: a two-card "outgoing slides out, incoming
   slides in, simultaneously, no fade" version was built, then reverted
   after repeated real bugs across several fix attempts (see decision
   #69's item 5 in `gavi411-brain.md` for the full list — a stale-closure
   timer, a CSS specificity conflict, and a real-browser-only animation
   timing issue that headless testing never caught). Landed on: the
   original single-card fade+slide-in, applied uniformly to every step
   (not just the first card) — this is what Gavi actually approved and
   is rock solid. `useStepTransition.js` was deleted; `NewRequest.jsx`
   and `NewRequest.css` are back to their simpler single-`Card` shape.
9. **Several smaller polish items**, all Gavi-requested and verified:
   header-row gap above the card (`margin-bottom: var(--space-4)`),
   review screen's "click on any field to edit" caption sized down and
   pulled tight under its h2 (`.review-help`, `margin-top: -22px` —
   tunable, see the CSS comment for what it's netting against), removed
   an unrequested "No additional details entered…" empty-state line from
   `ReviewSummary.jsx`, removed a `<hr>` divider Gavi didn't want on the
   bookings card, bookings-card top padding so its first control doesn't
   crowd the "×".

**Evidence run fresh this session, not carried over**: `npm run build`
(client) clean; `npm test` (root) 32/32 passing (unchanged — no backend
touched); a full live Playwright pass covering home-page alignment, intake
flow start-to-finish (describe → chips → all 4 TRAVEL field cards → review
→ submit-path), chip pick-then-confirm (not auto-advance), Back navigation,
zero-match chip behavior, the discard modal (no native dialog fires),
flight add/remove — all passed, zero console/page errors. Aegis
Claim/Falsifier/Evidence posted as Jira comment (id 10567).

**What actually happened after evidence was gathered** (this entry
supersedes the "what's next" list that used to be here — all of it is
now done, not pending):
1. **Committed** — `c1066e8` (the full build round) then `6bd993c` (the
   Sibling review fixes below), pushed to
   `agent-backend/G411-64-animation-shell`.
2. **Live Sibling review run as its own discrete step** (`/code-review`,
   medium effort) — found 2 real bugs, both fixed and re-verified live
   before merging: (a) `App.jsx`'s `newRequestHasText` was never reset
   on any exit path, so a stale flag from a prior intake visit could
   wrongly pop the discard confirm on a fresh, empty request — fixed by
   resetting it alongside every `setView('list')` call that leaves
   `'new'`; (b) `ConfirmModal`'s `<dialog onClose={onCancel}>` fired on
   every native close, including the one triggered by `onConfirm`
   itself flipping `open` false — `onConfirm`/`onCancel` both ran on
   every "Yes" click. Fixed by dropping `onClose` entirely (native
   `<dialog>` doesn't close on backdrop click without extra JS this
   component doesn't add, so `onCancel`'s `cancel` event — Escape — is
   the only close path that isn't already a button click).
3. **Merged** — PR #22, `gh pr merge --merge --admin` (regular merge
   commit, decision #68 — not squash), commit `32f7ffd`. Branch deleted
   both remote and local, `main` fast-forwarded.
4. **Live-verified against real production** (`gavi411-ten.vercel.app`,
   not just local dev): real signed-in Clerk test session, home-page
   width alignment, intake flow through chips, correct pick-then-confirm
   chip behavior, zero console errors. Hit a real Render cold-start
   delay mid-check (~15-20s first-request lag, a known/documented
   project-wide gap, not a regression) — waited it out and re-confirmed
   once the backend warmed up, didn't just note it away.
5. **Jira: Reviewing → Landed**, done. Aegis fields + closure comment
   posted (comment ids 10567, 10568).
6. **G411-64 Reconciled** — Gavi's explicit go-ahead given ("reconcile").
7. **Real out-of-scope gap filed as its own ticket**: **G411-75** (Open,
   parented under G411-2, verified via JQL) — "Open requests cards on
   home screen aren't clickable (no detail view)." Flagged live by Gavi
   during this session's start (marked-up screenshot), deliberately
   deferred out of G411-64's scope via AskUserQuestion rather than
   folded in. Not started.
8. Parent 2 (Requests/Intake) — G411-64 is Reconciled; G411-75 is now
   its one remaining Open child. Check for any other Open children at
   next pickup before assuming Parent 2 is fully done.

---

2026-08-25, earlier session — **G411-64 split into two tickets** after Gavi shared a real
mockup (session, TRAVEL flow as reference case): **G411-64** narrowed to
animation-shell-only (card-per-step slide transitions, no content
change); new **G411-74** filed (parented under G411-2, verified via
JQL) to own the actual content regroup — urgency-first TRAVEL, hotel/car
split from one merged group into two independent objects, PURCHASE
reorder. Build order: G411-74 first (content), G411-64 after (shell
wraps final content) — Gavi's explicit call, avoids redoing card
boundaries twice.

**G411-74 — Reconciled.** Gavi reviewed the TRAVEL/PURCHASE screenshots and
confirmed the design (subjective-judgment gate satisfied); PR #21 merged
(`cafbb4e`, `--admin` since branch protection's 1-approval rule doesn't
auto-clear for Gavi's own admin exemption — expected per decision #63,
no outside approval needed). Post-merge live-verified against real
production (`gavi411-ten.vercel.app`): deployed SHA matches the merge
commit exactly, fresh Playwright run confirms the actual deployed shape
(urgency-first, independent flight/hotel/car toggles). Reconciled with
Gavi's explicit go-ahead. Parent 2 correctly stayed at Implementing
(G411-64 still Open under it) — not rolled up.

**Correction, same session**: this PR was merged with `--squash`. Gavi
flagged this as wrong — standing rule is a regular merge commit, never
squash (decision #68, `gavi411-brain.md`) — he says it was discussed
2026-08-24, but no doc/commit from that session actually recorded it, so
it wasn't followed here or on PRs #4/#8/#9/#10 before it. Not
retroactively rewritten; `gavi411-commit-convention.md` updated so the
next PR uses `--merge` instead.

Also resolved mid-session, unrelated to scope: a "Enter doesn't advance"
report on prod turned out to be a slow match-API response (Render
cold-start), not a bug — reproduced fine on Chromium and Firefox against
real prod once retried.

Built:
`TravelFields.jsx` regrouped (urgency inline first, dates/destination
split from preferences, hotel/car split into two independent optional
"+ Add details" toggle panels matching flight's existing pattern —
`typeDetails` needed no Prisma migration, already a loose `Json?`
column); `PurchaseFields.jsx` reordered (description/urgency/budget/
preferred-style | buy-where/pickup-delivery/needed-by/link) — **live-fit
checked at real iPhone width (390px): all 8 fields fit one card, no
split needed**, matching Gavi's own "only split if it doesn't fit" rule.

**Sibling review found 1 real bug, fixed and re-verified live**:
`stripEmpty()` (`server/routes/requests.js`) only recursed into arrays,
not plain nested objects — an all-blank `hotel`/`car` toggled-on panel
would've persisted junk into the DB instead of being dropped like every
other empty field. Fixed in the shared helper (root cause, not
per-caller); 2 new unit tests added. Live-verified against the real Neon
DB post-fix: a hotel panel toggled on and left blank now stores no
`hotel` key at all.

**Real process gap found and fixed along the way**: `npm test` failed
on unmodified `main` too (confirmed via `git stash`) — `vitest`/
`supertest` were listed in root `package.json` but `node_modules` was
stale, never actually installed. `npm install` fixed it; same
staleness class flagged before elsewhere in this file. 32/32 tests pass
post-fix (30 pre-existing + 2 new). Also found and cleaned up: a
leftover `falsifier-flights-...` test-artifact User row in the live
Neon DB from a prior session's Falsifier check — noted, not deleted
(not this ticket's scope, flagging for whoever does a DB hygiene pass).

**Live evidence, real deployed dev environment** (not prod yet — this
PR hasn't merged): real Clerk test sign-in (`+clerk_test`/`424242`)
against local dev server + local Neon, TRAVEL and PURCHASE submits both
confirmed via direct Prisma query to persist the new `typeDetails` shape
correctly in the actual stored DB row, not just the outgoing request
body.

**Next**: G411-64 (animation shell) is next on the spine — content
regroup is done and Reconciled, so it now has real final card boundaries
to build against. Not started yet — needs Gavi's go-ahead to pick up,
per the "no auto-advance" rule.

---

2026-08-24, later session — **G411-73 Reconciled** (dark/light mode
manual toggle, filed and finished same session, live-verified against
real production including a targeted FOUC-fix re-check). **G411-63** and
**G411-67** also Reconciled earlier this session. G411-63 and G411-67
produced real process corrections to `CLAUDE.md`, both load-bearing
going forward:

- **The "how to stop" rule** (Required workflow, checkpoint 3): a
  question buried mid-paragraph while tool calls keep running isn't a
  real stop — by the time it's answered, work has already run past it.
  Caught live: the build agent hit a genuine spec ambiguity ("what
  counts as 'closed'?"), picked a reading itself, and only documented
  it in the PR/Jira for later review; Gavi answered correctly once he
  spotted it buried in a long turn, but the code was already written.
  Fix logged in CLAUDE.md: use `AskUserQuestion` (real blocking pause,
  no further tool calls on that thread) for genuine ambiguity, every
  time — not a note-and-continue. Applies to unattended subagents too
  (hand the question back to the orchestrating session, don't resolve
  it solo).
- **decision #66** (`[You]`/`[Agentic]` tags are historical/inert,
  don't re-ask) — already recorded last handoff, unchanged.

`gavi411-commit-convention.md` also gained a new section: how to run a
**live authenticated Falsifier check** against the real deployed app
(Vercel→Render) when curl/Vitest alone can't reproduce it — `npx
playwright` driven via a throwaway Node script (no MCP browser tool
available in this session), Clerk's `+clerk_test`/`424242` dev-mode
sign-in bypass, and a button-selector gotcha (`/continue/i` matches
"Continue with Google" before the real submit button).

## Next task — none picked yet, ask Gavi

G411-67, G411-63, and G411-73 are all done. No next ticket has been
agreed — per CLAUDE.md's Required workflow checkpoint 3 ("go/no-go on
the next ticket"), do not auto-pick anything automatically. **Real
correction earlier this session**: "next" was initially read as "lowest
ticket number project-wide," which skipped straight to Parent 3 while
Parent 2 still had Open children — Gavi caught this live. Actual rule
(brain.md): flat, freely-reorderable backlog except along the
dependency spine, but stay within the current Epic (Parent 2) until its
Open children are cleared, don't jump Epics just because a lower ticket
number happens to sit elsewhere. Parent 2's one remaining Open child:
**G411-64** (intake flow visual redesign — multi-step feel +
animations, deliberately deferred until the flow was functionally
complete, which it now is).

## G411-73 — Reconciled, full record

**Filed and finished in the same session** (real gap Gavi caught live,
not in any PRD/brain.md doc): the deployed app already auto-switched
dark/light via `@media (prefers-color-scheme: dark)` in
`client/src/index.css` (landed silently as part of G411-17's
design-system foundation, never speced) — no manual override existed.
Parented under G411-2 (Requests/Intake, Implementing) since
G411-1/Foundation is already Reconciled and shouldn't be reopened for
new scope (per [[jira-set-parent-field-at-creation]] memory's standing
rule); `parent` field verified actually linked via JQL, not just
claimed.

**Built**: 3-way toggle (system → light → dark → system) via a
`data-theme` attribute on `<html>`, persisted in `localStorage`
(`useTheme.js`, new hook). Extends the existing token structure in
`index.css` — no new palette values. Built directly in-session (not
dispatched to a background agent) given the small, mechanical scope.

**Sibling review found 2 real bugs, both fixed before merge** (commit
`9b0747e`, PR #20): `data-theme` was only applied in a post-mount
`useEffect`, so a stored preference different from OS preference
flashed the wrong theme on every reload (fixed with a small
pre-hydration inline script in `client/index.html`, kept in sync by
hand with `useTheme.js`'s storage key/logic — noted in a comment since
there's no single source of truth across the two files); `color-scheme`
stayed fixed at `light dark` regardless of the explicit override, so
native form controls/scrollbars ignored a forced choice (fixed:
`color-scheme: dark`/`light` under the respective `[data-theme]`
blocks).

**Live-verified post-merge, real production, not just local preview**:
toggle cycles correctly on `gavi411-ten.vercel.app` with a real
signed-in Clerk test session (screenshots on file, sent to Gavi).
Targeted FOUC re-check: with OS emulated as light and the toggle forced
to dark, a reload shows `data-theme="dark"` and the correct dark `--bg`
value already applied at `domcontentloaded` — before React mounts —
confirming the fix actually works, not just "should work in theory."

**Left as documented tradeoff, not a bug**: the dark palette's ~15
custom properties are duplicated verbatim between the media-query block
and the `[data-theme="dark"]` block — real drift risk for a future
palette edit, flagged but not restructured (out of proportion for this
ticket's scope).

**Real (harmless) confusion mid-session, worth a note**: a scheduled
`ScheduleWakeup` fired with stale instructions referencing the
already-Reconciled G411-63 ticket, mixed in among live background
task-notifications for the actual work in progress (G411-73's review
findings). Correctly identified as stale and ignored rather than
re-running old work — but worth knowing this class of stale-wakeup
noise can happen when multiple async things are in flight.

**Jira**: Open → Implementing → Reviewing → Landed → Reconciled, all
named transitions. Gavi's go-ahead ("merge and transition to landed,
and reconcile if nothing is left") was treated as conditional
authorization for the final Reconciled move once live-verification
confirmed nothing was actually left — not skipped, but not re-confirmed
as a separate round-trip either, since the condition was explicit.

## G411-63 — Reconciled, full record

**Scope**: `server/lib/matchKeywords.js` did a raw case-insensitive
substring check, causing false positives (ticket's example: `"light"`
inside `"flights"`; real seed-data equivalents found and tested:
`"get"` inside `"forgot"`/`"budget"`, `"mac"` inside `"machine"`). Fixed
with Unicode-property lookaround boundaries (`(?<![\p{L}\p{N}])...
(?![\p{L}\p{N}])`), not `\b`/`\w` — verified `\b` is ASCII-only and
doesn't treat Hebrew letters as word characters, which would've broken
bidi text handling. Also correctly handles multi-word keyword phrases
from real seed data (`"go to"`, `"rental car"`, `"where to buy"`).

**Sibling review found 1 real bug**, fixed before merge (commit
`1ebc0dc`, same PR #19): removing the old `.toLowerCase()` call as part
of the fix silently changed `POST /match`'s behavior on missing
`freeText` — used to throw (500), now would silently 200 with
`matchedTypes: []`, masking a client bug. Fixed: added the same
`!freeText` guard its sibling route (`POST /`) already has; added test
coverage for `POST /match` (had none before, even pre-fix).

**Live-verified post-merge, real seed data, not the ticket's
hypothetical example**: 4/4 real cases against production
(`gavi411-ten.vercel.app` → Render, real signed-in Clerk test session)
— `"forgot"` no longer false-matches PURCHASE, `"machine"` no longer
false-matches TECH_SUPPORT, two real positive-match controls both
correct. Unauthenticated `POST /match` re-confirmed 401 on both the
direct Render URL and via the Vercel rewrite.

**Tests**: 28/28 (25 pre-existing + 3 new).

**Jira**: Open → Implementing → Reviewing → Landed → Reconciled, all
named transitions, Aegis fields written at pickup + closure comment
with live evidence before Reconciling.

## G411-67 — Reconciled, full record

**Scope**: request list/home screen (open requests, closed toggle,
most-recent-closed fallback, "New request" CTA) + `GET /api/requests`
(list, self/all-if-admin) + `GET /api/requests/:id` (request + real
`Message` thread — the model already existed in schema, contrary to the
ticket's own hedge) + `PATCH /api/requests/:id` (status/urgency route
shell only, no lifecycle rules — that's G411-30..36's job) + wiring the
orphaned `install-ios.md` page. Built by `agent-backend` role,
`agent-backend/G411-67-request-list` branch, PR #18.

**"Closed" definition, confirmed final by Gavi**: `CLOSED` + `CANCELLED`
+ `SELF_SOLVED`, all three group as "closed" for the toggle. This should
be treated as the working definition for future lifecycle work
(G411-30..36) unless explicitly revisited.

**Sibling review found 2 real bugs, both fixed before merge** (commit
`0fdb555`, same PR):
- Closed-requests toggle was gated on `!allClosed`, so a friend whose
  requests were *all* closed could only ever see `closedRequests[0]`
  with no way to reach the rest of their closed history. Fixed: toggle
  now renders whenever any closed requests exist; the "most recent"
  single-card fallback hides once expanded to avoid showing the same
  card twice.
- Error-state "Try again?" button was wired to `onNewRequest` (navigate
  away) instead of retrying the failed fetch. Fixed: retry button now
  re-runs the fetch via a `retryToken` state bump.

**Live-verified post-merge, not just code-inspected** (this was flagged
as a real risk since G411-16 was this same class of gap once before —
claimed-working cross-origin auth that was never actually hit):
unauthenticated `GET /api/requests` → 401 (curl); authenticated request
as a real signed-in user (Clerk `+clerk_test` test account) → 200, zero
console errors, correct empty-state render, screenshot on file. Real
production, Vercel→Render, not mocked.

**Left as lower-priority, non-blocking, for later tickets** (real, not
imaginary — noted for whoever picks up G411-30..36 or does a cleanup
pass): the owner-or-admin check and id-parsing are duplicated across
`GET /:id`/`PATCH /:id` instead of a shared helper (`server/middleware/
auth.js` already exists as a natural home); `CLOSED_STATUSES` in
`RequestList.jsx` hardcodes a frontend copy of backend lifecycle
knowledge, self-flagged in its own code comment as provisional;
`Request.updatedAt` has no `@updatedAt` directive, so `PATCH` silently
never bumps it (latent bug for future status-sorting UI); the
`role === 'ADMIN'` branch in `GET /` is currently dead code — nothing
anywhere sets a user's role to ADMIN yet.

**Jira**: transitioned Open → Implementing → Reviewing → Landed →
Reconciled, all via named transitions, Aegis Claim/Falsifier/Evidence
written at pickup and updated with live post-merge re-verification
before Reconciling. Parent 2 (Requests/Intake) correctly stayed at
Implementing (has other Open children: G411-63, G411-64) — note: G411-67
isn't linked as a formal Jira child of G411-2 (referenced textually as
"Parent 2" in its description only), worth fixing for hygiene sometime,
not urgent.

**Not yet done / worth knowing**: no admin-role-assignment mechanism
exists anywhere yet, so `GET /`'s admin branch can't currently be
exercised by a real user — whoever builds admin tooling (G411-37+)
needs this.

## Where things stand

- **Production was broken end-to-end, now fixed (G411-16 correction).**
  Live-state review (prompted by Gavi asking "did we finish writing the
  damn thing" after a Vercel 404 was found) discovered the deployed
  frontend's every `/api/*` call 404ing — Vite's dev-only proxy has no
  production equivalent, and no `vercel.json` rewrite existed pointing
  at the real Render backend. Render itself was live and correct the
  whole time (an early `curl` hit a cold-start timeout and got
  misread as "never connected" — corrected once retried with a longer
  timeout). Fixed via PR #9 (`client/vercel.json`, one rewrite rule),
  merged, verified live on `https://gavi411-ten.vercel.app/api/health`
  and `/api/requests/match`. G411-16 was already Reconciled in Jira
  without this ever being tested end-to-end — left Reconciled (the
  underlying claim is now actually true) but a correction comment was
  added rather than silently re-passing it.
- **G411-66 (sign-in UI gate) — Reconciled.** First agentic-first pilot
  (decision #62): `agent-backend` role built it unattended on
  `agent-backend/G411-66-signin-gate`, caught a real bug along the way
  (`@clerk/react` has no `SignedIn`/`SignedOut` — the ticket's own
  assumption was wrong; built with `useUser().isSignedIn` instead, no
  new dependency). Live Sibling review caught one more instance of the
  same wrong assumption in a stale `main.jsx` comment, fixed it too. PR
  #8 merged. Falsifier re-confirmed live on real production via
  Playwright right before Reconciling — sign-in gate renders correctly,
  zero console errors.
- **G411-72 (intake path fixes) — Reconciled.** A deliberate, requested
  live-state gap analysis (not doc-vs-doc, actual running code/DB
  against what's claimed) turned up three real bugs: `POST
  /api/requests/match` was reachable unauthenticated (added
  `requireAuth` as a backend backstop to `App.jsx`'s client-side gate);
  `'get'` was seeded as a keyword under both RESEARCH and PURCHASE
  (accidental duplicate — caused every "get"-containing request to
  spuriously suggest RESEARCH; removed from RESEARCH, kept under
  PURCHASE); `Trigger` had no uniqueness constraint and `seed.js` had no
  idempotency guard (a rerun would've silently doubled every row, which
  would've broken G411-42's future live trigger-editing UI). Added
  `@@unique([keyword, requestType])`, migrated live to Neon,
  `skipDuplicates: true` in `seed.js`. Scope grew mid-PR (Gavi's call)
  to also fold in two `TravelFields.jsx` UX fixes (G411-65 follow-up):
  the booking-number consent checkbox now reveals the input instead of
  just disabling it with no visible reason (unchecking clears any typed
  value), and the "Add flight" button label now reads "+ Add flight
  details" when empty vs. "+ Add another flight" once one exists.
  Wording on the consent checkbox was Gavi's own edit, satisfying the
  subjective-UX review gate directly. PR #10 merged, re-verified fresh
  against merged `main` before Reconciling.
- **Decision #63 (`gavi411-brain.md`), mid-session**: PR review policy
  corrected — Sibling review (Claude Code, live) was always meant to
  *be* the review mechanism, not a precursor to an outside human
  approval. Branch protection's "1 approval" requirement had become a
  real blocking dependency in practice (only counts write-access
  collaborators, decision #61) despite Gavi working solo. Now: **Sibling
  review passes → self-merge**, no outside approval waited on.
  `enforce_admins: false` already meant Gavi's own merges bypassed it;
  the discipline lives in the policy, not the GitHub setting. Also
  flips which side needs its own session — agentic dispatch is now the
  default, live manual pairing is the occasional case that steps into
  its own tab.
- **Gap-analysis process note, worth remembering**: Gavi pushed back
  hard mid-session on gap analysis only surfacing real problems
  reactively (via his own follow-up questions) rather than
  systematically. The fix applied was a genuine live-state sweep —
  checking actual running/deployed state (Clerk config via its real
  API, Vercel/Render live endpoints, DB constraints vs. what code
  actually writes) against what's documented/ticketed as done, not
  re-reading docs against each other. This found the invite-gating gap
  (Clerk `sign_up.mode` was `"public"`, not restricted — see G411-41's
  updated scope) and the deploy-pipeline gap above. Worth running this
  kind of check periodically, not just once.
- **G411-41 scope updated**: now owns the real invite-link mechanism
  (one-time token in the URL, e.g. `?token=...` on the app's own root —
  no separate `/signup` page, no email required up front since Gavi
  won't always know it and friends may use a different email or Google
  OAuth). G411-71 (an earlier, duplicate ticket for the same gap) was
  closed/Reconciled with a comment pointing here.
- **G411-69 scope updated**: now covers both phone number AND profile
  picture in one combined `/complete-profile` first-login flow. Real
  gap confirmed via Clerk's actual type definitions: OAuth sign-in
  copies a real photo (`hasImage: true`), email sign-in never does —
  and nothing in `server/middleware/auth.js` persisted it either way
  before this ticket. Direction: auto-save OAuth photos, prompt
  (skippable) for email sign-ups to upload one via Clerk's native
  `setProfileImage()`, and nudge everyone to confirm their photo looks
  right. Phone number: country-code selector, accepts Israeli local
  `05X...` format (not `+972...` or bare digits — Clerk's phone-auth
  doesn't support Israeli numbers at all, which is *why* this needs
  manual collection, not a reason to reject them). G411-70 (duplicate)
  closed/Reconciled with a comment pointing here.
- **Gap analysis complete.** All 31 findings from `gavi411-gap-analysis.md`
  (6 High, 13 Medium, 12 Low) are resolved or explicitly deferred with
  reasoning — full live status, per-finding resolution, and corrections
  Gavi made along the way are in **`gavi411-gap-analysis-followup.md`**,
  not duplicated here. Two Low findings (E2, E3) are deliberately left
  open pending the planned agentic-first shift (item 6 below) rather than
  acted on now. Nothing left to pick up from this list on its own.
- **G411-23 (request creation endpoint + credit deduction) — Reconciled**
  (walked Reviewing → Landed → Reconciled later the same day, with a
  fresh evidence re-check, per Gavi's explicit go-ahead). Scope grew
  mid-session: the backend endpoint Landed
  first, then `handleSubmit` (the frontend wiring that actually calls
  it) was folded into this same ticket per Gavi's call, since no other
  ticket owned it either (see brain.md decision #57 for the general
  lesson this produced: Reconciled needs the ticket's *current* full
  scope landed, not just whatever reached Landed first).
  **PR #4 review, fix, and merge (this session, later pass)**: Matan
  left two real review comments — missing `res.ok` check before
  `res.json()` in `handleContinue` (a failed match call could throw
  with no user feedback), and a missing `e.preventDefault()` on
  Enter-to-continue. Both fixed and pushed (`c6015db`) — `handleContinue`
  now guards on `res.ok`, shows an inline error on the `describe` step
  (not just `followup`, since this error can fire before the step
  advances), clears stale errors on retry; Enter now calls
  `preventDefault()` before continuing. Fixes verified live via
  Playwright (Enter still advances correctly on a real match; a
  simulated 500 on `/api/requests/match` shows the error inline with no
  crash, no unhandled console error) — replied to both threads inline.
  **Merge blocker turned out to be access, not review quality**: Matan
  (read-only at the time) left `APPROVE THANKS!` plus two actual
  `APPROVED` reviews, but `reviewDecision` stayed `REVIEW_REQUIRED` —
  branch protection doesn't count an approval from a read-only
  collaborator. Fixed by upgrading **both Matan and eldaduz to write
  access** (Eldad's was still a pending, unaccepted invite — updated the
  invitation's permission to `push` so it takes effect once he accepts).
  Once Matan's existing approval counted, `reviewDecision` flipped to
  `APPROVED` immediately, no new review needed. **PR #4 merged**
  (squash, `adb3d8e`), branch deleted (remote and local), `main`
  fast-forwarded — `handleSubmit` wiring and the review-comment fixes
  are now genuinely on `main`. The fresh combined check ran later the
  same day (transaction logic, race-condition fix, stripEmpty
  scalar+array cases, migration, handleSubmit's Playwright check, all
  re-confirmed live) and the ticket walked Reviewing → Landed →
  Reconciled with Gavi's explicit go-ahead — done, not outstanding.
  - `Request.typeDetails Json?` column (**decision #55**,
    `gavi411-brain.md`) added and migrated to live Neon this session,
    table confirmed empty first.
  - Real gap found along the way: Clerk's provider is wired (G411-13)
    but no sign-in screen/gate exists anywhere in the UI — filed as
    **G411-66**, flagged urgent, next after the current threads clear.
  - Overdraft mechanism idea (Gavi's design: "request anyway" tops
    balance to 1, consumed immediately by the same create-and-deduct
    path) captured as a Jira comment on **G411-47** for its future
    pickup, not built now.
  - **Process slip, caught and fixed**: the original backend commit
    landed directly on local `main` instead of a proper branch. Fixed
    by branching it off and `git reset --hard origin/main`-ing `main`
    back (Gavi ran this himself — the harness correctly refused to run
    a destructive reset unprompted). **Side effect worth knowing**:
    this also discarded Gavi's own uncommitted parallel `DESIGN.md`
    edit from earlier the same session — check whether that needs
    redoing. PR #3 (backend) and PR #4 (handleSubmit) both merged now —
    see the G411-23 entry above for PR #4's full story.
- **GitHub collaborator access, corrected twice this session**: added
  as read-only initially (matching their actual review-only role at the
  time), then **upgraded to write** later the same session — branch
  protection's "1 approval required" rule turned out not to count an
  approval from a read-only collaborator (Matan's `APPROVED` reviews on
  PR #4 sat there without flipping `reviewDecision` until his access was
  upgraded). **Matan: write, active immediately** (already-accepted
  collaborator). **eldaduz: write, pending** — he has an outstanding,
  unaccepted invite; its permission was updated to `push` so he lands on
  write once he accepts, not read. **Branch protection on `main`**:
  blocks force-push/deletion, requires 1 PR approval before merge, admin
  (Gavi) exempt. No CI status check required yet — no workflow exists;
  add one once G411's CI/CD ticket lands a real GitHub Actions
  workflow.
- **G411-65 (type-specific follow-up fields) Reconciled.** Merged to
  `main` via PR #1 `017e148` and PR #2 `928eb27`; Jira walked
  Implementing → Reviewing → Landed → Reconciled, Gavi's go-ahead given
  explicitly for the final transition per the hard-to-reverse rule.
  Before Reconciling, Gavi asked for a comprehensive re-check of chip
  disambiguation across all match combinations (not just what was
  already spot-checked) — 21/21 live Playwright checks passed: each of
  5 types matched alone, zero-match, the built-in dual-keyword case
  ("get" → RESEARCH+PURCHASE), a constructed 2-type combo, a 3-type
  combo, every chip-click advancing to the right followup, and "Not
  quite?"/"None of these" correctly showing the full list (no stray
  "None of these") from every entry point. Confirms multi-match
  disambiguation was never actually dropped — real, worthwhile check,
  not just a rubber stamp. Parent 2 (Requests/Intake) left as-is, not
  rolled to Done — G411-23/63/64 are still Open under it. All four
  matched-type paths
  (TRAVEL/PURCHASE/TECH_SUPPORT/RESEARCH+INFO) now render real optional
  fields instead of just Urgency+Submit; RESEARCH/INFO reuse the shared
  `additionalInfo` field (no dedicated fields per PRD). Built this
  session, one step at a time per Gavi's pacing:
  - **PURCHASE** (`PurchaseFields.jsx`): description, buy-where
    (online/in-store/both), budget, size/color/model preference,
    pickup/delivery coordination, needed-by date, item link.
  - **TECH_SUPPORT** (`TechSupportFields.jsx`): device/platform,
    what's-the-issue, what's-already-been-tried, when-did-it-start,
    does-it-happen-after-something-specific (trigger), call-vs-written
    help-style preference.
  - **RESEARCH/INFO gap resolved**: they now get the shared
    `additionalInfo` field via `GeneralFollowupFields` (a correct match
    shouldn't leave the friend with less than an unmatched one) — no
    new dedicated fields added, confirmed against Gavi that free text +
    additionalInfo is enough, no narrower field generalizes across the
    wide range of research topics.
  - **Real gap found live during this session's wrap-up, fixed
    separately (PR #2)**: a keyword match can be a false positive on
    *any* type, not just GENERAL/"None of these" — concrete case Gavi
    caught: "research vacation options" matches RESEARCH on the word
    "research" alone but is really TRAVEL-shaped. Previously only
    `GeneralFollowupFields` had a "Not quite? Pick a category" escape
    hatch once past the chip step; TRAVEL/PURCHASE/TECH_SUPPORT/
    RESEARCH/INFO followups had none. Fixed by moving that button out
    of `GeneralFollowupFields` (which now only owns the `additionalInfo`
    field itself) into `NewRequest.jsx`, wrapping every followup branch
    identically. Live-verified against the exact reported scenario.
  - **Process note**: mid-session, a rejected/interrupted tool call left
    an edit sitting uncommitted while the local `collab/
    G411-65-travel-fields` branch was already merged and behind
    `origin/main`. Resolved by stashing the edit, fast-forwarding local
    `main` to `origin/main`, branching fresh
    (`collab/G411-65-not-quite-escape-hatch`), and popping the stash
    there — cleaner than trying to rebase the old branch. Also: a
    Playwright verify pointed at a *stale dev server tab left open from
    a previous session* (port 5173, this session's servers ran on
    5174) initially looked like a real bug (RESEARCH skipping the chip
    step) — turned out to be pre-commit code still being served, not a
    regression. Worth remembering: always confirm which port/session a
    "bug you're seeing" is actually running before chasing it.
  - Prior session's TRAVEL work (`TravelFields.jsx`/`.css`,
    `DisambiguationChips.jsx`/`GeneralFollowupFields.jsx` extraction)
    re-verified live via Playwright this session before building on top
    of it — confirmed working (date fields, repeatable flight entries,
    booking-number consent gate), no bugs found.
  - Design pattern, now proven across 3 types: `EMPTY_*_DETAILS`
    exported from the owning field-component file (not duplicated in
    `NewRequest.jsx`), controlled `value`/`onChange` (component holds no
    state itself), all fields optional, `<hr>` separators only (no
    group headers), concrete questions over abstract categories, avoid
    re-asking anything free text already covers.
- **Real gap found and filed live**: while picking up G411-22, Gavi
  caught that the matched-type followup path (a real RequestType like
  TRAVEL/PURCHASE gets picked from chips) renders nothing but Urgency +
  Submit — no info field at all, just "tags" the request. Confirmed via
  JQL that no existing child of Parent 2 actually owns this — it fell
  through the cracks between G411-18/19/20/21/22/23. Filed as new
  **G411-65** (Open, not started) — needs real product-content decisions
  (what fields does TRAVEL/PURCHASE/etc. actually need?), not just
  wiring.
- **G411-22 (generic fallback field) Reconciled** (closed as subsumed
  by G411-21, no new code). Closed as subsumed, not built separately — its exact
  scope (conditional additionalInfo field, shown only on "None
  of these"/zero-match) was already fully built as an inseparable part
  of G411-21's own design (the field had to be shared/conditional to
  support the "Not quite?" override without losing typed text). Same
  code, same evidence, cross-referenced back to G411-21's own Aegis
  comment rather than re-verified redundantly. Considered merging
  G411-22 into G411-65 to cut down on near-duplicate-looking tickets —
  decided against it: they cover genuinely different work (fallback
  field vs. matched-type fields), and repurposing 22's number would mean
  rewriting its Claim/Falsifier to describe unrelated work, losing the
  accurate "already done" record. Two tickets, two different pieces of
  work, both correctly tracked instead.
- **G411-21 (disambiguation chip UI) Reconciled.** Built in the same one-step-at-a-time collaborative
  mode as G411-19/20 — real code changes stopped for Gavi's review
  before the next; status/doc updates didn't pause the flow (per his
  explicit clarification this session). Design walked through together
  live before any code: zero-match case, "None of these" vs. zero-match
  landing on different places, whether follow-up fields should be
  per-type or shared. Real flow built (4 paths, all verified live via
  Playwright): (1) real match → chips + "None of these", pick advances
  to that type's followup; (2) "None of these" → straight to full
  5-type list (not GENERAL first — an explicit rejection shouldn't
  re-show a partial list); (3) zero match → skips chips, lands directly
  on GENERAL; (4) "Not quite?" control on GENERAL reveals the same full
  list. New `Chip.jsx`/`Chip.css` component (matches `Input`/`Select`'s
  field pattern). **Also renamed `fallbackNotes` → `additionalInfo`**
  end-to-end (React state, Prisma schema, live Neon migration) — Gavi's
  own naming call, since the field is genuinely shared across every
  followup path now (single state, not per-type fields — so switching
  category never loses what was typed, no copy-over logic needed).
  Table verified empty before migrating, no data risk. `gavi411-prd.md`
  §4.1 and G411-21's Jira description both updated to match the real
  flow (superseding the simpler 2026-08-20 version, kept for history).
  **New G411-64 filed** (Open, not started): whole-flow visual/animation
  redesign — Gavi's explicit call to defer styling until the flow is
  functionally complete rather than chase a moving target (current
  implementation is one `Card` that grows per step, not the intended
  feel). All pushed to `main`.
- **G411-20 (trigger taxonomy seed data) Reconciled.** Built in one-step-at-a-time collaborative
  mode per Gavi's explicit pacing request this session — each real
  code/content change stopped for his review before the next; status
  transitions and doc updates didn't count as steps needing a pause.
  `prisma/seed.js`: 57 keyword→RequestType rows across 5 of 6 types
  (GENERAL deliberately has none — it's the fallback when nothing else
  matches). Content is Gavi's own real judgment calls, not auto-filled:
  "get" intentionally duplicated as both RESEARCH and PURCHASE (two
  Trigger rows, same keyword — reflects that Gavi finds/prices things
  but doesn't transact); "book" excluded as ambiguous/redundant;
  "returning"/"departing" considered for TRAVEL then dropped by Gavi to
  avoid a real substring collision against PURCHASE's "return" under
  the current non-word-boundary matcher (concrete example feeding
  G411-63); media nouns (ebook/movie/tv show) considered and skipped —
  existing intent words already cover the real signal. Run against live
  Neon: table confirmed empty before, 57 rows after (cross-checked via
  `grep -c` on the file vs. live DB count, exact match). Falsifier run
  via real curl calls against the live `/api/requests/match` route
  post-seed: "flight got cancelled" → TRAVEL, "get a good deal on a
  laptop" → RESEARCH+PURCHASE (confirms the dual-mapping works),
  "wifi stopped working" → TECH_SUPPORT, unrelated text → `[]`
  (correct empty match, not a false positive). All pushed to `main`.
- **G411-19 through 23 moved [You] -> [Collab] mid-session** — Gavi's
  own fallback-rule call, tired and wanting faster visible progress
  while staying involved and still writing/understanding the code, not
  a full [Agentic] handoff. Documented in CLAUDE.md's fallback-rule
  section and `gavi411-task-list-source.md`; all 5 tickets' Jira
  descriptions updated to match.
- **G411-19 (keyword-matching engine) Reconciled.** Built directly (per the [Collab] pace), Gavi
  reviewing/asking questions live rather than typing it himself line by
  line — walked through `handleContinue`, the fetch/JSON/async
  mechanics, `matchKeywords.js` logic, and the dev proxy vs. CORS
  distinction together. Built: `server/lib/matchKeywords.js` (queries
  `Trigger` table, case-insensitive substring match, returns distinct
  matched RequestTypes — deterministic, no LLM), `POST /api/requests/match`
  route in `requests.js`, a dev-only Vite proxy (`client/vite.config.js`,
  forwards `/api/*` to :3000) so the frontend can use relative fetch
  paths, and `NewRequest.jsx`'s `handleContinue` now genuinely calls it
  and advances the step. Verified end-to-end via live Playwright (real
  200 response through the full chain) and a fresh direct curl at
  wrap-up time, including a Hebrew-text check (no crash, Unicode-safe
  `.toLowerCase()`/`.includes()`). Also removed a stale "not this task:
  G411-19" line from `NewRequest.jsx`'s scope comment now that it's
  implemented — the ticket's own scope re-verified line-by-line against
  its Jira description at wrap-up per Gavi's ask, nothing missed.
  **Known gap, filed separately as G411-63** (not fixed inline, avoided
  scope creep mid-ticket): the substring match isn't word-boundary-aware
  — a keyword like "light" would false-positive inside "flights."
  Harmless today since G411-20 (trigger seed data) doesn't exist yet, so
  no real keywords are live. `ponytail:` comment in `matchKeywords.js`
  points to G411-63. Production caveat, not yet fixed (deferred by
  Gavi's call): the frontend's `/api/requests/match` fetch uses a
  relative path that only works via the dev proxy — will need an env var
  or same-origin deploy shape once G411-16-style deploy touches this
  flow; CORS is already set up as the fallback for a cross-origin deploy.
  All pushed to `main`.
- **G411-18 (intake form shell) Reconciled** (Gavi confirmed). Real, live-designed session — flow was substantially
  redesigned from the original PRD wording, live with Gavi, not built
  from a spec handed down: no live/debounce matching (runs once on
  Continue instead), single-select disambiguation chips with an
  always-present "None of these" escape hatch (not multi-select "pick
  all that apply"), fallback field conditional on "None of these" (not
  always-present), urgency asked in the shared follow-up step regardless
  of matched type. `gavi411-prd.md` §4.1 rewritten to match (old wording
  kept struck-through for history); G411-19/21/22's Jira
  summaries/descriptions updated to match (G411-20 untouched, genuinely
  unaffected); full rationale posted as a comment on G411-18.
  Built: `client/src/pages/NewRequest.jsx` (step-driven form: describe →
  chips → followup), new `Select.jsx`/`Select.css` component (matches
  `Input`'s field pattern, for the urgency dropdown), `App.jsx` now
  mounts `NewRequest` for real (was a labeled "temporary preview," this
  is what its own comment called for — no router added, single-screen
  only). Enter-to-continue wired on the free-text input. Chips
  rendering, type-specific follow-up fields, and the match/submit
  handler bodies are correctly left as comment stubs — they're
  G411-19/21/22/23's own scope, not this ticket's; verified via a live
  Playwright check that Continue correctly does NOT advance the step
  while the match-call stub is empty (proves the boundary holds, not
  faked). **Also surfaced and fixed in passing**: `Urgency` enum's
  `MEDIUM → NORMAL` rename (Gavi's call, discussed this session) had
  only ever been edited in `schema.prisma`, never migrated to live
  Neon — found via `prisma migrate status`'s false "up to date" (it
  only checks migration-folder vs. applied-migrations, not schema-file
  vs. live DB). Verified the `Request` table was empty (zero rows, real
  risk-free) before hand-writing and applying a migration
  (`prisma migrate deploy`, since `migrate dev`'s interactive mode isn't
  supported here) — confirmed live via raw enum query afterward. Also:
  `Input`/`Select`'s shared radius moved from `--radius-pill` to
  `--radius-lg` (Gavi's call — pill worked for `Button`, read as
  over-rounded on text fields). All pushed to `main`.
- **G411-10 process gap found and fixed**: the DB schema code itself was
  genuinely done and migrated to live Neon back in the G411-13 session,
  but the Jira ticket had silently sat at **Open** since then — never
  walked through transitions, zero Aegis-field comments. Caught while
  picking G411-18, per Gavi's "double check before moving on" call.
  Fixed properly, not just fast-forwarded: re-verified real state fresh
  (`npx prisma migrate status` → up to date against live `neondb`,
  schema file reviewed directly for all required entities), retroactive
  Claim/Falsifier/Evidence posted as a comment, walked Open →
  Implementing → Reviewing → Landed → **Reconciled** (Gavi's go-ahead
  given). No code changes (nothing to commit) — this was purely a
  tracking-state correction.
- **G411-14 (bidi text rendering) Reconciled.** `dir="auto"` added to `client/src/components/Input.jsx`'s
  `<input>` — the only freeform text field that exists yet (`App.jsx` is
  a throwaway preview, `Input.jsx` is the real shared primitive from
  G411-17). One-line change, `you/G411-14-bidi-input` merged to `main`
  (`805bc1d` → `5f559c1`, pushed). Verified three ways: (1) initial
  Playwright check, (2) an 8-case Playwright matrix (Hebrew-only,
  Hebrew-leading, English-leading, number+Hebrew both orders, dense
  mixed, English-only, numbers-only), (3) Gavi's own live dev-server
  check in a real browser. All correct **except** one real, expected
  limitation: densely-alternating Hebrew/English/number strings (e.g.
  "CAN YOU לעזור לי TO למצוא 45 THINGS") don't visually read as clean
  prose — standard UAX#9 run-reordering behavior, not a bug. Real fix
  would be `unicode-bidi: isolate` wrapping per embedded run, which
  requires the text to already be *segmented* into per-language chunks —
  **impossible to do reliably for arbitrary user-generated freeform
  text** (no safe general segmentation exists). Explicitly out of scope,
  logged as a `ponytail:` ceiling comment on the ticket, not pursued.
  Jira: Open → Implementing → Reviewing → Landed → **Reconciled**
  (transition to Landed was blocked once by the permission classifier
  mid-session, retried successfully after Gavi's own check — flagged
  live rather than silently retried/skipped; Landed → Reconciled done
  after Gavi's explicit go-ahead, per the hard-to-reverse rule).
- **G411-17 final polish**: system-font fallback stacks rendered
  inconsistently across OS/devices. Loaded real Google Fonts — Google
  Sans (weight 600) for the "Gavi411" wordmark only, Rubik for
  everything else — via `<link>` in `client/index.html`, `--wordmark`/
  `--sans` tokens in `index.css`. Verified via Playwright (computed
  font-family, real glyph render, zero console errors), confirmed good
  by Gavi. Commits `df973e1`, `79471ce`. Still Reconciled, no reopen
  needed — Jira comment added recording the change.
- **G411-15, G411-16, G411-17 all Reconciled.** Gavi caught a real
  process gap: G411-17's design direction (dark green primary, serif
  headings) self-merged clean (green build) without ever being checked
  against Gavi's actual intent — he'd given 16 reference images, the
  subagent picked a direction unilaterally. Corrected live together:
  gold/amber primary (from the actual budget-tracker inspo image), sage
  green demoted to secondary accent, serif dropped entirely (sans
  everywhere), an invented "Save for later" button removed, CTA
  centered. Iterated on saturation/lightness using **Playwright**
  (newly installed as a `client` devDependency this session — no
  headless-browser tool existed before, made visual verification
  painfully indirect/unreliable). New standing policy in
  `gavi411-commit-convention.md`: **subjective-judgment children**
  (visual/design/copy/UX) always need Gavi's own eyes before merge,
  regardless of ownership tag — a clean build was never evidence of a
  correct design call. G411-15/16 also fully verified live via
  Playwright (SW confirmed `active`, zero console errors on both
  Vercel/Render); caught and fixed a stale-purple `theme-color` leftover
  from before the palette correction. All pushed, redeployed, confirmed
  live matches locally-approved screenshots exactly.
- **Session-boundary rule for `[Agentic]` work, decided this session**:
  `[Agentic]` subagent work always runs in a separate Claude Code
  session from `[You]`/`[Collab]` pairing — never backgrounded inside a
  session doing live pairing, confirmed painful when 15/16/17 ran
  backgrounded during live G411-14 prep and the transcripts became
  unreadable (all subagents' raw tool calls interleave into the same
  transcript — no true isolation from inside one session). Documented in
  `CLAUDE.md` and `gavi411-commit-convention.md`. G411-14 itself has not
  started yet as a result — this was the reason the session paused on it.
- **G411-13 Reconciled** (Clerk OAuth wiring). Full chain: `agent-backend`
  subagent built middleware/wiring against placeholder keys first → real
  `.env`/`client/.env` symlinked in from the main worktree (new setup,
  see `gavi411-commit-convention.md`) → **G411-10 finally migrated**
  (`npx prisma migrate dev --name init` against live Neon — was open
  since G411-10's original session) → live Sibling review caught
  `@clerk/clerk-react` as npm-deprecated, swapped to `@clerk/react` →
  that swap wasn't a safe drop-in (v6 dropped `SignedIn`/`SignedOut` for
  `<Show when="signed-in"|"signed-out">`, caught via a real white-screen
  regression, fixed via Clerk's actual migration docs) → re-verified live
  end-to-end **twice** (real browser sign-in → `/api/me` → 200) → merged
  to `main` → **post-merge `client/` build failed** on `main` because
  `node_modules` there was stale relative to the newly-merged
  `package.json` (`npm install` fixed it; documented as a new
  merge-back staleness risk, same class as the pre-launch one). Jira
  walked the full Open→Reconciled path with two separate evidence
  rounds recorded as comments.
- **New process from this session**: `.env` files are gitignored so
  they're invisible across worktrees by default — real files live in the
  main worktree, symlinked into each agent worktree
  (`ln -sf .../Gavi411/.env .../Gavi411-agent-<role>/.env`, same for
  `client/.env`). Documented in `gavi411-commit-convention.md` along with
  a subagent-launch checklist (check worktree staleness, merge `main` in,
  re-symlink `client/.env` if `client/` didn't exist before) and a
  parallel-launch safety rule (only run subagents side by side when file
  scopes genuinely don't overlap).
- **New `agent-frontend` role/worktree** added (`../Gavi411-agent-frontend`,
  `agent-frontend@gavi411.local`) — none of the existing 5 roles fit
  G411-15 (PWA). Scoped narrowly to client-side *infra* only (build
  config, service worker) — frontend product UI stays `[You]` as before,
  this doesn't reopen that boundary.
- **G411-12 Reconciled.** Scaffold merged to `main` (commit merges
  `you/G411-12-vite-scaffold`), Jira walked Open → Implementing →
  Reviewing → Landed → Reconciled via named transitions, Aegis fields
  posted as an issue comment, evidence (`npm run build`) re-run fresh at
  close, not carried over. Also corrected two doc mistakes found this
  session while resuming G411-12: (1) Collab-task scaffold ownership was
  recorded backwards ("Gavi scaffolds" — fixed to "Claude scaffolds, Gavi
  drives logic"); (2) RTL/Hebrew scope was overstated as full page-layout
  RTL support — corrected to bidi text rendering only, scoped to any
  freeform text field (input or display) on either side of the app, not
  friends'-input-only and not a page-mirroring pass. See `gavi411-brain.md`
  decision #22. G411-14's Jira summary/description updated to match.


- **All 62 Jira issues (52 Tasks + 10 Epics) now have real Descriptions**,
  populated in one batch by a background agent from ONLY the existing
  source docs (`gavi411-prd.md`, `gavi411-task-list-source.md`,
  `gavi411-jira-tree.md`, `gavi411-jira-aegis-template.md`) — no invented
  scope or acceptance criteria. Each Task description has three parts:
  **Scope** (from task-list-source, with owner tag), **Detail** (PRD
  excerpt cited by section, e.g. "per PRD §4.4" — or an explicit "no
  additional PRD detail beyond scope above" where the PRD is thin), and
  **Not covered by this task** (explicit boundary to sibling tasks).
  Zero API errors, zero skipped. Spot-checked G411-30 and G411-11 against
  their source docs directly — both accurate, no fabrication found.
  Reason this was done: Gavi flagged real ambiguity about what tasks
  actually include; this closes that gap using only what already existed,
  rather than writing new spec on the fly.
  - `CLAUDE.md`'s session-start ritual (step 3, pick-the-task) now
    includes a staleness check: re-verify a task's Description against
    the PRD/task-list-source before starting work, since if those source
    docs change later, the batch-written description could drift stale.
  - Committed along with the rest of this session's doc changes —
    commit `fd068d1`.

- **"Wrap it up" rewritten as an enforced checklist** (`CLAUDE.md`): the old
  prose version let steps silently drop — confirmed this happened to
  G411-11's Jira transition, which sat unmoved across multiple sessions
  even after the codeword was said twice. Replaced with an 8-step
  checklist ending in a mandatory ✓/✗ report line, so a skipped step is
  visible in the same turn instead of discovered later. This is a *process*
  fix only — nothing auto-runs; it still depends on the codeword being
  said and every step actually being executed correctly, same as before.
- **Aegis-spec.md finally read directly this session** (was cited but never
  opened before). Corrected a real misunderstanding: Jira's workflow has
  **five** states, not four — `Aegis-spec.md` §4.1 defines Open →
  Implementing → Reviewing → **Landed** → Reconciled. Landed = merged/live,
  not yet reconciled against acceptance criteria; Reconciled = acceptance
  formally re-checked against landed state (§5.5) — the true terminal
  "Done."
- **Live Jira workflow fixed to match the spec**: the board had a `Landed`
  column with 0 issues and no transitions into it. Gavi added the missing
  named transitions in Jira workflow settings and published: Open —Start
  Implementing→ Implementing —Move to Review→ Reviewing —Reviewing →
  Landed→ Landed —Landed → Reconciled→ Reconciled, plus a global "Any →"
  on all five statuses (including Landed, the one gap). Confirmed live via
  the Jira transitions API against G411-11.
- **G411-11 status re-verified, not re-decided**: still `Reconciled` (was
  already closed out in an earlier session, per this file's prior
  version — this session just re-confirmed it live rather than assuming).
  Checked routes/requests.js against the source backlog doc: it's still
  comment-stubbed, and correctly so — the real route logic belongs to
  G411-23 and G411-30..36 (separate `[You]` tasks, different Epic), not
  G411-11's scope. `CLAUDE.md`'s "Current state" section updated to say
  Reconciled instead of stale "in progress."
- **Branch/PR/review policy, ownership split, context-signal policy**: all
  still live as documented in `CLAUDE.md` — unchanged this session.
- Folder naming is **`server/`** and **`client/`** — `client/` scaffold
  landed per recent commits (572a423), not yet built out further.

## Open threads / nothing currently blocking

**Nothing blocking.** G411-23, G411-66, G411-72, G411-16 all confirmed
Reconciled live in Jira this session (not assumed from a prior note).
Gap-analysis followup done (see `gavi411-gap-analysis-followup.md`,
E2/E3 Low deliberately left open, tied to the agentic-first shift).

**Known gap, not blocking, recorded**: `gavi411-brain.md` decision #65 —
Repowise's per-role git-identity provenance wasn't actually fed for
G411-66/G411-72 (built via GitHub PR, not the persistent worktree +
`git-as-agent-*` switch this project's convention calls for). Not
retroactively fixed; the launch checklist that should prevent a repeat
is in `gavi411-commit-convention.md`, use it properly on the next launch.

Also still outstanding from an earlier session: Gavi's uncommitted
parallel `DESIGN.md` edit was discarded by a `git reset --hard` fixing a
branching slip — check with him whether that still needs redoing, this
has been carried forward a few sessions now without resolution.

## Next on the spine

Foundation (G411-10–17), G411-18–23, G411-65, G411-66, G411-16, G411-72
all Reconciled. **G411-67 is next** — see "Next task" at the top of this
file for full pickup instructions (it's the live agentic-first pilot #2).

**After G411-67, in order:**
1. **G411-68** (request-access homepage form) and **G411-69**
   (post-signup profile completion, phone + photo) — both Open, both
   real gaps found via the 2026-08-23 gap analysis, neither picked up
   yet. Check for overlap with G411-41 at pickup (both tickets' own
   descriptions flag this).
2. Previously tracked, still deliberately deferred: G411-47 (overdraft
   — mechanism folded into its Description per gap-analysis finding
   F3), G411-63 (word-boundary matching), G411-64 (visual/animation
   redesign).
3. Agentic-first workflow itself is now live, not just decided — G411-66
   was pilot #1 (Reconciled), G411-67 is pilot #2 (see "Next task"
   above). Two guardrails still apply every ticket (decision #60,
   restated as concrete checkpoints in `CLAUDE.md`'s Required
   workflow): major decisions come to Gavi before being acted on, and
   every completed chunk gets a real rundown — never auto-advance to
   the next ticket without his go-ahead.


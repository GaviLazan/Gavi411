# Gavi411 — Full Project Audit

Audited 2026-09-17 · Fable-model audit, orchestrated by Sonnet · Read-only, no changes made

## Executive summary

**The month is over.** The project started 2026-08-17; the audit ran 2026-09-17 — the entire "~1 month" budget is already spent, and the app is still mid-build (Notifications and Messaging epics both *Implementing*, Testing/CI-CD epic *Implementing* with its one real child still *Open*, Copywriting epic still fully *Open*). This is the single most important fact for planning: there's no runway left to "finish properly," only runway to triage what's must-ship vs. cut.

Overall health is good relative to the time crunch. The test suite is real and green (543/543, verified with a fresh run), the Aegis/Sibling-review discipline has repeatedly caught genuine bugs before merge (including two false "task complete" agent reports), and Jira largely reflects reality.

**Biggest risks, in order:**
1. **No CI/CD pipeline exists at all** — an explicit course/PRD requirement, completely unbuilt one month in.
2. **A real, working, tested feature (unread-notification dot) is sitting merged-nowhere** on an open PR — zero risk, pure loose end.
3. **E2E encryption is in a genuinely ambiguous state** — flag-gated dormant code, an unresolved architecture redesign, and no realistic path to "finish it properly" in whatever time is left.
4. **Copywriting and a real UI/UX pass are both still fully open** — every user-facing string in the app is still placeholder, one month in.

**E2E bottom line:** recommend formally cutting it for v1, not leaving it in "paused, revisit if time remains" limbo. The plan looks ready-to-build but still has real unanswered design questions, and a full resume-to-ship would cost real days that don't exist.

## Plan gaps / half-built features

### No CI/CD pipeline exists — High
`.github/workflows/` does not exist on disk. G411-53 ("GitHub Actions CI pipeline") is the sole remaining child under Epic 8, still Open — the reason that epic is stuck at Implementing. This is an explicit course requirement (PRD §1/§7: "must demonstrate... CI/CD"), not a nice-to-have, and it's completely unbuilt one month in.
- **What would need deciding:** minimum scope (lint+test on PR is the bar; a deploy gate is a stretch); whether this stays "collaborative" per the PRD's original ownership split, given how little runway is left.
- **What would need building:** one `.github/workflows/ci.yml` running `npm test` (and ideally the client build) on push/PR to `main`. Small, mechanical, low-risk — a strong Haiku candidate once Sonnet pins the exact trigger/step shape.

### G411-103 (unread-notification dot) built and tested, unmerged — Low severity, but a real loose end
Commit `56110de` on branch `you/G411-103-unread-dot`, PR #119 open against `main`, confirmed NOT an ancestor of `main` via `git merge-base --is-ancestor`. Jira correctly shows Landed (built, awaiting merge — the correct Aegis state, not a mismatch).
- **What would need deciding:** nothing.
- **What would need building:** nothing — merge it.

### G411-106 / G411-107 scoped and locked, zero code written — Low
Both Open under Epic 7, both have Gavi-locked scope (sessionStorage-based view-restore-on-refresh; soft-clear notification history, no confirm step). The ambiguity work is already done.
- **What would need deciding:** nothing further.
- **What would need building:** both are small, well-specified — good Haiku candidates.

### G411-105 (Vercel-only permalink slowness / apparent render loop) uninvestigated — Medium
Filed with real repro evidence (10s+ first load, 1.5s+ repeat, a repeating minified stack trace consistent with a render loop). A second live observation logged the same day: after a permalink resolves, the URL bar reverts to bare origin instead of staying on `/r/<publicId>` — flagged as possibly expected (no real router exists) but never confirmed either way.
- **What would need deciding:** whether this merits a dedicated investigation session given the timeline, or gets accepted as a known rough edge for course submission — the ticket itself notes it reproduces prod-only, not locally, which is a real productivity sink to chase blind.
- **What would need building:** nothing until root-caused. The ticket's own suggested next steps (React DevTools Profiler on the live Vercel tab; check whether `App.jsx`'s permalink effect — gated on 5 pieces of settling auth/role state — re-fires multiple times) are a reasonable start.

### Copywriting pass (Epic 9) not started — Medium-High, time-sensitive
G411-54/55/56 all Open; G411-77 ("Full UI/UX pass") also Open. PRD §6.4 explicitly defers this "to a dedicated milestone late in development" — that milestone hasn't started, and "late in development" is now.
- **What would need deciding:** the actual replacement term for "ticket"/"request" (the PRD's one remaining open question, §9); how much time is left to spend on tone polish vs. leaving placeholder strings for submission (a defensible cut — the PRD itself frames copy as decoupled from logic).
- **What would need building:** a single audited pass over user-facing strings — small if scoped tight, large if allowed to become a general polish pass.

### Confirmed NOT gaps (verified end-to-end, not just present)
Spot-checked several PRD Must/Should items rather than trusting titles: **private notes** (G411-40) — real `Note` model + admin-only routes + a real Notes tab in `RequestDetail.jsx`, genuinely wired. **Credit balance display** — confirmed wired, handles the 0-balance edge case. **Notification history + unread-count route** (G411-98) — real model, 4 routes, real screen; only the *badge* consuming the unread-count route was the G411-103 gap above. No other checked feature turned up backend-only, UI-only, or stubbed.

Guest requests, reminders, auto-Shabbat, tips link, and post-close reaction all correctly live under G411-57 (V2/Stretch) and are NOT counted as gaps — the PRD explicitly defers them.

## E2E encryption assessment

**Current mechanical state:** `E2E_ENABLED = false` (twin client/server config), gating every encrypt/decrypt/device-link call site off without deleting any code. Messages are plaintext-in-DB. This part is genuinely done and verified — not itself a gap.

**Is the plan coherent and buildable?** Partially. The core reframe — one escrow mechanism instead of two (device-linking + escrow) — is a real simplification with sound reasoning, and it correctly identifies that it removes the exact code paths behind 3 of the 4 known findings from the last live review. But the plan doc **names its own open design questions and never answers them**:
- The exact day-to-day mechanism for a second device (specifically admin's phone+PC) acquiring the passphrase — not designed.
- Whether admin needs literal simultaneous multi-device or a simpler "most-recent-wins" rule — not asked.
- Passphrase storage/retrieval UX for a non-admin friend's second device — not asked.

None of these are small. The multi-device question in particular is the kind of thing that reshapes the data model — "not designed" three items deep into a doc that's otherwise being treated as ready-to-build is a real gap beyond what the doc admits to.

**Real remaining cost to resume, concretely:**
1. Answer the 3 open design questions with Gavi — a real scoping conversation, not a quick call.
2. Build the actual escrow-only mechanism: remove the device-linking tables, rebuild "any device becomes live via passphrase," rebuild the admin approval UI.
3. Re-flip the feature flag and re-verify every notification/permalink/polling call site built *during* the pause — none of these have ever been exercised against live encryption.
4. Fix the known gap that images were never encrypted, contradicting the original design intent — flagged as real and separate from the architecture question, still unaddressed.
5. Re-test the full live round-trip end to end again (only ever verified once, briefly, before the pause).
6. Resolve the ticket-disposition backlog the plan doc itself flags as not yet actioned.

This is realistically **several real sessions** of design-then-build-then-verify work, not a quick resume — and it touches code that has drifted further from the paused state with every feature built since.

**Recommendation:** given the month is already elapsed and core epics are still mid-build, formally deprioritize/cut E2E for v1 now rather than leave it in "might resume" limbo. Concretely: log a decision that E2E is off the table for the course submission; resolve the open ticket backlog the plan doc is waiting on; leave the encryption-at-rest fallback ticket as-is unless E2E is ever actually resumed. **This is Gavi's call to make** — flagged here as the audit's recommendation, not as an action taken.

## UI/UX findings — design-director critique

Gavi's call: every issue in this section is in scope for the finish, no triage ordering.

Method: dual-agent (A: design review, Fable · B: detector + browser evidence, Sonnet). Friend flow viewed live as the test account at 390×844 and 1280×800, light + dark; admin surfaces source-reviewed only.

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Bare "Loading…" text, no skeletons; presence only shown when offline; no unread indicator anywhere; post-submit gives no forward status |
| 2 | Match System / Real World | 2 | Raw ISO dates on review; timestamps with seconds on every bubble; internal enum labels ("Resolved Pending Confirmation", "Waiting On User") shown to friends |
| 3 | User Control and Freedom | 3 | Back/discard-confirm/click-to-edit are good; no browser-back (Android back exits the PWA); Clerk modal is a visual language switch |
| 4 | Consistency and Standards | 1 | Three button systems (pill / native / text) and two radius systems coexist; `--color-border` referenced in ProfilePage + UserManagement.css but the token is `--border`, so those borders silently don't render |
| 5 | Error Prevention | 3 | Confirm modals, type-to-delete, busy guards, overdraft path all present |
| 6 | Recognition Rather Than Recall | 2 | No step indicator or card titles in intake; card 4 (bookings) has no heading; review's dashed "locked" rows read as disabled |
| 7 | Flexibility and Efficiency | 2 | No in-app routing; Open/Closed are two menu items not one toggle; admin sort/filter/group is good |
| 8 | Aesthetic and Minimalist Design | 2 | Header wraps and clutters every screen; friend detail stacks Back + Cancel pills above content |
| 9 | Error Recovery | 3 | Try-again + inline alerts exist; but two hardcoded reds plus uncolored error text in MessageThread/NotificationHistory |
| 10 | Help and Documentation | 1 | Install help is a raw markdown dump (`**`, backticks, ticket IDs, "ponytail: placeholder" footer) shown to friends; no first-run "why" |
| **Total** | | **21/40** | **Acceptable** — solid mechanics, unfinished skin |

### Design Specificity Verdict

**Interchangeable, with one authored moment.** Strip the wordmark and this is a generic form/ticket app with a yellow button. Nothing in the UI shows Gavi as a person — no avatar, no presence face, no "last replied"; the only presence signal is a plain text line that appears when he's *offline*. The home screen is wordmark + one pill + ~90% empty cream. List cards are `freeText` + grey `Status · Type`, a helpdesk row. The one genuinely authored piece is the intake step machine (free text → gold chips → per-type cards → click-to-edit review) — that's the concierge idea made structural, and it's the best thing in the app. The "Concierge's Ledger" brief is sound; the execution is where it fails, because roughly half the surfaces (Profile, CompleteProfile, InviteAdmin, TriggerAdmin, AdminCreateRequest, the header Sign out) render unstyled native controls beside the pill system.

**Deterministic scan:** 1 CLI finding — `side-tab` at `client/src/pages/NotificationHistory.css:22` (3px gold left border as unread marker). Deliberate and commented, but it does match the exact "AI-UI tell" pattern the rule targets; keep the intent, change the marker (a dot or bold title alone). Browser overlay ran successfully on 5 signed-in mobile views + 1 desktop: every view flagged **low-contrast text on the header username link**, and the notifications view flagged **"overused font: arial (35%)"** — that second one needs verification, since it implies Rubik isn't applied (or hasn't loaded) on part of that screen. Signed-out landing was clean. The detector and the design review agreed independently on contrast; the detector missed everything structural (native controls, header layout, buried compose).

### Overall Impression

Under the hood this is more careful than most student apps — cancelled fetches, StrictMode-safe token claims, reduced-motion fallbacks, `dir="auto"` everywhere, a dark mode that's real (and honestly looks better than light). But the visual layer stops about 60% of the way: the intake is finished, everything around it isn't. The single biggest opportunity is a one-pass "make every screen use the same four components" sweep plus fixing contrast — that alone moves this from "student project" to "real app."

### What's Working

1. **The intake step machine.** One question per card, matching runs once on Continue, chips highlight-then-confirm, Skip/Continue label flips by content, 250ms slide with reduced-motion fallback. This *is* the product.
2. **Dark mode is first-class.** Every token has a dark value, pre-paint script avoids flash, and gold on `#212327` hits 9:1. The dark review screen is the best-looking shot in the set.
3. **Defensive state handling.** Confirm modals on destructive statuses, type-name-to-delete, busy-guarded double submits, aria-live armed after first paint so history isn't read aloud.

### Priority Issues

**[P0] White text on gold fails contrast everywhere.** `#fff` on `#f2a900` = **2.01:1** (AA needs 4.5:1; even large-text AA needs 3:1). Hover gold 2.57:1. Gold text on white (secondary buttons, status pill, "Mark unread") = 2.01:1. Sage Submit 2.58:1, lavender Back 2.98:1. Every CTA in light mode is illegible for low-vision users and washes out in sunlight — the actual phone-in-hand usage scene. *Fix:* ink text (`#221f19`) on gold fills (~10:1) as the dark theme already does; for gold-as-text, darken to ≥ `#946600` or switch outline buttons to ink/taupe text. → `/impeccable colorize`, then `/impeccable audit`.

**[P0] The header is broken on every screen.** "994 credits" wraps to two lines, Sign out is a browser-default button, username is an underlined 14px link at 80% opacity, ☰ is 22×24px (below the 44px target) floating top-left with nothing aligned to it. Identical on desktop. *Fix:* a real app bar — ☰ with 44px hit area · wordmark · avatar chip opening Profile; credits and Sign out move into Profile/menu. → `/impeccable layout`.

**[P1] Unstyled native controls on Profile, CompleteProfile, and every admin tool.** Profile is centered `Label: value` lines with grey Chrome buttons and a red-text Delete; CompleteProfile — the very first screen a new friend sees — is the same; TriggerAdmin/InviteAdmin/AdminCreateRequest are bare lists/forms with inline `#ccc` borders; UserManagement uses 4px-radius inputs and hardcoded `#ffe0e0/#d32f2f`. Plus the `--color-border` vs `--border` token mismatch. *Fix:* route all of these through the existing `Card`/`Input`/`Select`/`Button`; fix the token name. → `/impeccable polish` (Profile/CompleteProfile), `/impeccable harden` (token audit).

**[P1] Friend RequestDetail buries the primary action.** Order is Back → Cancel request → details card → Copy link → messages → compose. On the test thread the compose bar was a full screen below the fold. "Cancel request" sits above content at equal weight to Back — an easy destructive mis-tap. *Fix:* thread first or sticky bottom compose; collapse details into a status strip; move Cancel behind an overflow. → `/impeccable layout`, then `/impeccable shape` if the thread becomes the page.

**[P1] Post-submit and first-run are undesigned.** Both are a single sentence. Post-submit is the peak-end of the entire product ("Thanks — your request is in!" + one button) with no request card, no presence, no "open thread." CompleteProfile has no "why we need your phone" and no sign of who Gavi is. *Fix:* post-submit shows the new request card + status + Gavi's presence + "Open thread"; CompleteProfile gets one line of why and Gavi's face. → `/impeccable onboard` (first-run), `/impeccable delight` (post-submit).

### Persona Red Flags

**Casey (one-handed mobile):** ☰ is a 22×24px target in the top-left — the corner furthest from the thumb. "+ New request" is in the top third. The reply box on a request needs ~1700px of scrolling; "Cancel request" sits above the content at equal weight to Back. Credits meaning is `title`-tooltip only — invisible on touch.

**Jordan (first-timer / the aunt):** First screen is a native form with no explanation. "Installing on iPhone" is a wall of raw markdown. Review screen's dashed boxes look disabled. "In Queue" / "Waiting On User" / "Resolved Pending Confirmation" are jargon. After submitting, nothing says what happens next.

**Sam (keyboard / screen reader):** Tab order on the describe step focuses the × exit *before* the input. `.field-input:focus` sets `outline: none` with a 12%-alpha gold glow (~1.1:1 — effectively invisible); `.chip:focus` has no custom style. "Mark unread" button is nested inside an interactive `<li role="button">`. `LockedField`'s accessible name has no "edit" verb. ☰ has `aria-label` but no `aria-expanded`. Wordmark is `<h1>` on home and `<button>` elsewhere, so heading structure shifts per view.

**Alex (admin power user, source only):** AdminList is the strongest admin surface (persistent sort/filter/group, lazy search, status/urgency/age column). No keyboard shortcuts, no bulk actions; status `Select` resets to "Change to…" so current state isn't shown in the control; "has notes" signal absent from Details because Notes lazy-loads on tab click.

### Minor Observations

- Free-text step is a single-line `<input>` for what is often a story — placeholder truncates, long text scrolls horizontally. Use the compose bar's existing auto-grow textarea.
- Message timestamps show full date + seconds on every bubble; group by day, show time only.
- Only icons in the app: ☰, a 📷 emoji, and →. No status color anywhere — every status is grey text.
- `.review-help { margin-top: -22px }` is a magic-number fix.
- `#root`'s hairline `border-inline` at 1126px frames a 420px column on desktop — ~60% of a 1280px viewport is empty framed cream.
- "Offline — replies may be delayed" is an unstyled `<p>`; should be a chip with a dot.
- Notification items: 8px radius inside a 20px card; "Mark unread" at 13px gold (2:1).
- `.step-viewport { overflow: hidden }` clips the card shadow on the right edge.
- Layout holds at a 200%-zoom proxy (no horizontal scroll) — that's a real pass.

### Questions to Consider

- What if the home screen *was* the conversation with Gavi — one continuous thread with each request as a pinned card — instead of a form launcher plus separate lists?
- What if presence were a face, not a sentence: Gavi's avatar in the app bar with a dot, tap for "usually replies in…"?
- What if credits were "favors this month" with a small ring, rather than a wrapping number needing a tooltip?
- What if status were spoken in Gavi's voice ("I've got it", "Working on it", "Waiting on you", "Done — confirm?") — the copy pass is planned, but the *design* of status as a colored chip should land now so the copy has a home.
- What if the intake asked "Who is this for?" — many concierge asks are on behalf of a parent or kid.

### Evidence

Screenshotted (149 files, `scratchpad/critique-a/`): sign-in, home, menu, theme toggle, every intake step incl. focus states and discard modal, open/closed lists, request detail + thread + compose, Profile + phone editor + delete-confirm (cancelled), notifications, install help, forced loading/error/offline-banner states; all at mobile + desktop, light + dark, plus a 200%-zoom proxy. Detector overlays (`scratchpad/critique-b/`): 5 mobile views + 1 desktop, signed in. **Source-reviewed only:** all admin screens, CompleteProfile (test account already has a phone), post-submit screen (nothing was submitted), empty-list state, push-permission dialog. **Not checked:** real iOS Safari / installed PWA, actual screen-reader output, Render cold-start latency.

### Aesthetic pass — "does it look ugly?"

**Not ugly — unfinished.** A well-tokened wireframe: palette, radius and type are defensible, but nothing has been composed. In order of how loudly each reads as "student project":

1. **56px wordmark on every screen.** A landing-page hero, not an app bar; on a phone it takes the top ~30% of the viewport, with a tiny ☰ orphaned above it at a completely different scale. Shrinking it to ~22px in a compact bar changes the feel of the whole app more than any other one-line edit.
2. **Everything floats, nothing anchors.** Centered wordmark, centered pill, centered cards on empty cream; no left edge, no top or bottom bar. Home is a logo and one button. It feels placed, not built.
3. **Everything is loud.** 18px body, 600-weight labels and chips, bold card titles — all near the same size. Every list card is the same shape (bold line, grey line, empty padding); ten in a row is monotonous. There's no quiet secondary layer (13px taupe metadata, a timestamp, a status dot) for the bold layer to sit against.
4. **Three accent colors on one row.** The review screen — lavender outline Back, sage Submit, gold elsewhere — is the ugliest moment in the app; gold + purple + green at equal weight reads like a default UI kit. One accent: Back becomes a plain text button, Submit uses the primary (or ink), sage only for success states, lavender retired.
5. **Murky card shadows.** A big soft blur plus a hairline border, on cream, under white — a grey halo along the bottom edge of every card, visible in the list screens. Pick one: hairline only, or a 1–2px shadow. Dark mode looks better partly because the shadow vanishes.
6. **Mustard.** `#f2a900` with white text reads as a warning banner, not gold. The hue is fine; the white text and flat expanse aren't. Ink text on the same gold (as dark mode already does) immediately looks more expensive; a slightly deeper amber for large fills is worth trying — a brand call, not a bug.
7. **Native leaks on first screens.** Grey Chrome Sign out, the Profile screen, raw `**markdown**` on the install page — one native button inside a pill system reads as "the developer stopped here."
8. **Zero visual identity.** No icons, avatar, illustration, photo of Gavi, or empty-state art; the only glyphs are ☰, an emoji camera and →. This — not the layout — is why it reads generic.
9. **Desktop is three nested widths.** A 420px column inside a 1126px hairline frame inside a 1280px viewport, ~60% empty framed cream. Drop the outer frame or use the width.

Caveat: test data ("asfasf", "test request with credit use") makes every screen look ~20% worse than it will with real content. Already good-looking: the chips step, the dark review screen, the message bubbles' asymmetric radius. **This needs a compose pass, not a redesign.**

## Finish-line plan

**Reality check:** the ~1-month budget is fully elapsed. This changes the framing from "sequence toward a clean finish" to "triage what's genuinely required for course submission and real usability, and formally cut the rest."

### Must-fix before this can be called done
1. **Merge the pending unread-dot PR** — zero-risk, already tested, purely an unactioned merge go-ahead. Do this first, costs nothing.
2. **Build the CI/CD pipeline** — explicit course requirement, currently 100% unbuilt. Smallest correct version: one workflow file running `npm test` on push/PR. Cheap and a stated grading criterion — should not wait.
3. **Formally decide and log E2E's disposition** — not building anything, just closing the ambiguity so it stops being a standing "might resume" tax on every future session.
4. **A bounded copywriting pass** — at minimum, resolve the one real open PRD question (the "ticket"/"request" term) and sweep the already-flagged dev-facing strings. Full tone polish is explicitly cuttable, but some pass is warranted since every string in the app is currently placeholder and this is graded, user-facing work.

### Should-fix, real but smaller
5. The two already-scoped-and-locked notification tickets (view-restore-on-refresh; soft-clear history) — small, well-specified, quick wins if a session is available.
6. The two older open tickets from live testing (friend home screen reconsideration; sort-by-urgency mislabel).
7. A small accessibility pass on the hamburger menu — bounded, matches work already done elsewhere.

### Nice-to-have, cuttable for v1
8. The Vercel-only permalink slowness investigation — real but low-frequency and admittedly hard to reproduce blind. Cut or timebox strictly if picked up.
9. The UI/UX pass — superseded by Gavi's call after the design-director critique: every issue in the UI/UX section above is in scope, no triage ordering. It should run before the copywriting pass, since the status chip, app bar, and post-submit screen give the new copy a home.
10. The E2E/escrow-only rebuild — recommend cutting entirely rather than treating as nice-to-have.

### Sequencing (what blocks what)
- Merging the pending PR costs nothing and unblocks nothing else — do it immediately just to clear the loose end.
- CI/CD has no dependencies — can run in parallel with anything else, and should be prioritized precisely because it's cheap and explicitly graded.
- The E2E disposition decision doesn't block other work either way, but should happen early so it stops consuming planning attention in every subsequent session.
- The copywriting pass should come **after** any remaining functional tickets that touch user-facing strings — otherwise the copy pass gets partially redone.
- The remaining small tickets are independent of each other and of the above — parallelizable across sessions if time allows.

**Bottom line:** the app is in genuinely good shape for the time invested — the review discipline has caught real bugs before they shipped, and the core product loop (intake → messaging → lifecycle → credits → admin cockpit → notifications) is fully built and reconciled. The two things most likely to cost real points or real usability if left as-is are the missing CI pipeline and leaving E2E in permanent limbo instead of making the call. Everything else is finishing touches, not architecture.

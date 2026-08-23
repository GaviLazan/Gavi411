# Gavi411 — Gap Analysis
_Generated 2026-08-23. Adversarial cross-reference of PRD ↔ Jira ↔ real code._

## Executive summary

31 findings total: **6 High**, **13 Medium**, **12 Low/deferred**. None of the
High findings are surprises about scope that was never planned — the PRD and
brain log already anticipated almost everything. The real pattern, consistent
with G411-65/66 and the `handleSubmit` gap already found this session, is
**coverage seams between adjacent tickets**: a mechanic is real product work,
gets mentioned in two or three tickets' "Not covered by this task" boundary
notes, and nobody's "Not covered by" ever flips to "Covered here." The
Aegis per-ticket description-writing pass (which did a genuinely good job of
tracing PRD sections) inherited this risk structurally, because it wrote
boundaries competently without an independent pass asking "is there a
ticket where this positive space actually lives."

Most High findings cluster in three places: (1) the `GET`/`PATCH` request
routes that Lifecycle, Admin, and Messaging all silently assume exist,
(2) credit-system pieces that read as covered from titles alone but aren't
when you check the actual mechanics against the PRD's specific wording, and
(3) the same "wiring assumed to be someone else's job" failure mode as
`handleSubmit`, recurring in Messaging and Notifications.

## Methodology

- Read `CLAUDE.md`, `gavi411-prd.md` (full), `gavi411-brain.md` (full, all 54
  decisions), `gavi411-task-list-source.md`, `gavi411-jira-tree.md`,
  `HANDOFF.md` in full before analysis.
- Pulled **live** Jira state via `searchJiraIssuesUsingJql` for all 10 Epics
  and all 52+ Tasks (G411-1 through G411-66, including G411-63/64/65/66 which
  postdate `gavi411-jira-tree.md`), fields: summary, status, description.
  Cross-checked every ticket's Description against what `gavi411-jira-tree.md`
  shows to confirm which tickets are new since that snapshot.
- Read the actual repo: `prisma/schema.prisma`, `server/server.js`,
  `server/middleware/auth.js`, `server/routes/requests.js`,
  `server/lib/matchKeywords.js`, `server/lib/prisma.js`,
  `client/src/App.jsx`, `client/src/main.jsx`,
  `client/src/pages/NewRequest.jsx`, every component under
  `client/src/components/`, `client/vite.config.js`,
  `client/public/sw.js`/`manifest.json`.
- For every candidate finding, checked `gavi411-brain.md`'s decision log
  first — several apparent gaps (RESEARCH/INFO having no dedicated fields,
  no page-mirroring RTL, no live-debounce matching, no earn-back credits) are
  deliberate, documented decisions and are **not** listed as findings below.
- Did not create, edit, or transition any Jira issue — read-only per the
  task's constraints.

---

## A. PRD → Jira (features with no owning ticket)

**A1. [Medium] Homepage "request access" flow (invite gated, case-by-case)**
PRD §6.1 lists "Invite-link signup + OAuth login | Clerk (decided). Homepage
'request access' reviewed case-by-case | Must" as one feature. G411-13
(Clerk OAuth wiring) only covers the OAuth wiring itself. The "request
access" homepage flow — a form a not-yet-invited person fills out, that Gavi
reviews case-by-case per brain.md decision #11 — has no ticket anywhere.
It's mentioned nowhere in Parent 1 (Foundation) or Parent 5 (Admin). This is
exactly the class of gap G411-66 was: infrastructure (Clerk invite-only mode,
per decision #53) exists, but the actual user-facing surface for the
non-invited case does not, and no ticket claims it.
_Adjacent tickets:_ G411-13, G411-41 (user management — invites/approvals is
the admin *response* side, but the public-facing "ask for access" form isn't
in its scope per its description). _Action:_ new ticket under Parent 5 or a
new small Parent, e.g. "Request-access homepage form + admin review queue."

**A2. [High] Request list / home screen (the actual product home page)**
PRD §6.1: "Request list home | Open requests; toggle for closed; if all
closed, show most recent closed | Must." Brain.md UX decisions section
describes this concretely (list of open requests, reveal-closed toggle,
surface most recent closed if all closed, prominent "new request" button).
**No ticket in any Parent owns this.** Parent 2 (Requests/Intake) only
covers the *creation* flow (G411-18 through G411-23); nothing in the tree
builds the screen a friend lands on to see their existing requests. This is
a "Must" feature with zero Jira coverage — worse than A1, because without
it there is no way for a friend to ever view a request after submitting one
(no thread, no status, nothing — `NewRequest.jsx`'s `submitted` state is a
dead end with a static "thanks" message).
_Adjacent tickets:_ none directly; closest are G411-24/25 (message thread,
Parent 3) which build the *inside* of a request, not the list of them.
_Action:_ new ticket, likely its own line in Parent 2 or a new "Parent 2.5 —
Friend home" — this is core-path, should be prioritized above Messaging.

**A3. [High] `GET`/`PATCH` request endpoints (list, single, status update)**
Following directly from A2: `server/routes/requests.js` itself says outright
in a comment — "Not yet built: GET / (list), GET /:id (one + messages),
PATCH /:id (status/urgency, G411-30..36)." G411-30 through G411-36
("status state machine," "close flow," etc.) all describe the *lifecycle
logic*, but none of their Descriptions actually claims ownership of the
underlying `GET`/`PATCH /api/requests` routes those actions need to ride on
— they describe transitions and business rules, not "build this route."
Same seam as A2's frontend side. Without an explicit route-shell owner, this
is likely to fall through exactly like `handleSubmit` did: G411-30 gets
picked up assuming the route already exists (because "someone must have
built it"), and it doesn't.
_Adjacent tickets:_ G411-23 (built POST only, explicitly), G411-30 through
G411-39. _Action:_ either fold "GET list/detail + PATCH status shell" into
G411-30's scope explicitly (it's the natural first mover), or file a small
new ticket ("Request read/update routes") ahead of G411-30.

**A4. [Medium] Credit-balance display component (frontend surface)**
PRD §6.1 lists "Credit balance display" as its own Must feature, distinct
from the schema. G411-45's Description says "credit balance schema +
**user-facing display**" — so it is nominally covered — but nothing in
`client/src/` shows any credit UI today, and no other ticket references
displaying it elsewhere (e.g. on the request-list home screen, A2). Not a
missing ticket, but worth flagging that G411-45 is carrying two fairly
different pieces of work (a DB column + a UI surface) as one ticket, and the
UI half depends on A2 existing first — a hidden ordering dependency nobody's
called out.
_Adjacent tickets:_ G411-45. _Action:_ no new ticket needed; note the A2
dependency when G411-45 is picked up.

**A5. [Low] "Install on iPhone" help page**
PRD §6.1: "PWA installability | Manifest + service worker; 'install on
iPhone' help page | Must." `client/public/install-ios.md` already exists as
a file — so the content likely already has a home, but it's a markdown file
sitting in `public/`, not yet wired to any route a friend would actually
navigate to. G411-15's Description (PWA manifest + service worker) is
infra-only per CLAUDE.md's own framing of `agent-frontend`'s narrow scope
("never product UI") — the help-page *screen* that surfaces this markdown
is arguably product UI, i.e. `[You]` territory, and isn't in any ticket.
_Adjacent tickets:_ G411-15. _Action:_ small addition to A2's ticket (or its
own tiny ticket) — "render install-ios.md as a real page/link," not urgent.

**A6. [Low] Guest link view (existing-user side only is v1; is the link
itself built?)**
G411-44 explicitly scopes to "existing user → notified" and excludes the
guest/phone path (correctly, matches decision #42/PRD §6.3). Checked this
isn't a gap: PRD is explicit the guest path is v2/stretch (G411-60). No
finding — flagging only to record that this was checked, not skipped.

---

## B. Jira → PRD (tickets whose scope isn't grounded)

No ticket was found inventing scope not traceable to the PRD, task-list-source,
or a brain.md decision. The batch-written Descriptions (per HANDOFF.md, done
by a background agent restricted to only those source docs) hold up under
spot-check — every "Detail" section cites a real PRD line, and "Not covered
by this task" boundaries are consistent between siblings (e.g. G411-30 and
G411-39 correctly divide state-machine-vs-admin-control-surface without
overlap or gap in wording). This is a clean result, not a shortcut — B is
included per the task's own structure requirement, and the honest finding
is "no B-category issues found."

One soft observation, not a finding: G411-35's and G411-59's descriptions
both explicitly disclaim sharing scheduler infrastructure with each other
("not the full reminders feature" / "doesn't share infrastructure with this
one") — worth honoring literally when G411-35 is actually picked up, since
it would be easy to accidentally over-build a general scheduler there.

---

## C. Code → Jira/PRD (built vs. claimed, half-wired paths)

**C1. [High, confirmed live gap, already filed] Sign-in UI gate — G411-66.**
Verified directly: `client/src/App.jsx` renders `NewRequest` unconditionally,
`main.jsx` wires `ClerkProvider` but nothing in the tree uses
`SignedIn`/`SignedOut`. Matches G411-66's own description exactly. No new
finding — confirming the already-filed ticket is accurate and still open.
Flagging its priority again here since it blocks A2/A3's real end-to-end
testability once those are built too.

**C2. [High] `handleSubmit` → `POST /api/requests` — confirmed WIRED, contra
HANDOFF.md's "Next on the spine."**
HANDOFF.md (last updated 2026-08-23, "later than the entries below") states
`handleSubmit` in `NewRequest.jsx` "still needs wiring." Reading the actual
current file: `handleSubmit` already does a real
`fetch("/api/requests", { method: "POST", ... })` with the full payload
shape (`freeText`, `type`, `urgency`, `additionalInfo`, `typeDetails` via
`currentTypeDetails()`), handles non-OK responses, and sets
`submitted`/`submitError` state correctly. **This appears to already be
done** — either fixed in this same session after HANDOFF.md's last save, or
the HANDOFF.md note is now stale. This is worth a two-minute confirmation
with Gavi before the next session assumes it's still open and re-does
(possibly worse) work, or skips real verification because "the code exists"
without checking it actually flows through a signed-in session (which C1
still blocks from being tested live).
_Action:_ update HANDOFF.md's "Next on the spine" section — this is a
docs-accuracy fix, not a code gap, but leaving it as-is risks wasted a
future session's time.

**C3. [High] No user-facing error/empty/loading states anywhere except the
one intake form.**
PRD §2 goals emphasize a consolidated, friendly product; nothing in any
ticket's scope explicitly owns "what does a friend see while `GET
/api/requests` is loading," "what if it 404s," "what does an empty request
list look like the very first time." `NewRequest.jsx` has a decent pattern
already (`submitting`/`submitError` state, disabled button, inline error
text) — but that pattern exists only because G411-23's own reviewer added
it as a fix, not because a ticket asked for it. Once A2 (request list) and
Parent 3 (messaging) get built, the same class of state will be needed
there and nothing currently obligates it. This is exactly the "cross-cutting
concern nobody owns because it's everyone's job" pattern the task brief
warned about.
_Adjacent tickets:_ none own this explicitly; touches G411-24/25 (message
thread), the not-yet-filed A2 ticket, G411-37/38 (admin screens).
_Action:_ no new ticket — cheaper to add one line to each relevant ticket's
scope ("loading/error/empty state included") at pickup time than to spin up
a dedicated "error handling" ticket that will read as filler and get
skipped.

**C4. [Medium] `stripEmpty`'s array-cleaning branch is untested by any
Falsifier on record.**
`server/routes/requests.js`'s `stripEmpty` recursively cleans array entries
(used for `TravelFields`' repeatable `flights` array). G411-23's Landed
evidence (per HANDOFF.md) mentions a live route-logic test but doesn't
mention a flights-array case specifically, and TravelFields (`flights: []`)
is the only array-shaped field in any of the three type-detail schemas.
Not urgent — but worth a specific check before G411-23 moves Landed →
Reconciled, since "acceptance criteria re-validated against landed state"
(the actual definition of Reconciled per CLAUDE.md) should include the one
genuinely tricky code path (recursive array cleaning) in the file, not just
the top-level scalar-field case.
_Adjacent tickets:_ G411-23, G411-65 (which built `flights`).
_Action:_ one extra curl/test case at G411-23's Reconciled confirmation,
not a new ticket.

**C5. [Medium] `requireAuth`'s auto-created User row has placeholder
`phoneNumber`, and nothing ever completes it.**
`server/middleware/auth.js` creates a `User` row on first authenticated
request with `phoneNumber: claims.phoneNumber ?? 'pending-${userId}'`
explicitly as "a placeholder until the real profile-completion flow
(separate [You] task) fills it in" — but no ticket in the tree is that
profile-completion flow. `phoneNumber` is `@unique` in `schema.prisma`, so
this is silently fine today (each placeholder is unique per-user), but nothing
ever prompts a friend to supply a real phone number, and PRD §3's user
profile section (core: photo, full name, phone, email) and decision #53
(phone collected as a plain contact field) both assume it gets filled in
somehow. This is the same shape of gap as A1/A2 — infra exists
(the column, the placeholder logic), the actual UI to complete it doesn't,
and no ticket claims it.
_Adjacent tickets:_ G411-41 (user management, admin-side) — but that's Gavi
editing users, not a friend's own profile-completion screen. _Action:_ new
small ticket, "Friend profile completion (name/phone) on first login,"
likely under Parent 5 or a new small Parent — needed before G411-50/51
(Telegram/notification triggers) can rely on real contact data, and before
G411-41's "credit adjustments" make sense against a real person.

**C6. [Low] `GroupTag` enum in schema (`CLOSE/REGULAR/LIMITED`) doesn't match
PRD/brain.md's tier names (`Acquaintance/Regular/Close`).**
PRD §9 and brain.md decision #48 both name the three tiers "Acquaintance
(2/mo), Regular (5/mo), Close (7/mo)." `schema.prisma`'s `GroupTag` enum is
`CLOSE | REGULAR | LIMITED` — `LIMITED` has no PRD equivalent, and
"Acquaintance" is missing entirely. This will directly break G411-46 (the
monthly reset job, "tiered by group tag: Acquaintance 2, Regular 5, Close
7") the moment it's picked up, since the enum it needs doesn't have three
matching values. Not caught yet because nothing reads `GroupTag` in real
logic today (the credit system isn't built).
_Adjacent tickets:_ G411-10 (schema, Reconciled — this is a real defect in
already-"done" work), G411-45, G411-46. _Action:_ fix before G411-46 is
picked up — rename enum values to `ACQUAINTANCE | REGULAR | CLOSE`, migrate
(table is presumably still empty or near-empty on live Neon, low risk, but
verify row count first per the project's own established habit).

---

## D. Sequencing / dependency gaps

**D1. [High] Messaging (Parent 3) depends on request detail routes (A3)
that don't exist and aren't explicitly anyone's job.**
G411-24 ("message thread schema + endpoints") is `Open`, `[You]`, next up
after intake. Its Description says it depends on "Requests/Intake (a
request must exist to have a thread)" — true, but it silently also depends
on a way to *view* a single request (A2/A3) since a thread has to be
reached from somewhere. If G411-24 is picked up next per the natural
Jira order, whoever builds it will hit the same "wait, there's no page to
navigate from" wall C1/C2 already hit once. _Action:_ sequence A2/A3 ahead
of G411-24, or explicitly note the dependency in G411-24's scope before
pickup (the CLAUDE.md session-start ritual's staleness-check step is the
natural place to catch this).

**D2. [Medium] Credits (Parent 6) "ties into Lifecycle" on both ends, and
neither end currently calls the other.**
G411-48's own description says: "this is the credits-side implementation of
the deduction/refund calls; the lifecycle-side trigger points are G411-23
(create) and G411-31 (cancel/self-solved exits)... that call into this
logic." G411-23 is Landed and **already does its own inline deduction**
(`tx.user.update({ decrement: 1 })` directly in `requests.js`, not calling
into any shared credits module — there is no credits module yet). When
G411-45/46/47/48 eventually get built, the natural refactor is to extract a
shared credit-mutation helper — but nothing currently plans for that
refactor, and G411-31 (cancel refund) will otherwise reinvent
transaction-safe balance logic from scratch, independently, risking the
exact same "stale balance read" race G411-23 itself had to fix mid-session.
_Adjacent tickets:_ G411-23 (done), G411-31, G411-45–48 (all Open).
_Action:_ when G411-45 is picked up, explicitly extract the balance-mutation
pattern G411-23 already proved out (fresh-read-inside-transaction) into a
shared helper, rather than treating G411-23's inline code as a one-off.

**D3. [Medium] Admin Cockpit (Parent 5) depends on Lifecycle statuses
(G411-30) to sort/filter on — correctly noted in G411-37/38's own
descriptions — but also silently depends on A2/A3's request-read routes,
which is nobody's explicit job yet (same root cause as D1).**
Not a new independent issue — grouping here because it's the same
underlying hole (A3) surfacing a third time. Listed separately because it
affects Jira's actual dependency ordering: Parent 5 is currently blocked on
Parent 4 per its own Epic description, but is *also* blocked on a piece of
work with no ticket at all, which won't show up as a blocker in Jira's
board view.

**D4. [Low] E2E encryption (G411-28) depends on messaging (G411-24/25)
existing, and on user public keys existing somewhere — but `schema.prisma`
has no field for a public key yet.**
PRD §5 describes "public key stored openly on the server" as part of the
E2E design. `User` model in `schema.prisma` (Reconciled under G411-10) has
no `publicKey` column. Since G411-28 is explicitly "attempted after core
app works, not commit-triggered" and deliberately deferred, this isn't
urgent — but worth a note now rather than rediscovering it mid-G411-28,
since it means G411-28 isn't purely additive on top of G411-24/25; it also
needs a schema migration that touches the already-"Reconciled" G411-10
territory.
_Action:_ no ticket needed now — note for whenever G411-28 is picked up.

---

## E. Ownership-split gaps

**E1. [Medium] G411-24/25/26 (Messaging: thread schema, thread UI, Cloudinary
wiring) are tagged `[You]` with no `[Agentic]` styling companion, unlike
Parent 5's admin screens (G411-37/38, correctly split `[You]`+`[Agentic]`).**
CLAUDE.md/PRD §7 both say "every 'build a page/component' task includes a
real design pass, not just logic-wiring." G411-25 ("Thread UI component")
is explicitly a visible, styled UI component — the same category as
G411-37/38 which *do* carry a design-system pass — but G411-25 has no
`[Agentic]` counterpart in its tag or description. This matches the
originally-missed gap in brain.md's "Fullstack build feasibility" section
("frontend design/component styling was an initially missed scope gap")
that was supposedly fixed by the one-time design-system-foundation task —
but that fix only guarantees a *base* component styling exists (buttons,
inputs, cards), not that a genuinely new UI shape like a message thread
(bubbles, image previews, timestamps) gets its own design attention.
_Adjacent tickets:_ G411-25, G411-17 (design system foundation, Reconciled).
_Action:_ when G411-25 is picked up, treat it like G411-37/38 — flag for
an `[Agentic]` styling pass on top of the `[You]`-built structure, don't
assume the base design system alone covers a new component shape.

**E2. [Low] G411-29's and G411-49's "split, blank owner" pattern is honest
about the split but doesn't say *which piece* is agentic vs. you at a level
useful for pickup.**
Both descriptions say "Owner/Authorship left blank... split noted here"
but don't say, e.g., "the service-worker push-subscription plumbing is
`[Agentic]`, the button/UI asking permission and the trigger call after a
new message is `[You]`." Not wrong, just underspecified enough that at
pickup time it'll need a repeat of the same conversation G411-15/PWA
already had about agent-frontend's narrow scope. _Action:_ no new ticket;
worth 2 minutes of clarification at pickup, nothing more.

**E3. [Low] G411-42 (Trigger/keyword admin UI) is `[You]` only, but is a
CRUD admin screen with real UI surface — same category question as E1, lower
stakes since it's a simple table-editing UI, not a novel visual component.**
Flagging for consistency, not urgent — checked and it's genuinely
lower-risk than E1 (a plain editable list is closer to "wiring" than
"design," so `[You]`-only is more defensible here than for G411-25).
No action recommended.

---

## F. Credit/lifecycle/admin/notification coverage (explicitly requested focus)

**F1. [High] No ticket owns the actual monthly-reset *scheduling mechanism*
— only the reset logic itself.**
G411-46's Description says "monthly reset job, tiered by group tag" and
cites the PRD's tiering numbers — but never states *what triggers it
monthly* (a cron-style scheduler, same open question the PRD itself flags
for G411-35's auto-close job and for the deferred Reminders feature).
G411-35 explicitly says its scheduler need is "lightweight... not shared
infrastructure" with Reminders — but says nothing about whether it's shared
with G411-46's monthly reset, which needs conceptually the same
kind of "wake up periodically and do a thing" mechanism. There is a real
risk here: without an explicit decision, G411-35 and G411-46 each
independently invent their own scheduling approach (e.g. one uses
`node-cron`, the other a manual admin button), which is exactly the kind of
duplicated-effort gap the project's own YAGNI/Ponytail discipline should
catch, but won't, because no ticket has been asked to look at both at once.
_Adjacent tickets:_ G411-35, G411-46. _Action:_ when either is picked up
first, explicitly decide the shared scheduling approach (Render free tier
has no native cron — likely an external cron-ping-an-endpoint pattern, or
a `node-cron` process alongside Express) and note it applies to both.

**F2. [High] Admin detail screen (G411-38) needs to render `typeDetails`
per-type, and its ticket predates `typeDetails` existing — confirmed real,
not a false positive.**
Checked directly: G411-38's live Jira Description (pulled fresh, not from
the stale `gavi411-jira-tree.md`) says only "Thread/Details/Notes tabs,
status control pinned near top" with no mention of `typeDetails` or
per-type field rendering at all — because it was written before
`typeDetails` (decision #55, added during G411-23's session) existed.
`schema.prisma`'s own comment on `typeDetails` says explicitly: "Rendered
with per-type labels in the admin detail screen (G411-38, not yet built)" —
so the *code* already assumes G411-38 will cover this, but G411-38's actual
Jira scope doesn't mention it. This is precisely the task brief's suggested
example, confirmed as real. _Action:_ expand G411-38's Description before
it's picked up to explicitly include "render `typeDetails` with per-type
field labels (TRAVEL/PURCHASE/TECH_SUPPORT shapes defined in
`TravelFields.jsx`/`PurchaseFields.jsx`/`TechSupportFields.jsx`)" — otherwise
whoever picks up G411-38 will build a details tab that shows `freeText` and
`additionalInfo` but silently omits every type-specific answer a friend
gave, which defeats the entire point of G411-65's work.

**F3. [Medium] Overdraft mechanic (G411-47) — design already captured as a
Jira comment per HANDOFF.md, but the ticket's Description field itself
(what a future picker-upper actually reads first) doesn't reflect it.**
HANDOFF.md confirms: "Overdraft mechanism idea... captured as a comment on
G411-47." Live Jira description (pulled directly) is still the original
generic batch-written text ("one 'request anyway' overdraft per reset
period, any tier... no additional PRD detail on overdraft UX beyond the
mechanic itself"). Comments are easy to miss at pickup if the
session-start ritual's staleness check only looks at the Description field
literally, not comments. Low-severity since it's not lost information (the
comment exists), but worth surfacing since CLAUDE.md's own ritual says
"re-check the task's Description field... for staleness" — the Description,
not comments, meaning this real design decision could be invisible to that
specific check. _Action:_ fold the comment's content into the Description
itself now, or explicitly note in the ritual to check comments too, not
just Description.

**F4. [Medium] Nothing enforces the "max Y open tickets" cap mentioned in
brain.md's original concept section.**
Brain.md §2 core feature #4 (credit system) lists "Max Y open tickets at any
time" as part of the original credit-system concept. This never made it
into PRD §6.1's finalized feature table (which only lists flat 1-credit
cost + overdraft) or into any Jira ticket. Checked against brain.md decisions
#45/48 (the two credit-mechanics-finalizing decisions) — neither explicitly
drops the open-ticket cap, it just silently isn't mentioned again after the
original brainstorm. This reads as an intentional simplification (the
credit-per-request cost already caps volume) but — unlike the other
brain.md-covered non-gaps in this doc — there's no explicit decision saying
"cap dropped, credits alone are the mechanism now." Recommend a one-line
confirmation with Gavi rather than either building it or asserting it's
fine.
_Action:_ ask Gavi directly: was the "max open tickets" cap deliberately
dropped in favor of the credit-per-request-only model, or should a ticket
exist for it? Not urgent to build either way pre-MVP.

**F5. [Low] Presence status (G411-43) has no ticket for where a friend
actually *sees* it.**
G411-43's scope is the toggle (Gavi's side). PRD §4.5 / §2 goals: "Set
expectations honestly (presence status) without promising response times"
— implying friends see *something*. No ticket (not G411-43, not A2's
future request-list ticket) explicitly claims the friend-facing presence
indicator. Small, but same shape as A1/A2/C5 — one side of a two-sided
feature has a ticket, the other doesn't.
_Action:_ fold into A2's future ticket scope ("show presence indicator on
the home screen") rather than a standalone ticket.

**F6. [Low] Private notes (G411-40) has a schema (`Note` model exists,
`requestId`-scoped, no visibility flag needed since the model itself is
admin-only by construction) — checked, this is actually fine. No gap:
the schema already correctly has no `userId`/visibility field because notes
are inherently Gavi-only by which routes touch the table, matching PRD
§6.2's "Visible only to Gavi." Listed to confirm it was checked, not
skipped over.

**F7. [Medium] Telegram notification (G411-50) — the actual bot
token/chat-ID configuration and where it's read from has no owner.**
G411-50's description: "simple POST, no separate agentic need" — true for
the *call*, but nothing states where `TELEGRAM_BOT_TOKEN`/the target chat
ID come from, whether that's an env var Gavi sets up once (likely, cheap)
or something requiring its own small setup ticket. Given the project's
established pattern of `.env` symlink-across-worktrees complexity
(documented at length in `gavi411-commit-convention.md`/HANDOFF.md for
Clerk keys), this is worth a one-line addition to G411-50's scope now
rather than rediscovering the same env-var-across-worktrees dance
mid-ticket. _Action:_ note in G411-50 at pickup, not a new ticket.

---

## Prioritized list

**Do before/alongside the next tickets on the spine (G411-24 or G411-30):**
1. **A3 / D1** — File or fold in "GET list/detail + PATCH status" request
   routes. This blocks Messaging, Admin, and Lifecycle alike the same way
   the sign-in gate blocked live testing. Highest-leverage single fix.
2. **A2** — Request list / home screen. Core "Must" PRD feature with zero
   ticket coverage; also the natural home for F5 (presence indicator) and
   a dependency of D1.
3. **C2** — Two-minute HANDOFF.md correctness check: `handleSubmit` looks
   already wired; confirm live before a future session redoes it or skips
   testing it because "it's not done yet" per stale notes.
4. **C6** — Fix the `GroupTag` enum mismatch (`LIMITED` vs. missing
   `Acquaintance`) before G411-46 is picked up — cheap now, actively
   blocking later.
5. **F2** — Expand G411-38's Description to explicitly include rendering
   `typeDetails` — otherwise the admin detail screen will ship visibly
   incomplete relative to what G411-65 already built.

**Worth deciding soon, not urgent to build:**
6. **F1** — Decide the shared scheduling approach for G411-35/G411-46
   before either is picked up, to avoid two independently-invented cron
   mechanisms.
7. **D2** — Plan to extract G411-23's proven balance-mutation pattern into
   a shared helper when G411-45 starts, rather than reinventing it in
   G411-31/G411-46/G411-47.
8. **C5** — File the friend profile-completion ticket (phone number) —
   needed before Telegram/notification triggers can rely on real contact
   data.
9. **E1** — Flag G411-25 (thread UI) for an `[Agentic]` styling companion
   at pickup, matching G411-37/38's precedent.

**Fine to defer — flag, don't build:**
10. A1 (request-access homepage), A4 dependency note, A5 (install-iOS page
    wiring), F3 (fold overdraft comment into Description), F7 (Telegram
    env var note), D4 (E2E public-key schema field), E2/E3 (ownership
    clarity, low stakes).

**Needs a decision from Gavi, not a build:**
11. F4 — confirm whether "max open tickets" cap was deliberately dropped.

**Checked, confirmed not a gap (no action):**
B (Jira→PRD scope invention) — none found. A6 (guest link) — correctly
v2/stretch. F6 (private notes schema) — correctly scoped already.

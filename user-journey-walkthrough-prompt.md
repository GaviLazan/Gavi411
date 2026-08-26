# User journey walkthrough — find silently-assumed gaps

Read `gavi411-prd.md`, `gavi411-brain.md`, and the full live Jira backlog
(all G411 issues, not just Open ones — a step can be "covered" by a
Reconciled ticket, that's fine, the point is confirming it actually is).

For each journey below, walk it **step by step, in order, as if you were
about to build a demo script**. For every single step, answer explicitly:

1. **Who does this** (which actor — friend, Gavi-as-admin, or the
   system itself)?
2. **What screen, route, button, or API call makes this step happen?**
   Name it specifically. If the PRD or brain.md describes the step in
   prose ("Gavi creates an invite", "the admin approves...", "the system
   notifies...") but there's no concrete UI/route/mechanism behind that
   prose, that is a gap — even if it sounds like something that obviously
   must exist. Do not accept "existing flow" or "already covered" as an
   answer without finding the actual ticket/code that builds it.
3. **Which Jira ticket owns building this step?** Cite the key. If none
   does, say so explicitly — do not fold it into "probably covered by
   ticket X" without checking X's actual description for that scope.
4. **Is that ticket's status consistent with the step actually working
   today?** (e.g. a step needs a Reconciled ticket to really work now;
   an Open ticket means the step doesn't work yet, which is fine as long
   as it's accounted for, not silently assumed done.)

Do not stop at the first gap in a journey — walk the ENTIRE journey to
completion even after finding one, since gaps can stack (a missing step
can hide another missing step further down that nothing exercises yet).

## Journeys to walk

1. **Friend, cold start**: has no invite yet → ends up a fully signed-in
   user with a completed profile, able to submit a request.
2. **Friend, existing user**: signs in → submits a request → gets a
   reply from Gavi → sees a notification → replies back.
3. **Gavi, inviting someone**: decides to invite a specific person (not
   via the request-access queue) → that person ends up signed in.
4. **Gavi, request-access queue**: a stranger with no invite asks for
   access via the homepage form → Gavi reviews → approves or declines →
   if approved, that person ends up signed in.
5. **Gavi, day-to-day triage**: opens the admin view → sees open
   requests sorted/filtered → opens one → replies → changes its status
   → closes it.
6. **Gavi, promoting a second admin** (if ever needed): identifies which
   user should become admin → grants it.
7. **Friend, credit lifecycle**: has some credit balance → it decreases
   on request submission → resets on schedule → hits zero → sees the
   overdraft option.
8. **Messaging security, either fallback or target design** (whichever
   is actually being built): a message is sent → stored → later read
   back → (if E2E) a friend loses their device and needs recovery.
9. **Any other journey implied by the PRD's feature table (§6) that
   isn't one of the above** — check the table itself for anything not
   yet walked.

## Output

One table per journey: step | actor | concrete mechanism | owning ticket
| status | gap (yes/no + one-line why). Then a final flat list of every
gap found across all journeys, each with a one-line severity judgment
(blocks a whole journey / partial workaround exists / cosmetic).

Do not propose fixes or file tickets yet — this is a find-and-report
pass only. Flag it back to Gavi for a decision on what to do with each
gap, per this project's own rule that scope/ownership decisions aren't
made unilaterally.

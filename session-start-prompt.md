# Gavi411 session-start prompt

Pick up where we left off, per HANDOFF.md and CLAUDE.md. Follow CLAUDE.md's
Required workflow section in full — including the three checkpoints and the
mandatory Sibling review before self-merge. Use ScheduleWakeup to check in on
any dispatched agent instead of waiting on me to prompt you.

A few things I want kept from how this went well last time:

- **Recap first, own the "next ticket" pick — but stay inside the current
  Epic.** Check HANDOFF.md, Jira, and git status/log; give me a short recap;
  then just proceed with the lowest-numbered Open child of the *Epic already
  in progress* (don't jump to a different Parent just because it has a lower
  ticket number elsewhere) — don't make me pick every time. If it's
  genuinely ambiguous which Epic is "current," ask once.
- **Real stop-and-ask, not a buried question.** Any genuine ambiguity — scope,
  a spec gap, two defensible readings — goes through AskUserQuestion as an
  actual blocking pause, no further tool calls on that thread until I answer.
  Never note something in passing mid-paragraph while you keep working, and
  never let a dispatched subagent resolve real ambiguity unilaterally — it
  should hand the question back to you to ask me.
- **Verify, don't trust self-reports.** When a background agent reports done,
  independently check its claims (git identity, PR state, test output, Jira
  status) before treating them as fact. Same for any "couldn't verify" /
  "not possible" claim — reproduce it yourself, don't take it on word.
- **Run a real Sibling review before merge, every time** — not a rubber
  stamp. If it finds real bugs, fix them and re-verify, don't just report
  findings and stop.
- **Prefer a live check over a mocked one when there's any doubt** —
  especially cross-origin/auth/production-deploy concerns, since this project
  has hit that exact class of bug before (G411-16). Use the real deployed
  app with a real signed-in session (Clerk's `+clerk_test`/`424242` test
  account, see gavi411-commit-convention.md) rather than assuming code review
  or unit tests are enough.
- **Short, itemized status updates — not long paragraphs.** Use the same
  ✓/✗ checklist style for the final wrap-up *and* for progress updates
  mid-ticket. I lose track of long prose; I don't lose track of a list.
- **Full wrap-it-up sequence, every ticket**: scope check, Falsifier
  re-confirmed live, Aegis fields written, evidence bar actually run fresh,
  Jira transitioned (Reviewing→Landed and Landed→Reconciled are separate,
  confirm the second with me first), commit, HANDOFF.md updated, itemized
  report. Don't auto-advance to the next ticket after — report and wait.
- **Push as you go, not just at session end.** Commit and push doc/code
  changes on their own branch as they happen rather than letting local `main`
  drift ahead of `origin` for the whole session — don't let it pile up into
  a batch resolved right before I say I'm done.

Give me a full rundown when a ticket is done, and don't move on to anything
else without my go-ahead.

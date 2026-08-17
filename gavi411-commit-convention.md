# Gavi411 — Commit Convention for Subagent Provenance
 
Grounded in Repowise's actual attribution mechanism (github.com/repowise-dev/repowise
README + repowise.dev/guides/agent-provenance): it reads git history alone,
via four signal classes. This convention is designed to feed all four
correctly.
 
## What Repowise reads
 
| Signal class | What it reads |
|---|---|
| Account identity | Bot account identity / service email address |
| Commit metadata | Commit-message footers and co-author trailers |
| Merged-PR evidence | Branch prefixes and PR-body markers |
| Confidence handling | A human follow-up commit inside an agent's PR gets its confidence downgraded automatically |
 
## Convention
 
**Commit author email** — use one consistent, distinct address per agent
role, not per session. This is the strongest signal Repowise reads.
 
- `gavi@` — your own manual commits (default git identity, no change needed)
- `agent-backend@` — backend/logic subagent
- `agent-design@` — design/styling subagent (Impeccable-driven passes)
- `agent-test@` — test-scaffold subagent
- `agent-e2e@` — E2E encryption subagent
- `agent-cicd@` — CI/CD and deploy subagent
(These don't need to be real mailboxes — `git config user.email` just needs
to be set per-worktree/session before that agent commits. A local-only
address like `agent-backend@gavi411.local` works fine.)
 
**Commit trailer** — every agent-authored commit includes:
 
```
Agent-Role: <role>
Jira-Issue: <issue-key>
```
 
Example:
```
Wire OAuth callback handling into auth routes
 
Agent-Role: agent-backend
Jira-Issue: G411-14
```
 
**Branch prefix** — one prefix per agent role, matching the email above:
 
```
agent-backend/G411-14-oauth-callback
agent-design/G411-22-admin-cockpit-styling
```
 
Your own branches (if you use them) can stay unprefixed or use `you/`.
 
**PR-body marker** (if/when PRs are used instead of direct commits) —
include the Jira issue key and a one-line falsifier reference so Repowise's
PR-evidence signal and the Aegis trail stay linked:
 
```
Closes G411-14
Falsifier: <copy the child issue's falsifier field>
```
 
## The one failure mode to know about
 
Repowise downgrades confidence when it sees a **human commit landing inside
an agent's PR** — e.g. you making a small manual fix on a branch an agent
opened. That's expected behavior, not a bug: if you do this, either commit
it as your own follow-up on your own branch instead, or accept that
Repowise will (correctly) flag it as mixed-authorship rather than pure
agent work.
 
**Concrete example:** `agent-backend` opens branch
`agent-backend/G411-14-oauth-callback` and commits under
`agent-backend@gavi411.local`. You notice a typo in an error message and
fix it yourself, directly on that branch. As long as your terminal is still
using *your own* git identity (`gavi@...`) when you make that fix — not the
agent's — your commit lands correctly attributed to you, and Repowise
(correctly) reads the branch as agent work with one human follow-up. The
only mistake to avoid is leaving your session's `git config user.email` set
to the agent's address and then typing a manual fix under it — that's the
one case where Repowise has no way to tell a human touched it, and the
whole branch reads as pure agent work, which is simply wrong.
 
## Why per-role, not per-session
 
Repowise attributes at the granularity of what's in the git identity, not
what's in a chat window. A session-based identity (a new email every time
you open Claude Code) would fragment the same logical "backend agent" into
dozens of unrelated identities and defeat the provenance tracking entirely.
Role-based identity is what makes "how much of the codebase did the design
agent produce, and is it healthy" an answerable question later.

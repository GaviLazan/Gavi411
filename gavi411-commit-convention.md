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
 
- `gavi@` — placeholder label for your own manual commits. No literal
  address change required: your existing global git identity
  (`gavriel.lazan@gmail.com`) already satisfies the rule, since it's one
  consistent, distinct address used only for your own work. Only the agent
  roles below need a dedicated local-only address set up.
- `agent-backend@` — backend/logic subagent. Also owns **Clerk OAuth
  wiring** (callback handling, session/token mgmt) — that task is
  `[Agentic]` per CLAUDE.md's Ownership Split, but it's server-side
  auth/session work, closest in kind to the rest of backend logic, so it
  doesn't get a separate role/worktree.
- `agent-design@` — design/styling subagent (Impeccable-driven passes)
- `agent-test@` — test-scaffold subagent
- `agent-e2e@` — E2E encryption subagent
- `agent-cicd@` — CI/CD and deploy subagent
- `agent-frontend@` — client-side *infra* subagent (added 2026-08-19, for
  G411-15 PWA manifest/service worker). Scope is deliberately narrow:
  build config, service worker, install/manifest plumbing — never product
  UI. Frontend component structure/wiring/pages stay `[You]` exactly as
  before; the *design/styling pass* on top of that work is still
  `agent-design`'s job. Don't let this role's scope creep into either of
  those — it's for infra that happens to live in `client/`, not a general
  "frontend agent."

(These don't need to be real mailboxes — each agent role now has its own
persistent git worktree (`../Gavi411-agent-<role>/`, set up during
Setup-steps step 8) with its identity fixed via `git config --worktree`,
so it never needs switching mid-session. A local-only address like
`agent-backend@gavi411.local` works fine.)
 
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
 
Your own branches use `you/G411-XX-short-slug`, e.g. `you/G411-11-express-skeleton`.
One branch per child issue, branched off `main`, merged back via PR when the
child reaches Landed. Decided 2026-08-18: direct-to-`main` was the original
default for `[You]` work, but branch isolation is wanted even solo — see PR
review section below for the merge/review mechanics.
 
**PR-body marker** (if/when PRs are used instead of direct commits) —
include the Jira issue key and a one-line falsifier reference so Repowise's
PR-evidence signal and the Aegis trail stay linked:
 
```
Closes G411-14
Falsifier: <copy the child issue's falsifier field>
```

## PR review policy (decided 2026-08-18)

Aegis §7.4 disqualifies an author as their own reviewer — but this is a solo
project, so "who reviews" needs its own rule rather than assuming a teammate
exists.

- **Routine children**: self-merge once the child's own Evidence bar is met
  (Falsifier checked against real landed state — Repro/Test/whatever was
  declared at pickup). The evidence itself is the review; no separate
  human-in-the-loop step.
- **Load-bearing children**: credits logic, auth/session handling, E2E
  encryption, the request lifecycle state machine — anything where a passing
  test could still hide a real problem (security gap, money-handling bug,
  broken state transition). These get a live Sibling review from Claude
  Code before merge, on top of the evidence bar, not instead of it.
- Judgment call on "is this one load-bearing": ask rather than assume when a
  child isn't a clean fit either way.

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
 
## Applying identities in practice (git-as-* switchers)

Six functions live in `~/.bashrc` (added during Setup-steps step 8), one
per identity above — `git-as-gavi`, `git-as-agent-backend`,
`git-as-agent-design`, `git-as-agent-test`, `git-as-agent-e2e`,
`git-as-agent-cicd`. Each sets `user.name`/`user.email` for the **current
repo only** (never `--global`), so switching identity for Gavi411 never
leaks into any other project and nothing goes stale in the background.

**What you do next (open a fresh terminal, or `source ~/.bashrc`):**
Before any commit — yours or an agent's — run the matching function first,
e.g. `git-as-agent-backend` before a backend-agent commit, `git-as-gavi`
before your own. It's one line, and it fails loudly (command not found) if
you're not in a repo with git initialized, rather than silently doing
nothing.

**The tagging rule, since all commits run through Claude Code:** identity
is set by whichever `git-as-*` function ran *most recently* against the
repo's local git config — it's read at commit time regardless of how the
commit is made (terminal `git commit`, Claude Code running it on your
behalf, or a GUI like VS Code's Source Control panel). So the question is
never "who clicked commit," it's **who is actually responsible for the
change**, per the Ownership Split in `CLAUDE.md`:

- Gavi wrote/drove the change himself (even if Claude Code types the git
  command, or you commit via a GUI) → run `git-as-gavi` first.
- An agent produced the change autonomously (Agentic-tagged work) → run
  the matching `git-as-agent-*` first.
- If you're about to commit through a GUI yourself, that's almost always
  `git-as-gavi` — run it in a terminal before switching to the GUI, since
  the GUI has no way to ask which identity to use.

## Why per-role, not per-session
 
Repowise attributes at the granularity of what's in the git identity, not
what's in a chat window. A session-based identity (a new email every time
you open Claude Code) would fragment the same logical "backend agent" into
dozens of unrelated identities and defeat the provenance tracking entirely.
Role-based identity is what makes "how much of the codebase did the design
agent produce, and is it healthy" an answerable question later.

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

## Subagent launch checklist (decided 2026-08-19)

Persistent worktrees sit idle between sessions while `main` keeps moving —
a role's worktree can silently be many commits behind. Before launching any
subagent into a role worktree:

1. `git -C ../Gavi411-agent-<role> log --oneline -3` and `git status -s` —
   confirm it's clean (no leftover uncommitted work from a prior run).
2. `git -C ../Gavi411-agent-<role> merge main --no-edit` — bring it up to
   date with `main` before the subagent starts, so it isn't working
   against a stale snapshot (missing recent scaffolding, doc corrections,
   etc.) and doesn't duplicate or conflict with what already landed.
3. Only then launch, with the subagent's prompt explicitly pinned to that
   worktree's absolute path and its git identity/trailer — this isn't
   inferred automatically, it has to be spelled out per launch (see the
   identity/trailer convention above).

This is a manual pre-flight, not automated — same "no enforcement layer,
just a checklist that has to actually be followed" situation as the
wrap-it-up checklist in `CLAUDE.md`.

**Same staleness risk applies on merge-back, not just launch**: merging
an agent branch into `main` brings in `package.json` changes, but
`node_modules` is gitignored and won't update itself — a stale
`node_modules` in whichever worktree you verify from will build-fail even
though the code is correct (bit G411-13: `main`'s `client/` build failed
post-merge on a missing `@clerk/react` until `npm install` was re-run
there). Re-run `npm install` (root and `client/`, as applicable) after any
merge, in the worktree you're about to verify evidence from, before
trusting a build/run check.

**Secrets across worktrees**: `.env` files are gitignored, so they're
untracked — worktrees only share tracked history, meaning a `.env` in one
worktree is invisible to the others (this bit G411-13: the subagent had
to build against placeholder-format keys because `agent-backend`'s `.env`
didn't exist). Fix: `.env` (server-side, root) and `client/.env`
(client-side, `VITE_`-prefixed vars only — Vite doesn't expose bare env
vars to client code) live for real in the main worktree only, and get
symlinked into each agent worktree:
```
ln -sf /path/to/Gavi411/.env /path/to/Gavi411-agent-<role>/.env
ln -sf /path/to/Gavi411/client/.env /path/to/Gavi411-agent-<role>/client/.env
```
One edit in the main worktree, all worktrees see it immediately. Re-run
the symlink for `client/.env` once a worktree's `client/` directory
exists (a fresh/stale worktree won't have it until `client/` is merged in
— covered by the launch checklist's "merge main first" step above, but
the symlink itself isn't automatic and needs re-doing after that merge).

**Where to launch from (decided 2026-08-19)**: every subagent's tool
calls (Bash, Read, its own commits) stream into the *same* Claude Code
session transcript that launched it — foreground or background, there's
no true separate-chat isolation available from inside a session. Running
several subagents' raw activity interleaved with the main thread's own
work (e.g. G411-14 pairing) makes the transcript unreadable — confirmed
by Gavi hitting this directly when 15/16/17 ran backgrounded during 14.
Going forward: Claude does not launch multiple background subagents
inside a session that also has live foreground pairing work happening.
For genuinely parallel/background work (like the 15/16/17 batch), Gavi
opens a separate Claude Code tab/session himself and hands that session
the task directly — real isolation, not simulated via backgrounding
inside one thread.

**Parallel launches**: only run subagents side by side when their file
scopes genuinely don't overlap and neither's output feeds the other's
input. Before launching more than one at once, name each one's expected
touched files/directories and check for intersection — if two roles would
plausibly both touch, e.g., `server/server.js` or `client/src/main.jsx`,
or one's task depends on the other's not-yet-built output, run them
sequentially instead. When unsure, default to sequential.
 
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

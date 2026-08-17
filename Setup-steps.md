1. Get the docs into the real project
Swap the updated gavi411-brain.md, gavi411-prd.md, and the new gavi411-post-deadline-learning-backlog.md into your actual project files (these chat outputs are copies, not synced automatically).
*DONE*
 
2. Build out Jira (the G411 project)
 
Create the Parent and Child issue types (or repurpose existing ones) with the custom fields from gavi411-jira-aegis-template.md — Claim, Scope, Assumptions ledger, Falsifier, Evidence bar, Owner/Authorship, Role, Reviewer type, etc.
Populate the initial backlog as Parent/Child issues, using the hour-costed task list we built (Foundation → Requests/Intake → Messaging → Lifecycle → Admin → Credits → Notifications), tagged with Owner/Authorship per the split.
*DONE*
 
3. Dev environment
Confirm/reuse the existing Ubuntu VM, or set up fresh if you'd rather start clean for this project specifically.
*DONE*
 
4. Create the GitHub repo
Empty repo, matches what Jira/Repowise/CI-CD will all point at.
*DONE*
 
5. Spin up the actual service accounts
 
Neon: create the Postgres project (if not already project-specific)
Clerk: create the actual Clerk application/project, grab API keys
*DONE* — decisions logged in gavi411-brain.md #53 (Clerk config) and #54
(Neon Auth rejected in favor of Clerk). Keys in scratch .env (gitignored).
 
6. Install Claude Code pointed at the new repo
*DONE*
 
7. Inside Claude Code, install the three plugins
 
Repowise (/plugin marketplace add repowise-dev/repowise → /plugin install repowise@repowise)
Impeccable (npx impeccable install)
Ponytail (/plugin marketplace add DietrichGebert/ponytail → /plugin install ponytail@ponytail) — check node is on PATH first
*DONE*
 
8. Configure git identities
Set up the per-role email/branch-prefix scheme from gavi411-commit-convention.md before any subagent starts committing.
*DONE* — full mechanism (git worktrees per role, identity setup, tagging
rule) documented in gavi411-commit-convention.md.
 
9. Design system kickoff
Gather the inspo board's actual screenshot image files (not the board's own code) ready to show Claude Code before building any component — per the corrected sequencing in the brain doc.
*DONE* — sorted into subfolders under "design inspo" by what signal each
image carries (general direction / specific elements / partial takes like
layout-or-color-only). One image intentionally placed in two folders.
 
10. Write the session-start ritual
You said you want to be actively involved in defining this, not have it run automatically — worth doing before Day 1 work starts, not during.
*DONE* — ritual (recap → agent/subagent status → pick the task) written
into CLAUDE.md under "How to work with Gavi."
 
11. Day 1 — DB schema

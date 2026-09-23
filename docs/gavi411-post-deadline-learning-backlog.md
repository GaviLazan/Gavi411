# Gavi411 — Post-Deadline Learning Backlog
 
Not a PRD item, not a brain-doc decision. A running list of things built
agentically during the crunch (fully explained at build time, per the
ownership split) that Gavi wants to personally rebuild, take apart, or study
once the deadline pressure is off — for his own understanding, not for
resubmission.
 
Add to this list as agentic work lands. Nothing here blocks or changes the
real build — it's a future-you reference, not a project task.
 
## Candidates (from the current ownership split)
 
| Area | What was agentic | Why it's worth revisiting |
|---|---|---|
| Design system + styling passes | Impeccable-driven component styling, applied on top of Gavi's own structure | Understand how the token/design-system approach actually works under the hood, beyond "the agent applied classes" |
| OAuth wiring | Clerk SDK integration — callback handling, session/token management | Auth is broadly reusable knowledge; worth understanding the provider-specific plumbing, not just that it works |
| E2E encryption core | Keypair generation, ECDH shared-secret derivation, AES-GCM message/image encryption, escrow flow | Genuinely valuable cryptography knowledge, currently correctly deferred as beyond hand-write scope for this deadline |
| PWA / service worker config | Manifest + service worker setup enabling installability and Web Push | Small in code size but conceptually useful — worth understanding what the service worker is actually doing |
| Deploy pipeline (initial setup) | Vercel + Render initial configuration | Understanding the deploy config beyond "it's set up and works" |
 
## Notes
 
- Testing and CI/CD are **not** on this list — those are already collaborative in the real build (decision: Gavi is weak in both and wants to learn them as they're built, not after the fact).
- This list is expected to grow as the project progresses — treat it as a parking lot for "agent built this, I want to come back to it," not a finished spec.

# Gavi411 — Jira Issue Template (Aegis Method)
 
Source-grounded in `mithran.ai/aegis-method/SPEC.md` (§4, §5, §7) and the real
issue-train examples in the Aegis deck (NAP, FTC, BADAS cases). Two issue
types only — Parent and Child — no epics/stories.
 
---
 
## Parent Issue
 
Coordination artifact. Holds the map of reality, not delivery work.
 
| Field | Purpose | Source |
|---|---|---|
| **Claim** | The single sentence describing what should be true after this train closes. | SPEC §2.1 (goal) |
| **Scope** | What must and must not change. | SPEC §2.1 |
| **Target** | The system/component this compiles against (e.g. "request lifecycle backend"). | SPEC §2.1 |
| **Assumptions ledger** | List of `{assumption, status: unvalidated/validated/failed}`. Re-checked at closure. | SPEC §5.2 Move 2, deck slide 21 |
| **Facts captured (Move 1 evidence)** | What's true about the current system before any architecture decision — code state, logs, recent changes. | SPEC §5.1 Move 1 |
| **Rejected claims** | Paths considered and killed, with why. Prevents a later agent reviving a dead idea. | SPEC §4.4, deck slide 36 (FTC rejected "pack whole repo into prompt" and "bespoke tools") |
| **Non-goals** | Explicitly out of scope for this train. | deck slide 21 |
| **Owner/Authorship** | You / Agentic / Collaborative — per the hand-write vs. agentic split already decided. | Gavi411-specific addition |
| **Children** | Linked child issues. | SPEC §4.2 |
| **State** | Open → Implementing → Reviewing → Landed → Reconciled | SPEC §4.1 |
| **Closes when** | Every child is Reconciled AND the assumption ledger has been re-validated against landed state. | SPEC §9.3 |
 
---
 
## Child Issue
 
Delivery unit. One scope, one commit, one acceptance bar.
 
| Field | Purpose | Source |
|---|---|---|
| **Parent** | Link to parent issue. | SPEC §4.2 |
| **Scope** | Single bounded piece of work — if it needs multiple independent commits, split it. | SPEC §8.2, deck slide 25 |
| **Role** | Free-text label describing what kind of child this is — e.g. `Falsifier`, `State`, `Diagnosis`, `ADR`, `Sandbox`, `Verifier`, `Policy`, `Gate`, `Follow-up`. Not a rigid enum — pattern-matched from real trains (NAP: #1991 Falsifier / #1992 State / #1993 Diagnosis. FTC: #172 ADR / #174 Sandbox / #176 Verifier. BADAS: #32 Policy / #34 Gate / #35 Follow-up). | deck slides 32, 36, 39 |
| **Acceptance criteria** | What must be true, checked against landed state — not the author's memory of the change. | SPEC §5.5 Move 5 |
| **Falsifier** *(required, ≥1)* | The specific observation that would prove this child wrong. Must target the actual property, not a label — e.g. "the observed runtime backend is not X," not "the config says X." | SPEC §4.1, §6.1, §3.6 |
| **Evidence required to close** | One of: Test / Log / Repro / Inspection / Reference / Reconciliation. Must carry provenance (who, when, against what version). | SPEC §3.2 |
| **Evidence bar met** | Where the evidence sits on the lattice — weak ("looks fixed") through strong ("landed-state reconciled"). Floor is the bar; bring stronger when you have it. | SPEC §3.3 |
| **Owner/Authorship** | You / Agentic / Collaborative. | Gavi411-specific addition |
| **Active claim** | Which agent/session is currently implementing (ties to the commit convention below). Only one active claim per child at a time. | SPEC §4.3, §8.2 |
| **Reviewer type** | Sibling (adjacent code, ok for most) / Owner (required for anything load-bearing) / Outsider (brought in to falsify the framing itself). Author is disqualified as their own adversary. | SPEC §7.4 |
| **State** | Open → Implementing → Reviewing → Landed → Reconciled | SPEC §4.1 |
| **Trail** | Append-only log of state transitions (Jira's native activity log covers this). | SPEC §4.3 |
 
---
 
## Release-gate children (BADAS pattern)
 
For any child that gates a deploy/demo/milestone rather than delivering a feature directly, the Evidence field should specifically capture:
 
- Owner (single accountable person for the go/no-go call — not distributed)
- Executable check or reviewed procedure
- Evidence link
- Freshness marker (when was this evidence last true)
- Blocker status
- Rollback path
Source: deck slides 38–40 — the BADAS lesson is that a launch can fail while every individual piece feels explainable, because confidence was distributed and no one owned the combined call.
 
---
 
## What's deliberately not here
 
- No "epic" or "story" issue types — SPEC §4.2 is explicit these belong to planning tools, not the IR.
- No separate "bug" type — a bug is a child issue like any other, with its own falsifier and evidence bar.
 


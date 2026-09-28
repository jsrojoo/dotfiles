---
name: plan
description: Plan non-trivial coding work after read-only investigation. Use when work spans components, requires design or migration decisions, involves unfamiliar behavior or meaningful risk, or when the user asks for a plan.
---

# Plan

Use planning to remove uncertainty before implementation, not to add ceremony. Skip this workflow for routine, low-risk work with an obvious solution.

## Investigate

- Read relevant repository instructions, implementation, tests, and call sites.
- Confirm current behavior, constraints, and the smallest useful outcome.
- Check repository state for unrelated work that must be preserved.
- Resolve unknowns with evidence. Ask only questions that block a sound plan; state other material assumptions.
- Do not edit files or run mutating commands during this phase.

## Apply senior-dev filter

Read and follow the `ponytail` skill after understanding the full change path and before writing the plan.

- Challenge whether requested machinery needs to exist and cut speculative scope.
- Reuse existing code, standard-library features, native platform behavior, and installed dependencies before adding anything.
- Prefer the fewest files and shortest complete change without weakening validation, error handling, security, accessibility, or explicit requirements.
- For bugs, trace callers and plan the smallest shared root-cause fix.
- Include one focused runnable check for non-trivial logic.

## Write plan

Use the exact heading `Plan:` followed by a concise numbered list.

Build an implementation-ready plan that:

- chooses the smallest complete approach that fits existing patterns
- gives each step a clear outcome, relevant paths, and concrete verification
- orders dependencies and groups independent work for parallel execution
- states only material assumptions, decisions, risks, and mitigations
- addresses known scale, security, and compatibility needs without speculative abstractions

Use only as many steps as execution needs. Avoid implementation trivia and restating the request.

After the numbered list, read and follow the `termaid` skill. Include its rendered `Before`, `After`, and `What changed` views so the plan can be understood at a glance.

## Approval

Wait for explicit approval before editing or running mutating commands. Treat approval as valid for the stated scope; do not ask again unless scope or risk materially changes.

After approval, use the `plan-mode-tasks` skill when persistent task artifacts are useful, then execute the plan. Artifact writes are implementation-phase mutations and must not occur before approval. If evidence invalidates the approved plan, stop and present the smallest necessary revision.

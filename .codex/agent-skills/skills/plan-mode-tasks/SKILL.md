---
name: plan-mode-tasks
description: Create and maintain agents/tasks/task-name/plan.md and tasks.md for Plan Mode plans.
---

# Plan Mode Tasks

## Delegation Model

- Route plan artifact creation and maintenance through registered `plan_mode_tasks` subagent instead of keeping workflow only in parent thread.
- Invoke `plan_mode_tasks` after Plan Mode plan is approved and task needs `plan.md` and `tasks.md` created or updated.
- Reuse same `plan_mode_tasks` subagent for rest of turn's plan artifact work so approved plan state stays in one place.
- Configure subagent through `agent-skills/agents/plan-mode-tasks.toml` and `agent-skills/agents/plan-mode-tasks.md`, with model selection kept in agent config.
- Keep actual implementation work in parent thread or appropriate workflow subagent; use `plan_mode_tasks` only for plan artifacts themselves.

## Intent

- Create plan artifacts in directory user requests; default to `./.agents/tasks/<task>/` whenever Plan Mode plan is produced.

## Permission Gate

- You have full create/edit permission for plan and task docs.
- If approval is denied, provide planned contents in chat only.

## Task Slugging

- Derive `<task>` from user's task title or primary request text.
- Transform to lowercase.
- Replace whitespace with hyphens.
- Remove non-alphanumeric characters except hyphens.
- Trim leading and trailing hyphens.
- If no clear task title exists, ask user for short task name before proceeding.
- For plans involving code changes, follow `workflow-code` for guidance.

## Files

### `plan.md`

Use this template and fill it with final plan content.

```
# Goal

# Scope

# Non-goals

# Constraints

# Plain-English Pseudocode

# Plan

# Risks

# Tests
```

### `tasks.md`

- Use checkbox list format.
- Seed tasks from Plan steps, one task per line.
- Add nested `Verify:` acceptance checks under each task when the plan includes tests, constraints, invariants, risks, docs, samples, config changes, or source-specific behavior.
- Keep `Verify:` checks concrete enough to prove completion; include critical success, failure, no-write/no-mutation, rollback/no-cleanup, path preservation, docs/sample, and source-specific coverage where relevant.
- Do not make `tasks.md` a broad checklist that can be marked done without proof.
- Use this format:

```
- [ ] Task description
  - Verify: Acceptance check tied to plan tests, constraints, or risks.
```

## Plain-English Pseudocode

- For code-change plans, include `# Plain-English Pseudocode` in `plan.md`.
- This helps `workflow-code`, but `workflow-code` can derive pseudocode later if absent.
- Write pseudocode as domain steps in execution order.
- Prefer immutable flow: each step should produce a named output consumed by the next step.
- Keep it behavior-focused, not language-specific.
- Name key invariants when behavior must not change.

Use this shape:

```text
Collect [domain inputs].
Normalize [domain inputs] into [normalized inputs].
Build [primary output] from [normalized inputs].
Add [secondary output] to produce [expanded output].
Enrich [expanded output] with [domain data].
Compute [derived output] from [enriched output].
Filter [derived output] into [valid output].
Return [valid output].
```

For implementation-heavy tasks, add `Pseudo:` lines in `tasks.md` when useful:

```md
- [ ] Refactor consumption row build into billing, seat, and pricing stages.
  - Pseudo: collect raw records; build pricing rules; build seat snapshots; build billing rows; build seat rows; produce enriched rows; compute total spend; return valid-email rows.
  - Verify: focused tests pass and public behavior stays unchanged.
```

## Updates

- If plan changes, ask for approval again before updating `plan.md` or `tasks.md`.
- Keep `tasks.md` aligned to current Plan steps.

## Collisions

- If `./.agents/tasks/<task>/` already exists, reuse it and update `plan.md` and `tasks.md`.

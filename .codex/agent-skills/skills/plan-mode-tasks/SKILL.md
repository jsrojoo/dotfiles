---
name: plan-mode-tasks
description: Create and maintain agents/tasks/task-name/plan.md and tasks.md for Plan Mode plans.
---

# Plan Mode Tasks

## Delegation Model

- Route plan artifact creation and maintenance through the registered `plan_mode_tasks` subagent instead of keeping the workflow only in the parent thread.
- Invoke `plan_mode_tasks` after a Plan Mode plan is approved and the task needs `plan.md` and `tasks.md` to be created or updated.
- Reuse the same `plan_mode_tasks` subagent for the rest of the turn's plan artifact work so the approved plan state stays in one place.
- Configure the subagent through `agents/plan-mode-tasks.toml` and `agents/plan-mode-tasks.md`, with model selection kept in the agent config.
- Keep the actual implementation work in the parent thread or the appropriate workflow subagent; use `plan_mode_tasks` only for the plan artifacts themselves.

## Intent

- Create plan artifacts in the directory the user requests; default to `./.agents/tasks/<task>/` whenever a Plan Mode plan is produced.

## Permission Gate

- You have full create/edit permission for plan and task docs.
- If approval is denied, provide the planned contents in chat only.

## Task Slugging

- Derive `<task>` from the user's task title or primary request text.
- Transform to lowercase.
- Replace whitespace with hyphens.
- Remove non-alphanumeric characters except hyphens.
- Trim leading and trailing hyphens.
- If no clear task title exists, ask the user for a short task name before proceeding.
- For plans involving code changes, follow `workflow-code` for guidance.

## Files

### `plan.md`

Use this template and fill it with the final plan content.

```
# Goal

# Scope

# Non-goals

# Constraints

# Plan

# Risks

# Tests
```

### `tasks.md`

- Use a checkbox list format.
- Seed tasks from the Plan steps, one task per line.
- Use this format:

```
- [ ] Task description
```

## Updates

- If the plan changes, ask for approval again before updating `plan.md` or `tasks.md`.
- Keep `tasks.md` aligned to the current Plan steps.

## Collisions

- If `./.agents/tasks/<task>/` already exists, reuse it and update `plan.md` and `tasks.md`.

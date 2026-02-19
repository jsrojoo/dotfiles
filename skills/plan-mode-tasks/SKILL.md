---
name: plan-mode-tasks
description: Create and maintain agents/tasks/task-name/plan.md and tasks.md for Plan Mode plans.
---

# Plan Mode Tasks

## Intent

- Create plan artifacts in `./agents/tasks/<task>/` whenever a Plan Mode plan is produced.

## Permission Gate

- Ask for explicit approval before creating or editing any files.
- If approval is denied, provide the planned contents in chat only.

## Task Slugging

- Derive `<task>` from the user's task title or primary request text.
- Transform to lowercase.
- Replace whitespace with hyphens.
- Remove non-alphanumeric characters except hyphens.
- Trim leading and trailing hyphens.
- If no clear task title exists, ask the user for a short task name before proceeding.

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

- If `./agent/tasks/<task>/` already exists, reuse it and update `plan.md` and `tasks.md`.

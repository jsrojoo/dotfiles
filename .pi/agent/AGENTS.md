## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.

## Code Editing

- Delegate code changes to `editor` subagent.
- `editor` must apply changes exclusively through `edit`; never use `bash`, `write`, or generated rewrites for code edits.
- `editor` follows `coding` skill at `.agent-harness/src/skills/coding/SKILL.md`.

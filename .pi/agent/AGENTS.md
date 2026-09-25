## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.

## Context Delegation

- Delegate all repository read and investigation work to the `context` subagent; do not use direct `read` calls in the main session.
- Return only relevant context needed for the task. Omit read-call details, exploratory output, and internal investigation mechanics.
- Run independent investigations in one parallel call with at most 4 concurrent context children.
- Context agents must remain read-only. External services, including databases, require verified read-only connections and read-only queries; otherwise do not access them.
- Keep main-session reads limited to tool output already returned by `context`; use direct tools only for edits, execution, and required verification.

## Git Delegation

- Delegate every Git command and operation, read-only or write, to the `git` subagent immediately.
- Git work is an exception to Context Delegation and Code Editing rules; do not run Git commands in the main session.
- Use main-session Git only when the `git` subagent is unavailable or fails to invoke, and disclose the fallback.

## Code Editing

- Apply file edits in the main agent session so guardrails observe them.
- Do not delegate file mutations to subagents.
- After implementation and fresh verification, always call `implementation_done` before final response. Do not call it before verification passes.

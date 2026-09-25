## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.

## Context Delegation

- Delegate read-heavy repository investigation spanning multiple files to the `context` subagent.
- Run independent investigations in one parallel call with at most 4 context tasks.
- Context agents must remain read-only. External services, including databases, require verified read-only connections and read-only queries; otherwise do not access them.
- Keep trivial known-file reads local. After delegation, inspect only focused files needed to verify or act on returned findings.

## Code Editing

- Apply file edits in the main agent session so guardrails observe them.
- Do not delegate file mutations to subagents.
- After implementation and fresh verification, always call `implementation_done` before final response. Do not call it before verification passes.

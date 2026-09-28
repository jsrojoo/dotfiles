## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.

## Planning

- Use `enter_plan_mode` for non-trivial implementation work or when the user asks for a plan.

## Context Delegation

- Delegate all repository read and investigation work through one main `context` coordinator invocation; do not use direct `read` calls in the main session.
- The `context` coordinator may fan out internally to 2-4 read-only `context-retriever` leaves; the main session must not invoke leaf agents directly.
- Return only relevant context needed for the task. Omit read-call details, exploratory output, and internal investigation mechanics.
- Give every context invocation a concise `purpose` describing its intent; Pi renders it as `context: <purpose>`.
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

## Completion Responses

- After implementation work, always send a final completion summary after all tool and monitor output. Include completion status, changed behavior and files, verification results, remaining failures or risks, and whether user action is required.
- Never leave a background-job, tool, or monitor notification as the final user-facing response.

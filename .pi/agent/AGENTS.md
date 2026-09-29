## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.
- Subagent execution emits a heartbeat every 60 seconds. At the exact 5-minute deadline, it freezes elapsed time at 5 minutes, sends SIGKILL to an open child, and settles the timeout immediately without waiting for child `close`, inherited stdio, or descendants. Caller abort remains distinct: send SIGTERM, then escalate to SIGKILL after 5 seconds. After a timeout, inspect partial output and logs, then re-scope the task into smaller actionable work.
- Editor-worker scope should include matching production and focused test files, and should permit focused test execution for TDD.
- Run checks expected to finish within 10 seconds in the foreground; background only genuinely long checks.
- Before verification, confirm the intended working directory, package scripts, and local dependencies once instead of discovering them through repeated failed runs.

## Planning

- Use `enter_plan_mode` for non-trivial implementation work or when the user asks for a plan.
- After approval, create and update plan artifacts directly with `plan-mode-tasks` `agent-taskctl`; do not delegate artifact file creation to an editor.

## Task Worktrees

- Use `<project-root>/.agents/tasks/<task>/worktree/` for every non-trivial implementation and every code or configuration change; never use the primary checkout or an unrelated task worktree.
- Keep `.agents/tasks/<task>/plan.md` and `.agents/tasks/<task>/tasks.md` beside `worktree/`, never inside it.
- Before creating a worktree, verify source status, record the explicit branch and start point, confirm the path is unused, and obtain approval.
- Before handoff, verify worktree status and confirm the scoped diff contains only requested changes.
- Do not move, merge or integrate, remove, or otherwise alter worktrees or related Git state without explicit approval.
- Follow `agent-harness/src/skills/git/references/worktrees.md`.

## Context Delegation

- Delegate all repository read and investigation work through one main `context` coordinator invocation; do not use direct `read` calls in the main session.
- The `context` coordinator may fan out internally to 2-4 read-only `context-retriever` leaves; the main session must not invoke leaf agents directly.
- Return only relevant context needed for the task. Omit read-call details, exploratory output, and internal investigation mechanics.
- Give every context invocation a concise `purpose` describing its intent; Pi renders it as `context: <purpose>`.
- Context agents must remain read-only. External services, including databases, require verified read-only connections and read-only queries; otherwise do not access them.
- Keep main-session reads limited to tool output already returned by `context`; use direct tools only for edits, execution, and required verification.

## Git Delegation

- In the main/orchestrating session, delegate every Git command and operation, read-only or write, to the `git` subagent immediately.
- An already-running `git` subagent must execute Git commands directly without nested delegation.
- Git work is an exception to Context Delegation and Code Editing rules; do not run Git commands in the main session.
- Use main-session Git only when the `git` subagent is unavailable or fails to invoke, and disclose the fallback.

## Code Editing

- Delegate code and configuration changes to the `editor` subagent.
- The `editor` subagent follows the shared `coding` skill and must return changed paths and verification results to the main session.
- Prefer one editor invocation for one coherent implementation and its focused tests; do not split approved plan steps into separate calls unless ownership or a real dependency requires it.
- A successful subagent tool call only means the child returned. Treat `blocked`, `unable`, unchanged required files, or failed/skipped required verification as incomplete.
- Keep integration review and final verification in the main session.
- After implementation and fresh verification, always call `implementation_done` before final response. Do not call it before verification passes.

## Completion Responses

- After implementation work, always send a final completion summary after all tool and monitor output. Include completion status, changed behavior and files, verification results, remaining failures or risks, and whether user action is required.
- Never leave a background-job, tool, or monitor notification as the final user-facing response.

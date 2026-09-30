## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.
- Subagent execution emits a heartbeat every 60 seconds. At the exact 5-minute deadline, it freezes elapsed time at 5 minutes, sends SIGKILL to an open child, and settles the timeout immediately without waiting for child `close`, inherited stdio, or descendants. Caller abort remains distinct: send SIGTERM, then escalate to SIGKILL after 5 seconds. After a timeout, inspect partial output and logs, then re-scope the task into smaller actionable work.
- Editor-worker scope should include matching production and focused test files, and should permit focused test execution for TDD.

## Planning

- For planning guidance, refer to `~/.pi/agent/references/planning-guidance.md`.

## Task Worktrees

- Use `<project-root>/.agents/tasks/<task>/worktree/` for every non-trivial implementation and every code or configuration change; never use the primary checkout or an unrelated task worktree.
- Keep `.agents/tasks/<task>/plan.md` and `.agents/tasks/<task>/tasks.md` beside `worktree/`, never inside it.
- Before creating a worktree, verify source status, record the explicit branch and start point, confirm the path is unused, and obtain approval.
- Before handoff, verify worktree status and confirm the scoped diff contains only requested changes.
- Do not move, merge or integrate, remove, or otherwise alter worktrees or related Git state without explicit approval.
- Follow `agent-harness/src/skills/git/references/worktrees.md`.

## Context

- For context guidance, refer to `~/.pi/agent/references/context-guidance.md`.

## Git

- For Git guidance, refer to `~/.pi/agent/references/git-guidance.md`.

## Code Editing

- For code-editing guidance, refer to `~/.pi/agent/references/code-editing-guidance.md`.

## Completion Responses

- After implementation work, always send a final completion summary after all tool and monitor output. Include completion status, changed behavior and files, verification results, remaining failures or risks, and whether user action is required.
- Never leave a background-job, tool, or monitor notification as the final user-facing response.

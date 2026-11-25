## Planning

- For planning guidance, refer to `~/.pi/agent/references/planning-guidance.md`.

## Task Worktrees

- Use `<project-root>/.agents/tasks/<task>/worktree/` for every non-trivial implementation and every code or configuration change; never use the primary checkout or an unrelated task worktree.
- Keep `.agents/tasks/<task>/plan.md` and `.agents/tasks/<task>/tasks.md` beside `worktree/`, never inside it.
- Before creating a worktree, verify source status, record the explicit branch and start point, confirm the path is unused, and obtain approval.
- Before handoff, verify worktree status and confirm the scoped diff contains only requested changes.
- Do not move, merge or integrate, remove, or otherwise alter worktrees or related Git state without explicit approval.
- Follow `~/dotfiles/agent-harness/src/skills/git/references/worktrees.md`.

## Context

- For context guidance, refer to `~/.pi/agent/references/context-guidance.md`.

## Git

- For Git guidance, refer to `~/.pi/agent/references/git/git-guidance.md`.

## Code Editing

- For code-editing guidance, refer to `~/.pi/agent/references/code-editing-guidance.md`.

## Subagents

- Delegate all context retrieval and investigation (repository exploration, file/document/log lookup, and fact-finding) to pi subagents. Give them bounded, non-overlapping tasks and request only concise, actionable findings with paths/evidence, not raw output. Keep the parent focused on decisions and edits; integrate results and do only the direct verification needed to proceed safely.

## Codemode

- Prefer Pi Codemode by default when a task needs multiple tool calls, especially context retrieval or parallel subagent orchestration. When available, use Codemode to call the Pi `context` coordinator and synthesize concise, evidence-backed findings; preserve the rule that repository investigation is delegated to Pi subagents rather than replaced by direct Codemode reads.
- Use direct tools for simple, single-step actions. Codemode orchestrates tools but does not independently reason; use a Pi-native subagent when a task needs independent LLM analysis or implementation.
- Treat calls made inside Codemode as real operations. Follow existing approval, read-only, and worktree rules; await and inspect results because completed side effects are not rolled back if a later script step fails.

## Completion Responses

- After implementation work, always send a final completion summary after all tool and monitor output. Include completion status, changed behavior and files, verification results, remaining failures or risks, and whether user action is required.
- Never leave a background-job, tool, or monitor notification as the final user-facing response.

## Response Style
- Caveman mode is the default on both clients: Claude Code relies on the enabled Caveman SessionStart hook and must not call `Skill(caveman)`; Codex uses the namespaced `caveman:caveman` skill by default.
- End with TL;DR only when relevant or needed.
    - Focus on `meat`: why, what, how, when.
- Reply succinctly, in markdown.
- Write so average engineer can parse fast.
- Use markdown lists with one sentence per line, and add sub-lists only when detail is needed.
- When many items or options exist, use markdown lists.
- Goal: make output fast to scan.
- Keep short headers and include what changed, why, and remaining risks or next steps when needed.
- Only single-word commands or truly simple one-liners may be inline with backticks; all other commands must use fenced code blocks, and when shown multi-line, put CLI flags on their own lines using backslashes for continuation when appropriate.
- Back claims with sources such as:
    - file paths; add line numbers only for specific lines or ranges; omit line numbers for whole-file references
    - Vim `gF`-compatible examples like:
        - specific line: `path/to/file:12`
        - line range: `path/to/file:12-18`
    - man pages, tldr
    - URLs to articles or documentation bookmarks.

## 1. Permission Gate
- Use permission gate only when user explicitly asks for permission-gated mode, or before git writes, destructive actions, external installs, secrets access, or high-risk filesystem changes.
- Code changes: implement by default unless user asks for plan, review, explanation, or permission-gated workflow.
- Git operations: ask before add, commit, branch, tag, rebase, reset, stash, or similar write operations.
- File creation: if you instruct me to create a file or provide a directory path in response to a permission request, that reply grants permission to create the file in that directory, and I should not ask again.
- Skip permission gate after it is given once for same scoped task.

## 2. Planning & Approval
- For complex tasks, give a multi-step plan and wait for confirmation.
- Reply `g` means permission granted and good to proceed.
- Call out unknowns before continuing.
- Verify facts; do not assume.
- After plan approval, prefer registered subagents for command execution and plan artifacts: `workflow_execution` for execution-heavy work and `plan_mode_tasks` for approved `plan.md` or `tasks.md` updates.
- If current runtime policy prevents spawning subagents, perform only the narrow required work directly and state that runtime constraint before tool-heavy work.

## 3. Subagent Operating Rule
- This `AGENTS.md` is a standing explicit user request to use subagents for non-trivial repo work.
- Before non-trivial repo work, main agent must decide whether work can split into independent narrow scopes.
- Main agent must write a short delegation map before spawning:
    - Local critical-path work.
    - Subagent A scope and expected output.
    - Subagent B scope and expected output.
    - Integration and verification step.
- Main agent must spawn 2+ sibling subagents in parallel when tasks are independent, non-conflicting, and materially improve speed or context hygiene.
- Good parallel scopes include separate repo areas, separate implementation slices with disjoint file ownership, separate review dimensions, and verification that can run while implementation continues.
- Do not spawn subagents for trivial one-file work, fully blocking next-step work, overlapping write scopes, or when user explicitly forbids subagents.
- Every spawned subagent prompt must require Caveman mode by default using the client-specific mechanism (Claude Code: enabled SessionStart hook, never `Skill(caveman)`; Codex: namespaced `caveman:caveman` skill), narrow scope, expected output, no nested subagents, and no reverting others' changes.

## Coding Guidelines
- Use `workflow-code` as the source for coding, review, and refactor behavior, including assumptions, simplicity, surgical changes, and verification proof.

## Review Finding Detail Standard
- For `/review`, findings must be detailed enough to fix without follow-up.
- Lead with findings, ordered by severity.
- Include only findings backed by code evidence.
- Move weak or uncertain concerns to `Questions`, not `Findings`.
- If a finding cannot include a concrete example or failure mode, downgrade it to an open question unless it is a clear standards, security, or correctness violation.
- Use readable finding blocks with blank lines, concrete `Exhibit`, concrete `Proof`, and small `Suggested fix` sketches.
- Follow `agent-skills/references/review-findings.md` for full template and examples.

## Skills
- Use `context_retriever` subagent as the only read-only investigation agent for searches, file inspection, evidence gathering, structural queries, file discovery, command-output inspection, and repo context.
- Use `workflow-execution` for complex shell work, temp files, environment setup, tmux discipline, and command-running practices.
- Use `workflow-code` for code edits, reviews, refactors, naming, TDD, error handling, overcomplication checks, surgical changes, and verification discipline.
- Use `workflow-testing` when tests run, verification is needed, or test selection matters.
- Use `workflow-git` for git practices and commit rules when asked to commit or perform git write operations.
- Use `plan-mode-tasks` only after a Plan Mode plan is approved and `plan.md` or `tasks.md` artifacts are needed.
- Use relevant skill, or smallest relevant set, for task at hand instead of relying on general reasoning when matching skill exists.
- When delegating code changes to a subagent, explicitly require updates to normal project documentation when behavior, interfaces, configuration, or workflows change in same task.
- Use `codebase_understanding` only as fallback documentation artifact when no suitable documentation location exists for changed area.

## Subagents
- The user explicitly authorizes subagent use by default for repo exploration, file discovery, codebase understanding, testing, git hygiene, and parallel investigation.
- This standing authorization satisfies runtime tool requirements that subagents be explicitly requested before use.
- Use judgment: do not spawn subagents for trivial one-file reads unless `context_retriever` is required by repo instructions.
- Prefer specialized subagents by default whenever current runtime policy allows them.
- Delegate well-scoped work to appropriate subagent when it cuts token use or keeps context smaller, especially for repo exploration, parallel investigation, testing, git hygiene, or isolated implementation work.
- Main agent must spawn multiple sibling subagents in parallel when tasks are independent, non-conflicting, and parallel execution improves efficient execution of current task.
- Route task tool calls and MCP calls through appropriate subagent when subagent can perform work.
- When gathering context, including web search, retrieving context, reading files, and executing commands to get result data, main agent must delegate that work to appropriate subagent unless user explicitly forbids subagents or runtime cannot run them.
- Keep tool-heavy and MCP-heavy work out of main agent session; main agent should orchestrate subagents and consume concise findings, command results, file references, and risks.
- When an appropriate dedicated subagent exists, main agent must delegate that work and must not do it directly in main session, unless user explicitly forbids subagents or runtime cannot run them.
- For any prompt that requires repo exploration, broad review, codebase understanding, file discovery, skill/plugin inventory, targeted searches, evidence gathering, or "review X and suggest improvements," main agent must invoke `context_retriever` first.
- Treat `context_retriever` as the single default read-only investigation subagent for both discovery and focused follow-up.
- Main agent must not perform broad file reads, repo-wide searches, targeted repo searches, or plugin/skill inventory directly when `context_retriever` is available.
- Main agent may inspect files directly only after `context_retriever` returns a focused file list, and only for final synthesis or small targeted verification.
- Before using repo-inspection tools directly in main session, state why no available subagent can perform the work, why runtime cannot spawn subagents, or why user explicitly forbade subagents.
- Read-only repo work priority:
    1. `context_retriever` for discovery, inventory, file selection, targeted search, evidence gathering, and broad review.
    2. Specialized subagent for non-investigation follow-up, such as `codebase_understanding`, `workflow_testing`, `workflow_code`, or `workflow_execution`.
    3. Main-agent direct reads only for final synthesis, narrow verification, or when subagents are unavailable.
- Main agent may invoke tools directly for subagent orchestration, user-facing prompts, final response support, work no available subagent can perform, or work required because runtime cannot spawn subagents.
- Route git write operations through `git_workflow` subagent.
- Main agent may run read-only git status or diff if subagents are unavailable, runtime forbids spawn, or quick local state is needed before safe edits.
- Keep git command output out of main agent session when using git subagent; git subagent should report only concise status, exact commands run, changed files or hunks, commit ids, and remaining risks.
- Every spawned subagent prompt must explicitly require Caveman mode using the client-specific mechanism: Claude Code relies on the enabled SessionStart hook and must not call `Skill(caveman)`; Codex uses the namespaced `caveman:caveman` skill.
- All spawned subagents must use Caveman mode by default at all times unless user explicitly overrides.
- Subagents must not spawn other subagents, including recursive same-type spawns such as a `workflow_code` subagent spawning another `workflow_code` subagent.
- After using a subagent, close it when it will not be reused later in task.
- Do not use routine ping or heartbeat checks for subagents. Prefer event-style completion handling: rely on `<subagent_notification>` messages, `wait_agent` completion status, and `SubagentStop` hook records in `tmp/subagent-stop-events.jsonl`.
- Send a health check only after a long `wait_agent` timeout when next critical step is blocked and no completion event exists.
- Keep subagent tasks small and actionable. Do not make one subagent handle work that is too large or long-running; it should report progress or results back in time.
- Use `context_retriever` subagent for repo exploration, code search, file inspection, and context gathering.
- Keep all read-only investigation out of main agent session by default; main agent should ask `context_retriever` for focused findings with file references, then use only summarized evidence.
- Use `codebase-understanding` skill when user wants to understand implementation, trace flow through system, or generate code-understanding artifact; route through `codebase_understanding` subagent.

## Aitrium Skill Boundaries
- Use `aitrium` for Aitrium context, repo identity, shorthand, safety policy, task isolation policy, planning defaults, and repo-specific rules.
- Use `local-development` for local laptop services, Coder workspace access, port forwarding, Dockerized dependencies, and repo-local Node/Python environment templates.
- Use `aitrium-dev-workspace` for executable task workspace helpers, Git worktree bootstrap, tmux windows, cross-repo status, cross-repo diffs, and workspace command examples.
- Keep generated system skills under `agent-skills/skills/.system/` untracked and ignored.

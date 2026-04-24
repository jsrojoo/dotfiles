## Response Style
- Use `Caveman` plugin and `caveman` skill by default.
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

## 1. Permission Gate (only when explicitly requested)
- Code changes: editing source, scripts, configs, or docs.
- Git operations: add, commit, branch, tag, rebase, or similar.
- File creation: if you instruct me to create a file or you provide a directory path in response to a permission request, that reply grants permission to create the file in that directory, and I should not ask again.
- Skip permission gate after it is given once.

## 2. Planning & Approval
- For complex tasks, give a multi-step plan and wait for confirmation.
- Reply `g` means permission granted and good to proceed.
- Call out unknowns before continuing.
- Verify facts; do not assume.
- After plan approval, route command execution through registered `workflow_execution` subagent and use `plan_mode_tasks` for approved plan artifacts when needed.

## Behavioral guidelines

Behavioral rules to reduce common LLM coding mistakes. Merge with project-specific instructions when needed.

**Tradeoff:** Rules bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Do not pick silently.
- If simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name confusion. Ask.

### 2. Simplicity First

**Minimum code that solves problem. Nothing speculative.**

- No features beyond request.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that was not requested.
- No error handling for impossible scenarios.
- If you wrote 200 lines and 50 would do, rewrite it.

Ask: "Would senior engineer call this overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you spot unrelated dead code, mention it. Don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Test: every changed line should trace straight to user request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Turn tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") need constant clarification.

## Skills
- Mandatory: Use workflow-execution for any command execution (environment, tmux usage, command-running discipline), and route execution-heavy work through registered `workflow_execution` subagent.
- Mandatory: Use workflow-git for git practices and commit rules when asked to commit changes, and route git operations through registered `git_workflow` subagent.
- Mandatory: Use plan-mode-tasks when a Plan Mode plan is approved before implementation, and route `plan.md` and `tasks.md` creation or maintenance through registered `plan_mode_tasks` subagent.
- Mandatory: Use workflow-investigation for search and inspection tooling practices, and route broad or command-backed investigation through registered `workflow_investigation` subagent.
- Mandatory: In main agent session, use `context_retriever` for broad discovery, `workflow_investigation` for targeted evidence gathering, `workflow_execution` for command-execution discipline, and specialized workers for bounded implementation or testing tasks.
- Mandatory: Use workflow-testing for testing and verification behavior, and route test selection, execution, and concise reporting through registered `workflow_testing` subagent.
- Mandatory: Use workflow-code for coding conventions, TDD, naming, and error handling, and route implementation work through registered `workflow_code` subagent instead of doing code updates in main agent session.
- Mandatory: When delegating code changes to a subagent, explicitly require updates to normal project documentation when behavior, interfaces, configuration, or workflows change in same task.
- Mandatory: Use `codebase_understanding` only as fallback documentation artifact when no suitable documentation location exists for changed area.
- Mandatory: Use relevant skill, or smallest relevant set, for task at hand instead of relying on general reasoning when matching skill exists.
- Mandatory: Route tasks to specialized subagents when dedicated subagents exist, and never do that work directly in main agent session when appropriate dedicated subagent exists.
- Mandatory: Delegate well-scoped work to appropriate subagent only from main agent session when it cuts token use or keeps context smaller, especially for repo exploration, parallel investigation, testing, git hygiene, or isolated implementation work.
- Mandatory: Every spawned subagent prompt must explicitly include instructions to use `Caveman` plugin and `caveman` skill.
- Mandatory: All spawned subagents must use `Caveman` plugin and `caveman` skill by default at all times unless user explicitly overrides.
- Mandatory: Subagents must not spawn other subagents, including recursive same-type spawns such as a `workflow_code` subagent spawning another `workflow_code` subagent.
- Mandatory: After using a subagent, close it when it will not be reused later in task.
- Mandatory: Be patient with subagents that do not return in time. If a subagent seems stale, main agent may send a short health check like "are you still working?"; wait at least 15 minutes before treating run as failed, and if it still times out, main agent may spawn same subagent with tighter scope so it can finish quicker.
- Mandatory: Keep subagent tasks small and actionable. Do not make one subagent handle work that is too large or long-running; it should report progress or results back in time.
- Mandatory: Use `context_retriever` subagent for repo exploration and context gathering before broad local inspection, unless task is trivial or needed context is already known.
- Mandatory: Use `codebase-understanding` skill and route work through `codebase_understanding` subagent when user wants to understand implementation, trace flow through system, or generate code-understanding artifact.

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
- After plan approval, use workflow-execution guidance for commands and plan-mode-tasks for approved plan artifacts when needed; route through subagents only when current runtime policy allows subagent use.

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
- Mandatory: Use workflow-execution for command execution guidance, environment discipline, tmux usage, and command-running practices.
- Mandatory: Use workflow-git for git practices and commit rules when asked to commit changes.
- Mandatory: Use plan-mode-tasks when a Plan Mode plan is approved before implementation.
- Mandatory: Use workflow-investigation for search and inspection tooling practices.
- Mandatory: Use workflow-testing for testing and verification behavior.
- Mandatory: Use workflow-code for coding conventions, TDD, naming, and error handling.
- Mandatory: When delegating code changes to a subagent, explicitly require updates to normal project documentation when behavior, interfaces, configuration, or workflows change in same task.
- Mandatory: Use `codebase_understanding` only as fallback documentation artifact when no suitable documentation location exists for changed area.
- Mandatory: Use relevant skill, or smallest relevant set, for task at hand instead of relying on general reasoning when matching skill exists.
- Mandatory: Use specialized subagents only when subagent use is allowed by current runtime policy and task scope benefits from delegation.
- Mandatory: Delegate well-scoped work to appropriate subagent when allowed and when it cuts token use or keeps context smaller, especially for repo exploration, parallel investigation, testing, git hygiene, or isolated implementation work.
- Mandatory: Every spawned subagent prompt must explicitly include instructions to use `Caveman` plugin and `caveman` skill.
- Mandatory: All spawned subagents must use `Caveman` plugin and `caveman` skill by default at all times unless user explicitly overrides.
- Mandatory: Subagents must not spawn other subagents, including recursive same-type spawns such as a `workflow_code` subagent spawning another `workflow_code` subagent.
- Mandatory: After using a subagent, close it when it will not be reused later in task.
- Mandatory: Do not use routine ping or heartbeat checks for subagents. Prefer event-style completion handling: rely on `<subagent_notification>` messages, `wait_agent` completion status, and `SubagentStop` hook records in `tmp/subagent-stop-events.jsonl`. Send a health check only after a long `wait_agent` timeout when the next critical step is blocked and no completion event exists.
- Mandatory: Keep subagent tasks small and actionable. Do not make one subagent handle work that is too large or long-running; it should report progress or results back in time.
- Mandatory: Use `context_retriever` subagent for repo exploration and context gathering when subagent use is allowed, unless task is trivial or needed context is already known.
- Mandatory: Use `codebase-understanding` skill when user wants to understand implementation, trace flow through system, or generate code-understanding artifact; route through `codebase_understanding` subagent only when subagent use is allowed.

## Aitrium Skill Boundaries
- Use `aitrium` for Aitrium context, repo identity, shorthand, safety policy, task isolation policy, planning defaults, and repo-specific rules.
- Use `local-development` for local laptop services, Coder workspace access, port forwarding, Dockerized dependencies, and repo-local Node/Python environment templates.
- Use `aitrium-dev-workspace` for executable task workspace helpers, Git worktree bootstrap, tmux windows, cross-repo status, cross-repo diffs, and workspace command examples.
- Keep generated system skills under `agent-skills/skills/.system/` untracked and ignored.

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture / trace questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->

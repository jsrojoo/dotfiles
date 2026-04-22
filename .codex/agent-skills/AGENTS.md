## Response Style
- Always use the `Caveman` plugin and its `caveman` skill by default.
- End with a TL;DR only when it is relevant or necessary.
    - focus on the `meat` or essence, cover the why, what, how, when 
- Always reply succinctly, in markdown format.
- Phrase explanations so an average engineer can understand them quickly.
- Use markdown lists with one sentence per line, and add sub-lists only when needed for details.
- When there are multiple items or options, write them as markdown lists.
- The goal is to make the generated content easy to consume by the reader.
- Keep responses structured under short headers and include context about what changed, why, and remaining risks or next steps (if any).
- Back up your responses with facts by citing your sources such as:
    - file paths, adding line numbers only when referencing a specific line or line range; omit line numbers for whole-file references
    - use Vim `gF`-compatible examples like:
        - specific line: `path/to/file:12`
        - line range: `path/to/file:12-18`
    - man pages, tldr
    - URLs to articles or documentation bookmarks.

## 1. Permission Gate (only when explicitly requested)
- Code changes: editing source, scripts, configs, or docs.
- Git operations: add, commit, branch, tag, rebase, or similar.
- File creation: if you instruct me to create a file or you provide a directory path in response to a permission request, that response implies permission to create the file in that directory and I should not ask again.
- Skip permission gate once already given.

## 2. Planning & Approval
- Provide a multi-step plan for complex tasks and wait for confirmation.
- Reply with `g` means you have permissions and good to proceed.
- Call out unknowns before continuing.
- Verify facts instead of making assumptions.
- Once the plan is approved, route command execution through the registered `workflow_execution` subagent and use `plan_mode_tasks` for approved plan artifacts when needed.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Skills
- Mandatory: Always use workflow-execution for any command execution (environment, tmux usage and command-running discipline), and route execution-heavy work through the registered `workflow_execution` subagent.
- Mandatory: Always use workflow-git for git practices and commit rules when asked to commit changes, and route git operations through the registered `git_workflow` subagent.
- Mandatory: Always use plan-mode-tasks when a Plan Mode plan is approved before proceeding to implementation, and route `plan.md` and `tasks.md` creation or maintenance through the registered `plan_mode_tasks` subagent.
- Mandatory: Always use workflow-investigation for search and inspection tooling practices, and route broad or command-backed investigation through the registered `workflow_investigation` subagent.
- Mandatory: In the main agent session, use `context_retriever` for broad discovery, `workflow_investigation` for targeted evidence gathering, `workflow_execution` for command-execution discipline, and specialized workers for bounded implementation or testing tasks.
- Mandatory: Always use workflow-testing for testing and verification behavior, and route test selection, execution, and concise reporting through the registered `workflow_testing` subagent.
- Mandatory: Always use workflow-code for coding conventions, TDD, naming, and error handling, and route implementation work through the registered `workflow_code` subagent instead of doing code updates in the main agent session.
- Mandatory: When delegating code changes to a subagent, explicitly require updates to the normal project documentation when behavior, interfaces, configuration, or workflows change as part of the same task.
- Mandatory: Use `codebase_understanding` only as a fallback documentation artifact when no suitable documentation location exists for the changed area.
- Mandatory: Always use the relevant skill or minimal set of relevant skills for the task at hand instead of relying on general reasoning when a matching skill exists.
- Mandatory: Always route tasks to specialized subagents when dedicated subagents are available, and never perform that work directly in the main agent session when an appropriate dedicated subagent exists.
- Mandatory: Delegate well-scoped work to the appropriate subagent only from the main agent session when it reduces token usage or keeps context smaller, especially for repo exploration, parallelizable investigation, testing, git hygiene, or isolated implementation work.
- Mandatory: Every spawned subagent prompt must explicitly include instructions to use the `Caveman` plugin and its `caveman` skill.
- Mandatory: All spawned subagents must use the `Caveman` plugin and its `caveman` skill by default at all times unless the user explicitly overrides that requirement.
- Mandatory: Subagents must not spawn other subagents, including recursive same-type spawns such as a `workflow_code` subagent spawning another `workflow_code` subagent.
- Mandatory: After using a subagent, close it when it will no longer be reused later in the task.
- Mandatory: Be patient with subagents that do not return in time, and if a subagent seems stale, the main agent may send a short health check or heartbeat prompt such as "are you still working?"; wait at least 15 minutes before treating the run as failed, and if it still times out, the main agent may spawn the same subagent with a tighter scope of work so it can finish quicker.
- Mandatory: Keep subagent tasks small and actionable instead of making them handle work that is too large or long-running as one unit, so they can report progress or results back to the main agent in a timely manner.
- Mandatory: Use the `context_retriever` subagent for repo exploration and context gathering before broad local inspection, unless the task is trivial or the needed context is already known.
- Mandatory: Use the `codebase-understanding` skill and route work through the `codebase_understanding` subagent when the user wants to understand how something is implemented, trace a flow through the system, or generate a code-understanding artifact.

## Response Style
- Always reply succinctly, in markdown format.
- Phrase explanations so an average engineer can understand them quickly.
- Use markdown lists with one sentence per line, and add sub-lists only when needed for details.
- Keep responses structured under short headers and include context about what changed, why, and remaining risks or next steps (if any).
- Back up your responses with facts by citing your sources such as:
    - file path and line numbers (`file#L{d}`)
    - man pages, tldr
    - URLs to articles or documentation bookmarks.

## 1. Permission Gate (only when explicitly requested)
- Code changes: editing source, scripts, configs, or docs.
- Git operations: add, commit, branch, tag, rebase, or similar.

## 2. Planning & Approval
- Provide a multi-step plan for complex tasks and wait for confirmation.
- Reply with `g` to proceed.
- Call out unknowns before continuing.
- Verify facts instead of making assumptions.

## Skills
- Mandatory: Always use workflow-execution for any command execution (environment, tmux usage and command-running discipline).
- Mandatory: Always use workflow-git for git practices and commit rules when asked to commit changes.
- Mandatory: Always use plan-mode-tasks when a Plan Mode plan is approved before proceeding to implementation.
- Mandatory: Always use workflow-investigation for search and inspection tooling practices.
- Mandatory: Always use workflow-testing for testing and verification behavior.
- Mandatory: Always use workflow-code for coding conventions, TDD, naming, and error handling.

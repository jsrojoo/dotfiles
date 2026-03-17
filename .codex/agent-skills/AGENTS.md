## Response Style
- End with a TL;DR only when it is relevant or necessary.
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
- Cite sources directly under the relevant explanation bullet as a nested markdown sub-list.
- Do not group citations into a separate section header like `## Sources`.
- Do not repeat the same source citation multiple times in the same response when one citation already supports the relevant statement.
- Prefer the fewest citations needed for clarity, using compact line ranges where applicable.
- Bad example:
    - `- The implementation updates input validation and keeps backward compatibility.`
    - `- Source: path/to/file.md`
    - `- Source: path/to/file.md:10`
    - `- Source: path/to/file.md:11`
- Good example:
    - `- The implementation updates input validation and keeps backward compatibility.`
        - `- path/to/file.md:10-11`

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
- Once the plan is approved, use `workflow-execution`.

## Skills
- Mandatory: Always use workflow-execution for any command execution (environment, tmux usage and command-running discipline).
- Mandatory: Always use workflow-git for git practices and commit rules when asked to commit changes.
- Mandatory: Always use plan-mode-tasks when a Plan Mode plan is approved before proceeding to implementation.
- Mandatory: Always use workflow-investigation for search and inspection tooling practices.
- Mandatory: Always use workflow-testing for testing and verification behavior.
- Mandatory: Always use workflow-code for coding conventions, TDD, naming, and error handling.
- Mandatory: Use the `context_retriever` subagent for repo exploration and context gathering before broad local inspection, unless the task is trivial or the needed context is already known.

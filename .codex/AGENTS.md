## Response Style
- Always reply succinctly.
- Phrase explanations so an average engineer can understand them quickly.

## 1. Permission Gate (only when explicitly requested)
- Code changes: editing source, scripts, configs, or docs.
- Git operations: add, commit, branch, tag, rebase, or similar.

## 2. Planning & Approval
- Provide a multi-step plan for complex tasks and wait for confirmation.
- A reply of `g` means go ahead.
- Call out unknowns before continuing.
- Verify instead of making assumptions.

## 3. Environment & Execution Discipline
- Debug first and document the root cause before implementing fixes.
- When debugging, capture actual inputs/outputs and isolate logic into testable functions for focused tests.
- Python: activate `.venv/bin/activate` before executing any Python script to keep dependencies consistent.
- When running tools or scripts, describe the command and summarize key results; avoid destructive commands unless requested.
    - Use or create a tmux window named `codex-cli` in the current tmux session when executing commands.
        - see current windows with `tmux list-windows -F '#S:#W'`
        - send the command with `tmux send-keys`, then capture results via `tmux capture-pane`.
        - you don't need to enable the python venv in this tmux session, mise already handled that.

## 4. Investigation & Tooling Practices
- For `curl` checks, pipe output to a temp file and inspect it with `rg`, `head`, `tail`, etc., instead of printing everything.
- Prefer `rg`/`rg --files` for searches and note when another tool is used.
- `ast-grep` tool is available to you
    - it is a code tool for structural search and replace.
    - It is like syntax-aware grep/sed!

## 5. Communication Style
- Use markdown lists with one sentence per line; add sub-lists only when needed for details.
- Keep responses structured under short headers and include context about what changed, why, and remaining risks or next steps.

## 6. Testing & Verification
- Ensure that code changes are tested.
    - To efficiently do so, create a unit testable function that can be run independently.
    - Provide the bare minimum, essential input data, execute the unit test, then verify the output adheres to the expectation.
- Run tests only when asked or clearly required; explain why the test is needed and summarize the outcome.
- Use or create a tmux window named `test` in the current tmux session when running tests, refer to #3 Execution Discipline.
- If tests are skipped, explicitly state why and what is needed before running them.

## 7. Documentation of Constraints
- If sandbox or permission limits block a command, document it and request the necessary escalation.
- Log any deviations from these rules so the user stays informed.

## 8. Code Guide
- Keep the user in control of implementation details for each function.
- Name variables and functions by intent, keep them modular, deterministic, and easy to test; pass arguments explicitly.
- Use Tiger Style, big-endian naming convention:
    - Most Significant First: Place the core concept, category, or module at the beginning, followed by qualifiers (e.g., item_count instead of count_items).
    - Alphabetical Grouping: This convention ensures that related variables are sorted next to each other in a file, autocomplete menu, or code review tool, improving readability.
    - Suffix Qualifiers: If a variable has a qualifier (like _x, _y, _min, _max, _left, _right), it comes last.
    - Consistency: The goal is to provide a consistent mental model and reduce cognitive load.
- Avoid magic numbers / strings. 
- Prefer functional patterns, avoid globals and side effects, and always handle errors with appropriate log levels (info, debug, warn, error, fatal).
- using fallbacks and exception hiding means you haven't fixed the problem and now we have two bugs
    - python: try/except are handled properly by adding logging, never use `pass` on `except` block.
- Follow TDD: write a failing test first, then iterate until it passes.
- Write code for average humans: readable and easy to understand.
- Once a plan is good and we proceed with code implementation, it should be progressively done, not in go.
    - implement the smallest actionable item, write a test for it, make the test fail, add the implementation, iterate until it to works.
    - once we have a working code, generate an atomic git commit for it.
- When proposing architecture and system and database design items, utilize mermaid diagrams and markdown tables.

## 9. Git Practices
- Create atomic commits that follow conventional commit prefixes (chore, feat, fix, etc.).
    - Prefer surgical commits using `git add -p`, add changes that are related, and commit them atomically.
- Each commit should clearly explain the story of the changes made.

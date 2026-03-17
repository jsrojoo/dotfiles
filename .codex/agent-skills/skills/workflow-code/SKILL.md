---
name: workflow-code
description: Coding conventions, naming, and TDD guidelines.
---

## Delegation Model
- Route code implementation work through the registered `workflow_code` subagent instead of keeping all coding guidance in the parent thread.
- Invoke `workflow_code` when the task needs implementation, refactoring, naming cleanup, progressive delivery, or code validation guidance.
- Reuse the same `workflow_code` subagent for the rest of the turn's implementation work so code context stays in one place.
- Configure the subagent through `agents/workflow-code.toml` and `agents/workflow-code.md`, with model selection kept in the agent config.
- Keep git staging and commit work delegated to the registered `git_workflow` subagent instead of mixing commit hygiene into code implementation.

## Code Guide
- Keep the user in control of implementation details for each function.
- Name variables and functions by intent, keep them modular, deterministic, and easy to test; pass arguments explicitly.
- Use Tiger Style, big-endian naming convention.
- Most Significant First: Place the core concept, category, or module at the beginning, followed by qualifiers like item_count instead of count_items.
- Alphabetical Grouping: Ensure related variables are sorted next to each other in a file, autocomplete menu, or code review tool, improving readability.
- Suffix Qualifiers: If a variable has a qualifier like _x, _y, _min, _max, _left, _right, it comes last.
- Consistency: Provide a consistent mental model and reduce cognitive load.
- Avoid magic numbers or strings.
- Prefer functional patterns, avoid globals and side effects, and always handle errors with appropriate log levels: info, debug, warn, error, fatal.
- Using fallbacks and exception hiding means you haven't fixed the problem and now you have two bugs.
- Python: try and except are handled properly by adding logging, and never use pass in an except block.
- Follow TDD: write a failing test first, then iterate until it passes.
- Write code for average humans: readable and easy to understand.
- Avoid nesting (if/try/functions) when possible; flatten control flow to improve readability and reasoning.
- Once a plan is good and we proceed with code implementation, it should be progressive, not done in one go.
- Implement the smallest actionable item, write a test for it, make the test fail, add the implementation, and iterate until it works.
- Once we have working code, generate an atomic git commit for it and follow `workflow-git` skill for commit hygiene and grouping guidance.
- Validate code updates before moving on, preferring the current project's dev dependencies (formatters/linters/test commands) over ad hoc tooling.
- When proposing architecture and system and database design items, utilize mermaid diagrams and markdown tables.
- For responsive frontend layout guidance, read `references/responsive-frontend.md`.

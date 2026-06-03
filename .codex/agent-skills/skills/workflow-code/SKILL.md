---
name: workflow-code
description: Coding conventions, naming, and TDD guidelines.
---

## Delegation Model
- Route code implementation work through registered `workflow_code` subagent instead of keeping all coding guidance in parent thread.
- Invoke `workflow_code` when task needs implementation, refactoring, naming cleanup, progressive delivery, or code validation guidance.
- Reuse same `workflow_code` subagent for rest of turn's implementation work so code context stays in one place.
- Configure subagent through `agent-skills/agents/workflow-code.toml` and `agent-skills/agents/workflow-code.md`, with model selection kept in agent config.
- Keep git staging and commit work delegated to registered `git_workflow` subagent instead of mixing commit hygiene into code implementation.

## Code Guide
- Keep user in control of implementation details for each function.
- Name variables and functions by intent, keep them modular, deterministic, and easy to test; pass arguments explicitly.
- Use Tiger Style, big-endian naming convention.
- Most Significant First: put core concept, category, or module first, then qualifiers like `item_count` instead of `count_items`.
- Alphabetical Grouping: keep related variables sorted next to each other in file, autocomplete menu, or code review tool to improve readability.
- Suffix Qualifiers: if variable has qualifier like `_x`, `_y`, `_min`, `_max`, `_left`, `_right`, put it last.
- Consistency: provide stable mental model and reduce cognitive load.
- Avoid magic numbers or strings.
- Prefer functional patterns, avoid globals and side effects, and always handle errors with appropriate log levels: `info`, `debug`, `warn`, `error`, `fatal`.
- Using fallbacks and exception hiding means problem is not fixed and now you have two bugs.
- Python: handle `try` and `except` properly with logging, and never use `pass` in an `except` block.
- Follow TDD: write failing test first, then iterate until it passes.
- Write code for average humans: readable and easy to understand.
- Avoid nesting (`if`/`try`/functions) when possible; flatten control flow to improve readability and reasoning.
- Once plan is approved and implementation starts, do it progressively, not in one dump.
- Implement smallest actionable item, write test for it, make test fail, add implementation, and iterate until it works.
- When subagent performs code changes, update relevant documentation in same task so behavior, interfaces, configuration, and workflows stay aligned with implementation.
- If no relevant documentation exists for changed area, tell parent agent to use `codebase-understanding` to generate high-level, easy-to-digest artifact with diagrams or visuals.
- Once code works, generate atomic git commit for it and follow `workflow-git` skill for commit hygiene and grouping guidance.
- Validate code updates before moving on, preferring current project's dev dependencies (formatters/linters/test commands) over ad hoc tooling.
- When proposing architecture and system and database design items, use mermaid diagrams and markdown tables.
- For responsive frontend layout guidance, read `references/responsive-frontend.md`.

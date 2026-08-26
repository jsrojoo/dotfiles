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

## Coding Guidelines
- Keep user in control of implementation details for each function.
- Name variables and functions by intent, keep them modular, deterministic, and easy to test; pass arguments explicitly.
- Use Tiger Style, big-endian naming convention.
- Most Significant First: put core concept, category, or module first, then qualifiers like `item_count` instead of `count_items`.
- Alphabetical Grouping: keep related variables sorted next to each other in file, autocomplete menu, or code review tool to improve readability.
- Suffix Qualifiers: if variable has qualifier like `_x`, `_y`, `_min`, `_max`, `_left`, `_right`, put it last.
- Consistency: provide stable mental model and reduce cognitive load.
- Avoid magic numbers or strings.
- Prefer functional patterns, avoid globals and side effects, and always handle errors with appropriate log levels: `info`, `debug`, `warn`, `error`, `fatal`.
- Separate code into dedicated stages for data retrieval, data preparation, validation, and business logic.
- Keep core business logic pure: accept primitive values or immutable primitive-data records/collections as parameters.
- Do not pass request objects, ORM models, dataframes, SDK clients, response objects, or other infrastructure objects into core business logic.
- Keep parsing, deserialization, normalization, and enrichment out of core business logic; do that in data preparation functions.
- Keep I/O, queries, filesystem access, network calls, cache access, and environment reads in data retrieval functions.
- Keep validation separate from business logic; validation functions inspect prepared primitive inputs and return explicit valid inputs or errors.
- Prefer immutability: build new values from inputs instead of mutating inputs in place.
- Using fallbacks and exception hiding means problem is not fixed and now you have two bugs.
- Python: handle `try` and `except` properly with logging, and never use `pass` in an `except` block.
- Follow TDD when practical: write the smallest useful failing test first, then iterate until it passes.
- Write code for average humans: readable and easy to understand.
- Avoid nesting (`if`/`try`/functions) when possible; flatten control flow to improve readability and reasoning.
- Once plan is approved and implementation starts, do it progressively, not in one dump.
- Implement smallest actionable item, add or update focused tests when the task warrants it, and iterate until it works.
- When subagent performs code changes, update relevant documentation in same task so behavior, interfaces, configuration, and workflows stay aligned with implementation.
- If no relevant documentation exists for changed area, tell parent agent to use `codebase-understanding` to generate high-level, easy-to-digest artifact with diagrams or visuals.
- Once code works, report commit-ready changes to the parent agent so git work can be routed through `workflow-git`.
- Validate code updates before moving on, preferring current project's dev dependencies (formatters/linters/test commands) over ad hoc tooling.
- When proposing architecture and system and database design items, use Mermaid diagrams with top-down direction (`flowchart TD` or `graph TD`) and markdown tables unless user explicitly requests another orientation.
- For responsive frontend layout guidance, read `references/responsive-frontend.md`.

### Before Coding
- State assumptions explicitly before implementing; if uncertain, ask.
- If multiple interpretations exist, present them and do not choose silently.
- If a simpler approach exists, say so and explain the tradeoff.
- If the task is unclear, stop, name the confusion, and ask before editing.

### Simplicity First
- Build only what the request needs.
- Avoid abstractions, adapters, wrappers, fallback paths, optional flags, and configurability unless a current caller or requirement needs them.
- Do not add error handling for impossible scenarios.
- Prefer direct, boring code over generic helpers until duplication or complexity proves a helper is needed.
- Modify the existing code path that owns the behavior instead of creating a parallel implementation unless the request needs both.
- If the implementation becomes much larger than the actual requirement, simplify it before handoff.

### Surgical Changes
- Touch only files and lines needed for the request.
- Do not improve adjacent code, comments, formatting, or unrelated structure.
- Do not refactor working code unless the requested change requires it.
- Match existing style, even when another style seems better.
- Mention unrelated dead code or risks in handoff instead of deleting them.
- Remove imports, variables, functions, and files made unused by this task.
- Do not remove pre-existing dead code unless asked.
- Every changed line should trace directly to the user's request.

### Goal-Driven Execution
- Convert vague work into verifiable success criteria before coding.
- For bug fixes, write or identify a focused reproduction before changing code when practical.
- For validation changes, test invalid and valid inputs when practical.
- For refactors, preserve behavior and run relevant checks before and after when practical.
- Report verification with concrete proof snippets when output is large.

### SQL Execution Validation
- Read `references/sql-execution-validation.md` when work creates, changes, reviews, or validates SQL.

## Plain-English Pseudocode
- Before non-trivial implementation or refactor work, produce plain-English pseudocode.
- If approved `plan.md` already has `# Plain-English Pseudocode`, use it as source of truth.
- If no pseudocode exists, derive it from current task, code context, tests, and constraints before editing.
- Do not depend on `plan-mode-tasks`; `workflow-code` must be able to create task-local pseudocode itself.
- Write pseudocode inside a fenced `text` code block.
- Use multiline flow format: one domain step per line, in execution order.
- Keep pseudocode active during implementation; update it when behavior, helper boundaries, or data flow changes.
- Make pseudocode show separate retrieval, preparation, validation, and pure business-logic stages when code touches business behavior.
- Write pseudocode as domain steps, not implementation syntax.
- Prefer immutable flow: each step returns a new value instead of mutating shared state.
- Each line should map to one top-level orchestration statement, focused helper, or acceptance check.
- Preserve current behavior unless task explicitly asks for behavior change.
- If behavior is unclear, state the unknown before editing.

Use this shape:

```text
Retrieve [raw source data] from [source boundary].
Prepare [raw source data] into [primitive inputs].
Validate [primitive inputs] into [validated primitive inputs] or [validation errors].
Compute [business result] from [validated primitive inputs].
Build [output value] from [business result].
Return [output value] without mutating inputs.
```

## Immutable Implementation Flow
- Make top-level code read in same order as pseudocode.
- Prefer helpers that accept inputs and return outputs.
- Avoid helper side effects unless required by existing API, performance, transaction, or I/O boundary.
- If mutation is necessary, keep it local, name it clearly, and do not leak mutable intermediate state across unrelated helpers.
- Convert each meaningful pseudocode line into a clearly named helper when it reduces cognitive load.
- Put retrieval, preparation, validation, and business logic in separate helpers unless existing project shape makes that worse.
- Make core business helpers deterministic and easy to unit test with primitive-data inputs only.
- Treat parser/prep helpers as adapters from messy external shapes into primitive business inputs.
- Helper names should preserve domain language.
- Prefer names shaped like `[domain]_[thing]_[action]`, e.g. `_usage_pricing_rules_build`.
- Avoid vague mixed-concern helpers like `_process_items`, `_handle_records`, `_apply_all`, or `_do_work`.

Preferred refactor shape:

```python
def _usage_cost_summary_build(source_id):
    raw_usage_rows = _usage_rows_retrieve(source_id)
    usage_inputs = _usage_inputs_prepare(raw_usage_rows)
    valid_usage_inputs = _usage_inputs_validate(usage_inputs)
    cost_summary = _usage_cost_summary_compute(valid_usage_inputs)
    return _usage_cost_output_build(cost_summary)
```

Avoid this shape unless existing APIs force it:

```python
def _usage_cost_summary_build(request, db_session):
    raw_items = db_session.query(...)
    output_by_key = {}
    _primary_output_add(output_by_key, request, raw_items)
    _secondary_output_add(output_by_key, db_session)
    _domain_output_enrich(output_by_key)
    return _valid_output_filter(output_by_key)
```

## Execution Flow
- Read current code and tests.
- Write or derive plain-English pseudocode in a fenced multiline `text` code block.
- Compare pseudocode to existing behavior and invariants.
- Keep pseudocode beside the work as the implementation checklist.
- Implement top-level code so it mirrors pseudocode.
- Update pseudocode before code if the implementation path changes.
- Extract helpers only when they clarify one core concern.
- Run focused tests.
- Report pseudocode, changed helpers, tests, and behavior risk.

## Handoff Check
- Top-level function reads like plain-English pseudocode.
- Each helper owns one core concern.
- Retrieval, preparation, validation, and business logic are separated where code touches business behavior.
- Core business logic accepts primitive values or immutable primitive-data records/collections, not framework or infrastructure objects.
- Data flow is immutable by default, with any necessary mutation isolated and obvious.
- Names use domain terms.
- Tests prove behavior.
- Diff avoids unrelated cleanup.

---
name: workflow-code
description: Implement, refactor, and review code using focused scope, clear naming, incremental changes, and test-driven verification. Use for coding tasks that modify production behavior.
---

# Workflow Code

Use this workflow for implementation, refactoring, naming cleanup, and code review. Follow repository conventions and instructions before this general guidance.

## Before coding

- Confirm the requested behavior, constraints, and smallest useful outcome.
- Inspect the existing implementation and relevant tests before editing.
- State assumptions when ambiguity could materially affect the result.
- Present materially different interpretations instead of choosing silently.
- Prefer the simplest approach that satisfies the current requirement.

For non-trivial logic, write concise plain-English pseudocode before implementation:

```text
Retrieve required data from its source boundary.
Prepare it as explicit inputs.
Validate inputs at the appropriate boundary.
Compute the result without unrelated side effects.
Return or persist the required output.
```

Use only the stages relevant to the task. Do not force this structure onto simple code or codebases whose established design differs.

## Implementation

- Make the smallest complete change that addresses the root cause.
- Add only code required by the objective; do not fragment a coherent change merely to satisfy an arbitrary size limit.
- Preserve existing behavior unless the task explicitly changes it.
- Match the repository's architecture, naming, formatting, and error-handling conventions.
- Keep changes surgical; avoid unrelated cleanup and speculative abstractions.
- Prefer direct, readable control flow over generic helpers and deep nesting.
- Pass dependencies and inputs explicitly when practical.
- Keep I/O at clear boundaries and make business logic deterministic when the existing design supports it.
- Validate untrusted or external input, but do not add checks for states prevented by existing guarantees.
- Handle actionable failures explicitly; do not silently swallow exceptions or hide failures behind fallbacks.
- Remove imports and code made unused by the change, but leave pre-existing unrelated dead code alone.

## Naming

- Name functions and variables by domain intent rather than implementation detail.
- Prefer most-significant-first names when they improve grouping, such as `item_count` rather than `count_items`.
- Put qualifiers such as `_min`, `_max`, `_left`, and `_right` last.
- Avoid vague names such as `process_items`, `handle_data`, and `do_work`.
- Avoid unexplained magic values.

## Test-driven development

Use a red-green-refactor cycle for testable behavior changes. If TDD is impractical, state why and use the closest focused verification available.

### Red

- Define observable success criteria before changing production code.
- Add the smallest test that expresses one required behavior or reproduces one defect.
- Run it and confirm it fails for the expected reason, not because the test is broken.

### Green

- Make the smallest production change that passes the new test.
- Avoid unrelated refactoring or extra behavior while the test is red.
- Run the focused test until it passes.

### Refactor

- Improve names and structure only after the behavior passes.
- Keep tests green after each refactoring step.
- Run broader relevant checks when the focused behavior is stable.

## Verification practices

- Define observable success criteria before editing.
- For a bug fix, reproduce the failure with the smallest useful test when practical.
- For new behavior, write a focused failing test first when the project supports it.
- Test valid and invalid boundary inputs when validation changes.
- Run the narrowest relevant checks first, then broader checks when justified.
- Verify behavior rather than relying only on syntax, compilation, or snapshots.

## Specialized guidance

- For SQL creation, modification, review, or validation, read `references/database-sql-workflow.md`.
- For responsive frontend implementation or review, read `references/responsive-frontend.md`.

## Completion

- Update relevant documentation when behavior, interfaces, configuration, or workflows change.
- Report changed files, checks run, results, and remaining risks.
- Keep Git staging and commit operations outside this workflow unless the user explicitly requests them.

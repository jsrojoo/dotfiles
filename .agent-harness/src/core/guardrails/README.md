# Core guardrails

Core guardrails are deterministic, runtime-independent policies. They do not import Pi, Codex, Claude, UI, session, or filesystem APIs. Harness adapters translate native events into core state transitions, supply model completion, and own per-session storage and user interaction.

Pi keeps its responsibilities separate:

- `enforce-test-driven-development.ts` owns red-green state and `/tdd-skip`.
- `enforce-objective-scope.ts` owns change journaling, LLM milestones, corrective feedback, and drift notifications.

## Workflow-code guardrail

The workflow-code guardrail has two complementary parts:

- `workflow-code/policy.ts` enforces the deterministic red-green lifecycle.
- `workflow-code/judge.ts` checks semantic alignment with the user's objective at stable milestones.
- `workflow-code/types.ts` defines the shared adapter contract.

A harness adapter follows this lifecycle:

1. Capture the current objective and relevant conversation context when a request starts.
2. Before a write, call `workflowCodeWriteEvaluate()` and persist its returned state.
3. Record successful production edits with `workflowCodeImplementationProgressRecord()`.
4. When implementation progress is due, run an `implementation` judge before allowing the next production edit.
5. After a recognized test command, call the judge at the red or green milestone.
6. Apply `workflowCodeTestResultApply()` only when the judge returns `aligned` or is unavailable.
7. Before completion, call `workflowCodeCompletionEvaluate()`, then run the completion judge when deterministic verification is satisfied.
8. Use `workflowCodeStateSkip()` when the user activates a one-request TDD kill switch.

The judge receives bounded objective, conversation, change-journal, test, and prior-feedback data. It may request revision only with concrete evidence tied to the user's objective. It must not invent requirements, redesign the solution, reject a coherent change merely because it is large, or block subjective improvements. Harness adapters show an immediate milestone notification and persist each verdict as a session entry; `revise` verdicts also produce agent-facing corrective feedback. Malformed or unavailable judge responses fail open after one retry so model availability cannot deadlock implementation.

Implementation progress becomes due after three successful production edits or 4,000 characters of new production content. The current edit is never rejected merely for crossing that threshold; the judge checks alignment before the following production edit. An aligned checkpoint resets the progress counters.

The core policy does not claim that a failing test is relevant solely from its exit code; the red milestone judge performs that semantic check. Harness adapters may add persistence, notifications, and kill switches, but must not duplicate or redefine core policy.

## SQL validation guardrail

- `sql-validation/classify-sql.ts` identifies SQL execution, mutation, proof queries, and SQL presented in answers.
- `sql-validation/require-validation-proof.ts` records successful read-only proof and allows one corrective continuation when proof is missing.
- Pi loads `sql-validation/enforce-read-only-and-proof.ts`, which blocks agent-executed writes and DDL while requiring `SELECT ... WHERE` evidence before presenting data-targeting SQL.

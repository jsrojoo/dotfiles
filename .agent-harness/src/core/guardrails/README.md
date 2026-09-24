# Core guardrails

Core guardrails are deterministic, runtime-independent policies. They do not import Pi, Codex, Claude, UI, session, or filesystem APIs. Harness adapters translate native events into core state transitions, supply model completion, and own per-session storage and user interaction.

Pi keeps registration separate from reusable enforcement:

- `pi/extensions/workflow-code/register-test-driven-development.ts` maps Pi events to core TDD enforcement.
- `pi/extensions/workflow-code/register-objective-alignment.ts` maps Pi events to core alignment enforcement, model calls, corrective feedback, and drift notifications.

## Workflow-code guardrail

The workflow-code guardrail has three complementary parts:

- `workflow-code/enforce-test-driven-development.ts` enforces the deterministic red-green lifecycle.
- `workflow-code/enforce-objective-alignment.ts` owns objective state and milestone transitions.
- `workflow-code/judge-objective-alignment.ts` checks semantic alignment with the user's objective.
- `workflow-code/workflow-code-contracts.ts` defines the shared adapter contract.

A harness adapter follows this lifecycle:

1. Capture the current objective and relevant conversation context when a request starts.
2. Before a write, call `workflowCodeWriteEvaluate()` and persist its returned state.
3. Record successful production edits with `workflowCodeImplementationProgressRecord()`.
4. When implementation progress is due, run an `implementation` judge before allowing the next production edit.
5. After a recognized test command, call the judge at the red or green milestone.
6. Apply `workflowCodeTestResultApply()` only when the judge returns `align: true`.
7. Before completion, call `workflowCodeCompletionEvaluate()`, then run the completion judge when deterministic verification is satisfied.
8. Use `workflowCodeStateSkip()` when the user activates a one-request TDD kill switch.

The judge receives bounded objective, conversation, change-journal, test, and prior-feedback data. It may return `align: false` only with concrete evidence tied to the user's objective. It must not invent requirements, redesign the solution, reject a coherent change merely because it is large, or block subjective improvements. Harness adapters show an immediate milestone notification and persist each result as a session entry; `align: false` results also produce agent-facing corrective feedback. Malformed or unavailable judge responses fail open as `align: true` after one retry so model availability cannot deadlock implementation.

Implementation progress becomes due after three successful production edits or 4,000 characters of new production content. The current edit is never rejected merely for crossing that threshold; the judge checks alignment before the following production edit. An aligned checkpoint resets the progress counters.

The core policy does not claim that a failing test is relevant solely from its exit code; the red milestone judge performs that semantic check. Harness adapters may add persistence, notifications, and kill switches, but must not duplicate or redefine core policy.

## SQL validation guardrail

- `sql-validation/classify-sql.ts` identifies SQL execution, mutation, proof queries, and SQL presented in answers.
- `sql-validation/require-validation-proof.ts` records successful read-only proof and allows one corrective continuation when proof is missing.
- Pi loads `sql-validation/enforce-read-only-and-proof.ts`, which blocks agent-executed writes and DDL while requiring `SELECT ... WHERE` evidence before presenting data-targeting SQL.

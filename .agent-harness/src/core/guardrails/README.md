# Core guardrails

Core guardrails are deterministic, runtime-independent policies. They do not import Pi, Codex, Claude, UI, session, or filesystem APIs. A harness adapter translates native events into core state transitions, supplies model completion, and owns per-session storage and user interaction.

## Workflow-code guardrail

The workflow-code guardrail has two complementary parts:

- `workflow-code/policy.ts` enforces the deterministic red-green lifecycle.
- `workflow-code/judge.ts` checks semantic alignment with the user's objective at stable milestones.
- `workflow-code/types.ts` defines the shared adapter contract.

A harness adapter follows this lifecycle:

1. Capture the current objective and relevant conversation context when a request starts.
2. Before a write, call `workflowCodeWriteEvaluate()` and persist its returned state.
3. After a recognized test command, call the judge at the red or green milestone.
4. Apply `workflowCodeTestResultApply()` only when the judge returns `aligned` or is unavailable.
5. Before completion, call `workflowCodeCompletionEvaluate()`, then run the completion judge when deterministic verification is satisfied.
6. Use `workflowCodeStateSkip()` when the user activates a one-request TDD kill switch.

The judge receives bounded objective, conversation, change-journal, test, and prior-feedback data. It may request revision only with concrete evidence tied to the user's objective. It must not invent requirements, redesign the solution, or block subjective improvements. Malformed or unavailable judge responses fail open after one retry so model availability cannot deadlock implementation.

The core policy does not claim that a failing test is relevant solely from its exit code; the red milestone judge performs that semantic check. Harness adapters may add persistence, notifications, and kill switches, but must not duplicate or redefine core policy.

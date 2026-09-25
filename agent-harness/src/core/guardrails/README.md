# Core guardrails

Core guardrails are deterministic, runtime-independent policies. They do not import Pi, Codex, Claude, UI, session, or filesystem APIs. Harness adapters translate native events into core state transitions, supply model completion, and own per-session storage and user interaction.

Harness adapters keep registration separate from reusable enforcement:

- `pi/extensions/coding/register-test-driven-development.ts` maps Pi events to core TDD enforcement.
- `claude/tdd-hook.ts` and `codex/tdd-hook.ts` map host hook events to the same core TDD policy.
- `hooks/tdd-guardrail.ts` owns shared hook-state persistence and response mapping.
- `pi/extensions/coding/register-objective-alignment.ts` maps Pi events to core alignment enforcement, model calls, corrective feedback, and drift notifications.

Objective alignment is disabled in default Pi settings while it remains experimental. Enable it for one Pi process when developing or testing:

```bash
pi -e ~/dotfiles/agent-harness/src/pi/extensions/coding/register-objective-alignment.ts
```

## Coding skill guardrail

The coding skill guardrail has three complementary parts:

- `skills/coding/enforce-test-driven-development.ts` enforces concurrent test-and-implementation coverage followed by green verification.
- `skills/coding/objective-alignment/state-machine.ts` owns objective state and milestone transitions.
- `skills/coding/objective-alignment/llm.ts` checks semantic alignment with the user's objective.
- `skills/coding/coding-contracts.ts` defines the shared adapter contract.

A harness adapter follows this lifecycle:

1. Capture the current objective, relevant conversation context, and dirty workspace baseline when a request starts.
2. Before and after a write, call `workflowCodeWriteEvaluate()` and persist its returned state. Test and source writes may occur in either order or in parallel.
3. Reconcile mutating tool results against Git workspace state and record only net changes after the baseline. Fall back to direct edit/write events when Git state is unavailable.
4. When implementation progress is due, run an `implementation` judge before allowing the next production edit.
5. Reconcile workspace state before selecting the red or green milestone for a recognized test command.
6. Apply `workflowCodeTestResultApply()` only when the judge returns `align: true`. Green requires both a source change and a test change before the passing run.
7. Reconcile workspace state before completion, then call `workflowCodeCompletionEvaluate()` and run the completion judge when deterministic verification is satisfied. A source-only change remains incomplete.
8. Use `workflowCodeStateSkip()` when the user activates a one-request TDD kill switch.

The judge receives bounded objective, conversation, change-journal, test, and prior-feedback data. It may return `align: false` only with concrete evidence tied to the user's objective. It must not invent requirements, redesign the solution, reject a coherent change merely because it is large, or block subjective improvements. Aligned checks remain silent. Harness adapters show and persist only drift, rendered as objective, drift, and re-alignment guidance; `align: false` results also produce agent-facing corrective feedback. Malformed or unavailable judge responses fail open as `align: true` after one retry so model availability cannot deadlock implementation.

Implementation progress becomes due after three successful production edits or 4,000 characters of new production content. The current edit is never rejected merely for crossing that threshold; the judge checks alignment before the following production edit. An aligned checkpoint resets the progress counters.

The TDD core recognizes test commands by command shape; it does not establish semantic test relevance from exit status alone. Objective alignment's red milestone judge performs that additional semantic check. Harness adapters may add persistence, notifications, and kill switches, but must not duplicate or redefine core policy.

Claude and Codex hook adapters persist one state file per session under `~/.agent-harness/tdd/`. They intercept supported native edit tools; direct shell-based file writes are outside the current guardrail boundary. Use `AGENT_HARNESS_TDD_STATE_DIR` to relocate hook state.

## SQL guardrail

Core policy:

- `sql/classify-sql.ts` identifies SQL execution, mutation, proof queries, and SQL presented in answers.
- `sql/block-mutative-sql.ts` decides whether an executed command must be blocked.
- `sql/require-sql-validation.ts` records successful read-only proof and allows one corrective continuation when proof is missing.

Pi consumes that policy through thin adapters:

- `pi/extensions/sql/register-mutative-sql-blocking.ts`
- `pi/extensions/sql/register-sql-validation.ts`

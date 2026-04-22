---
name: workflow-testing
description: Testing and verification practices.
---

## Delegation Model
- Route testing and verification work through registered `workflow_testing` subagent instead of keeping validation guidance only in parent thread.
- Invoke `workflow_testing` when task needs test selection, focused verification, or concise test-result reporting.
- Reuse same `workflow_testing` subagent for rest of turn's validation work so test context stays in one place.
- Configure subagent through `agents/workflow-testing.toml` and `agents/workflow-testing.md`, with model selection kept in agent config.
- Have test execution follow execution discipline defined by `workflow-execution`, including tmux usage and output handling.

## Testing & Verification
- Ensure code changes are tested.
- To do that efficiently, create unit-testable function that can run independently.
- Provide bare minimum essential input data, execute unit test, then verify output matches expectation.
- Run tests only when asked or clearly required; explain why test is needed and summarize outcome.
- If tests are skipped, state why and what is needed before they can run.


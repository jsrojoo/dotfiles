---
name: workflow-testing
description: Testing and verification practices.
---

## Delegation Model
- Route testing and verification work through the registered `workflow_testing` subagent instead of keeping validation guidance only in the parent thread.
- Invoke `workflow_testing` when the task needs test selection, focused verification, or concise test-result reporting.
- Reuse the same `workflow_testing` subagent for the rest of the turn's validation work so the test context stays in one place.
- Configure the subagent through `agents/workflow-testing.toml` and `agents/workflow-testing.md`, with model selection kept in the agent config.
- Have test execution follow the execution discipline defined by `workflow-execution`, including tmux usage and output handling.

## Testing & Verification
- Ensure that code changes are tested.
- To efficiently do so, create a unit testable function that can be run independently.
- Provide the bare minimum, essential input data, execute the unit test, then verify the output adheres to the expectation.
- Run tests only when asked or clearly required; explain why the test is needed and summarize the outcome.
- If tests are skipped, explicitly state why and what is needed before running them.

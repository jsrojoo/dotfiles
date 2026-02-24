---
name: workflow-testing
description: Testing and verification practices.
---

## Testing & Verification
- Ensure that code changes are tested.
- To efficiently do so, create a unit testable function that can be run independently.
- Provide the bare minimum, essential input data, execute the unit test, then verify the output adheres to the expectation.
- Run tests only when asked or clearly required; explain why the test is needed and summarize the outcome.
- Use or create a tmux window named `test` in the current tmux session when running tests, and follow the execution discipline workflow.
- If tests are skipped, explicitly state why and what is needed before running them.

# End-to-end handoff

Use this workflow after implementation when end-to-end verification or a self-service handoff is useful.

## Test plan

Start by proposing a concise test plan aligned with how the user wants to verify the change. Confirm:

- user workflow and behavior under test
- test environment, prerequisites, and constraints
- scenarios, including relevant failure paths
- test data, intended mutations, and cleanup
- exact verification method, expected evidence, and pass/fail criteria
- artifacts to generate and whether the user or agent will run them

Ask focused questions when any choice materially changes the test. Prefer the user's existing tools and workflow over a new test harness.

Wait for explicit user approval of the test plan before generating artifacts or running the end-to-end test. Revise the plan when requested.

## Artifact generation

Generate only the approved artifacts. Unless the plan specifies another format, create a self-service bundle under `.local.artifacts/<task>/` containing:

- `implementation-summary.md`: behavior changed, files changed, known limitations, and expected result.
- `e2e/README.md`: prerequisites, required configuration and environment variable names without secret values, exact end-to-end commands, expected output, pass/fail criteria, and cleanup steps.
- `e2e/run.sh`: runnable verification that fails fast with a nonzero exit status and prints concise pass/fail evidence.
- `e2e/env.example`: required variable names with safe placeholders; never copy, print, or expose credentials.

Keep scripts consistent with the approved test plan and follow these safety rules:

- Remain read-only against production and shared environments.
- Exercise mutative behavior only when required and only against disposable, local, sandbox, or explicitly designated test resources.
- Validate the target environment before mutation and fail closed when the target cannot be proven safe.
- Do not modify Git state or files outside `.local.artifacts/<task>/`, except resources intentionally created by application behavior under test.
- Use unique test identifiers to avoid collisions.
- Verify resulting state and clean up test-created resources when safe.
- Print the intended target and mutation scope before execution.

Run `e2e/run.sh` only when approved and the environment permits. Save output to `.local.artifacts/<task>/e2e/result.txt`. If execution is unavailable, state the blocker and leave the exact user-run command.

Do not place handoff scripts or configuration in tracked repository paths unless the user explicitly requests permanent project tooling.

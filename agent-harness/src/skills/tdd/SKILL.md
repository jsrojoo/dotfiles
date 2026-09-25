---
name: tdd
description: Enforce test-driven development for code changes. Use when implementing, fixing, or refactoring testable behavior.
---

# Test-driven development

Require every implementation change to include a relevant test change and end with a passing watcher result.

1. Define observable success criteria and choose the smallest relevant test command.
2. Start one background watcher: `tdd-watch watch -- <test command>`. Use the background-job facility; do not wait for it to exit.
3. Add or update the test and implementation in either order or in parallel. The watcher reruns the command after changes.
4. Before completion, run `tdd-watch status`. This only inspects the latest watcher result; it does not rerun tests.
5. Refactor only while the watcher stays green.

Green requires the latest completed watcher run to pass and start after the latest dirty-file change. Missing, running, stale, or failed results are not green. A failing test before implementation is useful evidence, not a sequencing requirement. Source-only changes do not satisfy this workflow.

Use the project's native watch mode when it provides equivalent machine-readable freshness and exit status. The bundled watcher delegates filesystem monitoring to `watchexec`; do not build another polling loop. If neither is available, state why and use the closest focused verification.

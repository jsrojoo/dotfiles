# Agent Harness

Shared coding-agent harness for Pi, Claude Code, and Codex.

Pi includes a bundled `context` coordinator. The main session makes one focused context call; that coordinator fans out internally to 2-4 non-overlapping, read-only `context-retriever` leaves and synthesizes one handoff. Give each invocation a short optional `purpose`; Pi displays it as `<agent>: <purpose>` without changing the registered agent name. Retrieval leaves have no `subagent` extension, so fanout stops after one nested level. The dedicated `git` tool exposes repository status, diffs, and history without mutation access.

Installable Claude Code and Codex package around shared TDD policy in `src/core/guardrails/skills/coding/enforce-test-driven-development.ts`. The package exposes only the focused `src/skills/tdd/` skill; broader coding workflows remain outside the plugin.

Guardrail message: require a relevant test change alongside implementation and a fresh passing watcher result before completion.

## Install

Use `agent-harness/` as a standalone Git repository or checked-out package root. It is currently nested in the dotfiles repository; plugin marketplace installs from Git need this directory published as a repository root first.

Claude Code:

```sh
claude plugin marketplace add /path/to/agent-harness
claude plugin install agent-harness-tdd@agent-harness
```

Codex:

```sh
codex plugin marketplace add /path/to/agent-harness
codex plugin add agent-harness-tdd@agent-harness
```

Start a new agent session after installation.

## Behavior and limits

- `/tdd-skip` skips guardrail for next request.
- Test and implementation edits may happen in either order or in parallel.
- `tdd-watch watch -- <test command>` delegates file watching to `watchexec` and records each run's status.
- `tdd-watch status -- <same focused test command>` verifies the exact watcher command and that its latest run passed after the latest dirty-file change without rerunning tests. In Pi, a successful command-bound status also completes the implementation flow without a separate `implementation_done` call.
- After implementation changes, guardrail requires a relevant test change and a fresh passing watcher result before finishing.
- TDD state is stored per session under `~/.agent-harness/tdd/`; set `AGENT_HARNESS_TDD_STATE_DIR` to override.
- Hooks inspect supported edit tools (`Edit`/`Write` in Claude; `apply_patch` in Codex) and common test commands. Shell commands that modify files directly bypass edit blocking.
- Core recognizes test commands by command shape; it does not establish that a failed test semantically covers requested behavior.
- Atomic state-file replacement assumes host serializes hooks within a session; concurrent hook events can race.
- Watch mode requires `watchexec` on `PATH` and a Git workspace for freshness checks.
- Hook execution requires Node.js 22.6 or newer with `--experimental-strip-types` support.
- Pi agent definitions live under `agents/`; Pi extensions live under `src/pi/extensions/`.

## Verify

From `agent-harness/`:

```sh
npm test
npm run lint:imports
claude plugin validate . --strict
```

## Watch workflow

Start one watcher in a background job from the target repository:

```sh
tdd-watch watch -- npm test
```

After edits, inspect its latest completed run without running tests again:

```sh
tdd-watch status -- npm test
```

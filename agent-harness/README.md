# Agent Harness TDD Guardrail

Installable Claude Code and Codex package around shared TDD policy in `src/core/guardrails/skills/coding/enforce-test-driven-development.ts`. The package exposes only the focused `src/skills/tdd/` skill; broader coding workflows remain outside the plugin.

Guardrail message: require a relevant test change alongside implementation and a passing test before completion.

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
- After implementation changes, guardrail requires a relevant test change and a passing recognized test before finishing.
- TDD state is stored per session under `~/.agent-harness/tdd/`; set `AGENT_HARNESS_TDD_STATE_DIR` to override.
- Hooks inspect supported edit tools (`Edit`/`Write` in Claude; `apply_patch` in Codex) and common test commands. Shell commands that modify files directly bypass edit blocking.
- Core recognizes test commands by command shape; it does not establish that a failed test semantically covers requested behavior.
- Atomic state-file replacement assumes host serializes hooks within a session; concurrent hook events can race.
- Hook execution requires Node.js 22.6 or newer with `--experimental-strip-types` support.

## Verify

From `agent-harness/`:

```sh
npm test
claude plugin validate . --strict
```

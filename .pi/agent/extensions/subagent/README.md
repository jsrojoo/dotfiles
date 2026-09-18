# Shared-agent discovery for Pi

This installs Pi's reference `subagent` extension and extends agent discovery to reuse shared agent definitions without generating duplicate prompt files.

## Sources and precedence

For `agentScope: "user"`, agents are loaded from:

1. `~/.agents/agents/<name>.toml` paired with `~/.agents/agents/<name>.md`
2. `~/.pi/agent/agents/*.md`

Pi-native user agents override shared agents with the same name. With `agentScope: "both"`, project-local `.pi/agents/*.md` definitions override both.

## Shared agent metadata mapping

| Shared agent metadata | Pi behavior |
| --- | --- |
| `name` | Agent name |
| `description` | Agent description |
| Paired `.md` file | Subagent system prompt |
| `model_provider` + `model` | Pi `provider/model` selector |
| `sandbox_mode = "read-only"` | Restricts tools to `read`, `grep`, `find`, and `ls` |
| Other `sandbox_mode` values | Uses Pi's default tool set |

Provider and model values are converted to Pi model selectors. In this setup, the Pi adapter maps the shared `atlas` provider to `azure` while preserving each model ID; the shared TOML files remain unchanged for other harnesses.

## Current limitations

- `model_reasoning_effort` is not mapped; a model-specific Pi subagent uses Pi's default thinking behavior.
- Approval policies and sandbox implementations are not imported.
- Read-only shared agents do not receive `bash`, so prompts mentioning `rg` or `ast-grep` must fall back to Pi's `grep`, `find`, and `read` tools.
- A TOML definition is ignored unless its paired Markdown prompt exists and both `name` and `description` are simple quoted strings.

## Usage

Ask Pi to delegate through the `subagent` tool, for example:

```text
Use context_retriever to inspect the repository and return a concise handoff.
```

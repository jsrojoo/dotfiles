# Codex subagent adapter for Pi

This installs Pi's reference `subagent` extension and extends its agent discovery so existing Codex agents can be reused without generating duplicate prompt files.

## Sources and precedence

For `agentScope: "user"`, agents are loaded from:

1. `~/.agents/agents/<name>.toml` paired with `~/.agents/agents/<name>.md`
2. `~/.pi/agent/agents/*.md`

In the current setup, `~/.agents` is a symlink to `~/.codex`, so this remains compatible while using the harness-neutral path.

Pi-native user agents override imported Codex agents with the same name. With `agentScope: "both"`, project-local `.pi/agents/*.md` definitions override both.

## Codex field mapping

| Codex field | Pi behavior |
| --- | --- |
| `name` | Agent name |
| `description` | Agent description |
| Paired `.md` file | Subagent system prompt |
| `model_provider` + `model` | Pi `provider/model` selector |
| `sandbox_mode = "read-only"` | Restricts tools to `read`, `grep`, `find`, and `ls` |
| Other `sandbox_mode` values | Uses Pi's default tool set |

The local provider map currently translates Codex provider `atlas` to Pi provider `azure`, because the same configured models are exposed through that provider in this Pi installation.

## Current limitations

- Codex `model_reasoning_effort` is not mapped; a model-specific Pi subagent uses Pi's default thinking behavior.
- Codex approval policies and sandbox implementations are not imported.
- Read-only Codex agents do not receive `bash`, so prompts mentioning `rg` or `ast-grep` must fall back to Pi's `grep`, `find`, and `read` tools.
- A TOML definition is ignored unless its paired Markdown prompt exists and both `name` and `description` are simple quoted strings.

## Usage

Ask Pi to delegate through the `subagent` tool, for example:

```text
Use context_retriever to inspect the repository and return a concise handoff.
```

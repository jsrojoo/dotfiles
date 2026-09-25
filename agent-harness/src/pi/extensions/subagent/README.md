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
| Pi-native `fallbackModels` | Up to two ordered fallback selectors after `model` |
| `sandbox_mode = "read-only"` | Restricts tools to `read`, `grep`, `find`, and `ls` |
| `sandbox_mode = "read-only-with-bash"` | Adds `bash` for controlled Git or test commands; prompt policy remains required |
| Other `sandbox_mode` values | Uses Pi's default tool set |

Pi-native agent frontmatter also accepts comma-separated or YAML-array `skills` and `extensions` fields. Omit a field to preserve normal child discovery, use an empty array to load none, or list names to load only matching resources. Skill names resolve from project and user skill directories; extension names resolve from `~/.pi/agent/extensions`. Explicit paths are also accepted.

Provider and model values are converted to Pi model selectors. Shared child agents use their explicit TOML `model_provider` when set. When it is missing, an active main provider of exactly `azure`, `atlas`, or `atlas-bedrock` supplies the provider while preserving the TOML model ID. Otherwise, the model remains bare. Pi-native and project-local agent model selectors are not rewritten and retain discovery precedence.

Pi-native agents may define `fallbackModels` as a YAML list. The primary model plus fallbacks are deduplicated and capped at three attempts. Failed attempts advance to the next model only when the agent explicitly lists read-only tools; mutation-capable agents reject fallback configuration.

## Child extensions

Child `pi` processes start with `-ne` (no extension discovery). By default they add `-e` for each local file or directory `index.ts`/`index.js` under `~/.pi/agent/extensions/`, except `subagent` itself. An agent's `extensions` field replaces that default list. Its `skills` field adds `-ns` plus one explicit `--skill` per selected skill.

- Package extensions from `settings.json` (for example `pi-patty-bg-tasks`, ponytail) do not load in children. `pi-patty-bg-tasks` replaces `bash` with an unref'd detached spawn, which made `pi -p` exit mid tool call and return no output.
- `coding-tdd.ts` is a local wrapper around the shared TDD adapter, so both parent and child Pi processes load the guardrail.
- Excluding `subagent` blocks nested subagent spawns.

## Current limitations

- `model_reasoning_effort` is not mapped; a model-specific Pi subagent uses Pi's default thinking behavior.
- Approval policies and sandbox implementations are not imported.
- Read-only shared agents do not receive `bash`, so prompts mentioning `rg` or `ast-grep` must fall back to Pi's `grep`, `find`, and `read` tools.
- `read-only-with-bash` agents receive `bash` in addition to read-only tools. Bash can still mutate files, so prompt-level approval rules remain mandatory; this mode is intended for narrowly scoped Git or test workflows.
- The `editor` agent receives `bash` only for running tests; its prompt still restricts file mutations to `edit`.
- A TOML definition is ignored unless its paired Markdown prompt exists and both `name` and `description` are simple quoted strings.

## Usage

Ask Pi to delegate through the `subagent` tool, for example:

```text
Use context to inspect the repository and return a concise handoff.
```

Run independent investigations in one parallel call with at most four `context` tasks. The extension already enforces four concurrent child processes. The `context` agent has no shell or mutation tools; its safe `grep` and `find` tools use `rg` and `fd` internally. External services require dedicated clients with verified read-only connections and read-only queries.

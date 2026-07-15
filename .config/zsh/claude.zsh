claude() {
  if [[ -z "${AITRIUM_LLM_PASSTHROUGH:-}" ]]; then
    print -u2 "AITRIUM_LLM_PASSTHROUGH is not set"
    return 1
  fi

  local settings_file
  settings_file="$(mktemp "${TMPDIR:-/tmp}/claude-default-settings.XXXXXX")"
  trap "rm -f '$settings_file'" EXIT

  CLAUDE_PROVIDER_SETTINGS="$HOME/.claude/settings.json" \
  CLAUDE_PROVIDER_TOKEN="$AITRIUM_LLM_PASSTHROUGH" \
  CLAUDE_PROVIDER_OUTPUT="$settings_file" \
    python3 - <<'PY'
import json
import os

settings_path = os.environ["CLAUDE_PROVIDER_SETTINGS"]
output_path = os.environ["CLAUDE_PROVIDER_OUTPUT"]
token = os.environ["CLAUDE_PROVIDER_TOKEN"]

with open(settings_path, "r", encoding="utf-8") as handle:
    settings = json.load(handle)

settings_env = settings.setdefault("env", {})
settings_env["ANTHROPIC_AUTH_TOKEN"] = token
settings_env["AWS_BEARER_TOKEN_BEDROCK"] = token

with open(output_path, "w", encoding="utf-8") as handle:
    json.dump(settings, handle, indent=2)
    handle.write("\n")
PY

  command claude --settings "$settings_file" "$@"
}

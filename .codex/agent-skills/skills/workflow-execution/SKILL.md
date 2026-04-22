---
name: workflow-execution
description: Environment setup and command execution discipline.
---

## Delegation Model
- Route shell execution discipline through registered `workflow_execution` subagent instead of keeping command-running hygiene only in prose.
- Invoke `workflow_execution` when task needs environment setup, tmux coordination, temp-file handling, or disciplined command execution.
- Reuse same `workflow_execution` subagent for rest of turn's execution-heavy work so shell context stays consistent.
- Configure subagent through `agents/workflow-execution.toml` and `agents/workflow-execution.md`, with model selection kept in agent config.

## Environment & Execution Discipline
- Debug first and document root cause before implementing fixes.
- When debugging, capture actual inputs and outputs and isolate logic into testable functions for focused tests.
- Use shell specified by environment context, such as `<shell>` or `$SHELL`.
- Python: activate `.venv/bin/activate` before executing any Python script to keep dependencies consistent.
- When running tools or scripts, describe command and summarize key results; avoid destructive commands unless requested.
- Prefer temp script files for multi-line commands or complex quoting; run simple one-liners directly.
- Use or create tmux window named `codex-cli` in current tmux session when executing complex commands so user can inspect commands and output.
    - See current windows with tmux list-windows -F '#S:#W'.
    - Use `tmux send-keys` sparingly, and only when user explicitly requests it.
- Check temp file size with `wc -l`; if it exceeds 50 lines, prefer `sed`, `head`, or `tail` over `cat`.
- Remove temp files as last step after task is complete and report cleanup failures with warn-level note.
- You don't need to enable python venv in this tmux session; `mise` already handled that.
- If sandbox or permission limits block command, document it and request needed escalation.
- Log any deviations from these rules so user stays informed.


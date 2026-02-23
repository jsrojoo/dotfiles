---
name: workflow-execution
description: Environment setup and command execution discipline.
---

## Environment & Execution Discipline
- Debug first and document the root cause before implementing fixes.
- When debugging, capture actual inputs and outputs and isolate logic into testable functions for focused tests.
- Use the shell specified by the environment context (e.g., `<shell>` or `$SHELL`).
- Python: activate .venv/bin/activate before executing any Python script to keep dependencies consistent.
- When running tools or scripts, describe the command and summarize key results; avoid destructive commands unless requested.
- Prefer temp script files for multi-line commands or complex quoting; run simple one-liners directly.
- Use or create a tmux window named `codex-cli` in the current tmux session when executing complex commands to allow the user to inspect the commands and output.
    - See current windows with tmux list-windows -F '#S:#W'.
    - Use `tmux send-keys` sparingly, and only when the user explicitly requests it.
- Check temp file size with `wc -l`; if it exceeds 50 lines, prefer `sed`, `head`, or `tail` over `cat`.
- Remove temp files as the last step after the task is completed and report cleanup failures with a warn-level note.
- You don't need to enable the python venv in this tmux session, mise already handled that.
- If sandbox or permission limits block a command, document it and request the necessary escalation.
- Log any deviations from these rules so the user stays informed.

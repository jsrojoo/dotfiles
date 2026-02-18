---
name: workflow-execution
description: Environment setup and command execution discipline.
---

## Environment & Execution Discipline
- Debug first and document the root cause before implementing fixes.
- When debugging, capture actual inputs and outputs and isolate logic into testable functions for focused tests.
- Python: activate .venv/bin/activate before executing any Python script to keep dependencies consistent.
- When running tools or scripts, describe the command and summarize key results; avoid destructive commands unless requested.
- Use or create a tmux window named codex-cli in the current tmux session when executing commands.
- See current windows with tmux list-windows -F '#S:#W'.
- Use a temp file for test scripts instead of using multiple send-keys for multi line code.
- Send the execute command with `tmux send-keys`, then send the output into a temp file.
- Remove temp files after use and report cleanup failures with a warn-level note.
- You don't need to enable the python venv in this tmux session, mise already handled that.
- If sandbox or permission limits block a command, document it and request the necessary escalation.
- Log any deviations from these rules so the user stays informed.

Only perform the following when explicitly specified:

- code changes
- git operations such as add, commit

Always keep in mind:

- When a task is complex, provide an plan on how to tackle a problem first. Make sure that I agree before moving on.
- When running python scripts, enable the virtual environment `.venv` in the current directory.
- Always do debugging and finding out the root cause first instead of jumping into code fixing.
- If you're testing a curl command, pipe the result into a temporary file, then use rg, head, tail or other commands to efficiently inspect the response.

### Multi-session tmux workflow

- Run each Codex effort inside its own named tmux session (`codex:<task>`) so panes stay isolated and easy to switch.
- Keep a supervisor pane/session whose sole job is to read buffers via `tmux capture-pane -pS -200 -t codex:<task>` when you need cross-task context or to brief another agent.
- When pausing or handing off, record the active session names plus the buffer timestamp so the next person can replay history with `tmux show-buffer -t codex:<task>`.
- Retire or rename idle sessions once their work is done to prevent stale context leaking into new tasks.


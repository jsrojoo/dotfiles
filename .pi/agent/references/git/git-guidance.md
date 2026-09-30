# Git guidance

- When the `git` subagent is available, delegate Git commands and operations to it immediately.
- An already-running `git` subagent executes Git commands directly without nested delegation.
- If the `git` subagent is unavailable, use direct Git commands when required and disclose the fallback.
- Do not invent Git work when it is not needed.

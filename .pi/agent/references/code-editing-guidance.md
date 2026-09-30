# Code-editing guidance

- When the `editor` subagent is available, delegate code and configuration changes to it.
- The editor follows the shared `coding` skill and returns changed paths and verification results.
- If the editor or shared skill is unavailable, make the smallest safe edit with the available direct tools.
- Keep integration review and final verification in the main session when those tools are available; otherwise perform them directly.
- After implementation and fresh verification, call `implementation_done` when that tool is available; otherwise provide the normal completion response.

[PLAN MODE ACTIVE]
You are in plan mode - a read-only exploration mode for safe code analysis.

Restrictions:
- Built-in edit and write tools are disabled
- Other currently active tools remain available
- Bash is restricted to an allowlist of read-only commands

Ask only clarifying questions that block a sound plan.

Read and follow the `plan` skill and `ponytail` skill. Apply Ponytail only after understanding the full change path, then produce the smallest complete numbered plan under the exact `Plan:` heading. Structure it as scope-based top-level phases in chronological execution order, with detailed substeps as nested non-numbered bullets. After the plan and required views, end with `High-level summary:` and then `TL;DR:` as the final visible content.

Do NOT make changes or write plan artifacts. Wait for explicit user approval; artifact creation through `plan-mode-tasks` belongs to implementation after leaving read-only Plan Mode.

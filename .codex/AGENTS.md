## 1. Permission Gate (do only when explicitly requested)
- Code changes: any edits to source, scripts, configs, docs.
- Git operations: add/commit/branch/tag/rebase/etc.

## 2. Planning & Approval
- For complex tasks, present a clear multi-step plan and wait for confirmation.
- Highlight assumptions or unknowns before moving forward.

## 3. Environment & Execution Discipline
- Always debug and identify root cause before writing fixes; share findings.
- Activate `.venv/bin/activate` before running any Python script to keep dependencies consistent.
- When running tests or tools, describe commands and summarize key results; do not auto-run destructive actions.

## 4. Investigation & Tooling Practices
- For `curl` checks, pipe output to a temp file, then inspect with `rg`, `head`, `tail`, etc., instead of dumping full responses.
- Prefer `rg`/`rg --files` for searches; note if falling back to another tool.

## 5. Communication Style
- Structure responses with bullets/lists so they’re easy to scan; avoid large unstructured paragraphs.
- Include concise context: what changed, why, and remaining risks or next steps.

## 6. Testing & Verification
- Run tests only when instructed or clearly required; explain the purpose and summarize outcomes.
- If tests are skipped, state why and what would need to happen before running them.

## 7. Documentation of Constraints
- If sandbox or permission limits block a command, note it and request the needed escalation.
- Log any deviations from these rules so the user can make an informed decision.

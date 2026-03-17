---
name: workflow-investigation
description: Investigation and tooling practices.
---

## Delegation Model
- Route search and inspection work through the registered `workflow_investigation` subagent instead of keeping broad repo inspection in the parent thread.
- Invoke `workflow_investigation` for targeted search, evidence gathering, output inspection, and structural queries.
- Reuse the same `workflow_investigation` subagent for the rest of the turn's investigation work so the search context stays cohesive.
- Configure the subagent through `agents/workflow-investigation.toml` and `agents/workflow-investigation.md`, with model selection kept in the agent config.
- Have investigation work follow the execution discipline defined by `workflow-execution` when commands, temp files, or output inspection are involved.

## Investigation & Tooling Practices
- Follow `workflow-execution` for temp-file, output inspection, and cleanup behavior.
- For curl checks, pipe output to a temp file and inspect it with rg, head, tail, or similar tools instead of printing everything.
- Prefer rg or rg --files for searches and note when another tool is used.
- ast-grep is available for structural search and replace, like syntax-aware grep or sed.

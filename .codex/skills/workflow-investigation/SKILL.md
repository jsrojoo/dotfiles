---
name: workflow-investigation
description: Investigation and tooling practices.
---

## Investigation & Tooling Practices
- For curl checks, pipe output to a temp file and inspect it with rg, head, tail, or similar tools instead of printing everything.
- Remove temp files after inspection and report cleanup failures with a warn-level note.
- Prefer rg or rg --files for searches and note when another tool is used.
- ast-grep is available for structural search and replace, like syntax-aware grep or sed.

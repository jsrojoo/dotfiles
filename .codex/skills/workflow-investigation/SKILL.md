---
name: workflow-investigation
description: Investigation and tooling practices.
---

## Investigation & Tooling Practices
- For curl checks, pipe output to a temp file and inspect it with rg, head, tail, or similar tools instead of printing everything.
- Check temp file size with `wc -l`; if it exceeds 50 lines, prefer `sed`, `head`, or `tail` over `cat`.
- Prefer rg or rg --files for searches and note when another tool is used.
- ast-grep is available for structural search and replace, like syntax-aware grep or sed.
- Remove temp files as the last step after the task is completed and report cleanup failures with a warn-level note.

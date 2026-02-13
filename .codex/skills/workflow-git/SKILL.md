---
name: workflow-git
description: Git workflow and commit practices.
---

## Git Practices
- Create atomic commits that follow conventional commit prefixes like chore, feat, fix, or similar.
- Enforce atomic commits by splitting unrelated changes into separate commits or explicitly asking before grouping.
- Before doing any git operations, ensure that you use `--no-pager` flag.
- Prefer surgical commits
    - perform a `git diff` then identify related changes
    - then use `git add -p`, add chunks of changes that are related
    - then commit them atomically.
- Each commit message must include a subject and a concise body.
    - use a multi-line message with a blank line between subject and body.
    - keep the body to 1-2 short sentences describing what changed and why.
- Default to conventional, atomic commits without asking; only ask when the user explicitly requests a different approach.

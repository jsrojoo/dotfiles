---
name: workflow-git
description: Git workflow and commit practices.
---

## Git Practices
- Create atomic commits that follow conventional commit prefixes like chore, feat, fix, or similar.
- Before doing any git operations, ensure that you use `--no-pager` flag.
- Prefer surgical commits
    - perform a `git diff` then identify related changes
    - then use `git add -p`, add chunks of changes that are related
    - then commit them atomically.
- Each commit should clearly explain the story of the changes made.
    - provide a succint description of the code change within the commit.
- Default to conventional, atomic commits without asking; only ask when the user explicitly requests a different approach.

---
name: git
description: Review Git changes, stage surgical commits, and maintain commit and merge-request hygiene.
---

# Git

Use this skill for diff review, staging, commits, rebases, pushes, and merge-request hygiene. Obtain user approval before any Git write.

## Safety

- Run `git --no-pager status` and `git --no-pager diff` before choosing a staging plan.
- Stage only files or hunks belonging to requested change.
- Never stage secrets, credentials, tokens, private keys, or dotenv files.
- Never revert, reset, discard, or overwrite unrelated work.
- Keep generated files, caches, runtime state, and local task artifacts untracked unless explicitly required.
- Report unexpected unrelated changes instead of modifying them.

## Atomic commits

- Keep each commit focused on one coherent change.
- Split unrelated changes into separate commits or ask before grouping them.
- Use conventional commit prefixes such as `chore`, `feat`, `fix`, or `refactor`.
- Include concise subject and body separated by a blank line.
- Write commit messages in clear prose even when another response style is active.
- Use `git commit --amend` only for most recent local commit.
- For older local commits, prefer `fixup!` commits followed by interactive autosquash before sharing.

## Surgical staging

Prefer whole-file staging when every change belongs to commit. When files contain mixed changes:

1. Inspect diff and identify related hunks.
2. Use bundled `group-patches.sh` to select groups by file and line range.
3. Review generated patch for scope and correctness.
4. Validate with `git apply --check`.
5. Stage non-interactively with `git apply --cached`.

```bash
<skill-directory>/group-patches.sh -o /tmp/patches api=src/a.py:10-30,src/b.py:5-9
git apply --check /tmp/patches/api.patch
git apply --cached /tmp/patches/api.patch
```

Exclude unwanted ranges without rebuilding selection manually:

```bash
<skill-directory>/group-patches.sh --dry-run api=src/a.py:10-30,!src/a.py:15-18
```

Keep each selected hunk's `diff --git`, `index`, and `---`/`+++` headers intact. Do not edit `@@ -a,b +c,d @@` counts unless recalculating patch structure correctly.

## Merge requests

Before creating merge request:

- Verify `pwd`, `git remote get-url origin`, and repository identity.
- Run command from target repository or worktree.
- Pass repository explicitly when client supports it.
- Assign authenticated user as both assignee and reviewer on every created merge request.
- Do not reuse recovery file produced from wrong-repository attempt.

For `glab`, resolve authenticated username and pass it to both fields:

```bash
username="$(glab api user --jq .username)"
glab mr create --repo <group/project> --assignee "$username" --reviewer "$username"
```

After each push, check whether branch has open merge request. Update title and description only when new commits materially change full scope. Report merge-request number, final title, and whether metadata changed.

## Handoff

Report exact Git commands run, files or hunks staged, resulting commit hashes, and leftover unstaged changes.

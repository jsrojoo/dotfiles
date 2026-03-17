---
name: workflow-git
description: Git workflow and commit practices.
---

## Delegation Model
- Route git work through a dedicated subagent instead of mixing staging and commit hygiene into the main implementation thread.
- Spawn one git-focused subagent when the task includes reviewing diffs, staging hunks, creating commits, amending the latest local commit, rebasing, or other git operations.
- Reuse that same subagent for the rest of the turn's git work so commit context and staging decisions stay in one place.
- Use a `default` or `worker` subagent with a narrow prompt that says it owns git status, diff review, patch grouping, staging, commit creation, and commit-message hygiene.
- Tell the subagent it is not alone in the codebase, it must not revert unrelated user changes, and it should stage only the minimal hunks needed for the requested commit.
- Keep implementation edits in the main session unless the user explicitly asks to delegate code changes too.

## Git Practices
- Create atomic commits that follow conventional commit prefixes like chore, feat, fix, or similar.
- Enforce atomic commits by splitting unrelated changes into separate commits or explicitly asking before grouping.
- Before doing any git operations, ensure that you use `--no-pager` flag.
- Have the dedicated git subagent inspect `git --no-pager status` and `git --no-pager diff` before choosing a staging plan.
- Prefer surgical commits
    - perform a `git diff` then identify related changes
    - generate grouped patches with `skills/workflow-git/group-patches.sh`
    - use line ranges to keep only the related hunks for each group
    - review the curated patch for correctness and scope
    - stage it non-interactively with `git apply --cached <patch>`
    - then commit them atomically.
- Example: grouped patch files with line ranges
    - create grouped patches with line ranges, then stage the group you want.
```bash
./skills/workflow-git/group-patches.sh -o /tmp/patches api=src/a.py:10-30,src/b.py:5-9
git apply --check /tmp/patches/api.patch
git apply --cached /tmp/patches/api.patch
```
- Curation checklist
    - keep only the file sections and hunks that match the intended change
    - remove any unrelated file headers and hunks
    - ensure each hunk has its leading `diff --git`, `index`, and `---/+++` headers intact
    - never edit the `@@ -a,b +c,d @@` hunk headers without understanding the line counts
- Tip: adjust a group quickly
    - use excludes to drop a bad range without regenerating the full diff.
```bash
./skills/workflow-git/group-patches.sh -o /tmp/patches api=src/a.py:10-30,!src/a.py:15-18
```
- Tip: validate ranges without writing patches
    - use `--dry-run` to see which hunks are kept or excluded.
```bash
./skills/workflow-git/group-patches.sh --dry-run api=src/a.py:10-30,!src/a.py:15-18
```
- Each commit message must include a subject and a concise body.
    - use a multi-line message with a blank line between subject and body.
    - keep the body to 1-2 short sentences describing what changed and why.
    - if `tmux send-keys` is explicitly requested, wrap each `-m` argument in single quotes or escape spaces so the message is not collapsed.
- Ask the git subagent to report the exact git commands it ran, the files or hunks it staged, and any leftover unstaged changes that still need user attention.
- Default to conventional, atomic commits without asking; only ask when the user explicitly requests a different approach.
- Prefer many small commits while iterating, then group related work using `fixup!`/`squash!` and `git rebase -i --autosquash` before sharing.
- Use `git commit --amend` only for the most recent local commit; otherwise use `fixup!` commits intended for autosquash.

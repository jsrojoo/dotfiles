---
name: workflow-git
description: Git workflow and commit practices.
---

## Delegation Model
- Route git work through dedicated subagent instead of mixing staging and commit hygiene into main implementation thread.
- Invoke registered `git_workflow` subagent when task includes reviewing diffs, staging hunks, creating commits, amending latest local commit, rebasing, or other git operations.
- Reuse same `git_workflow` subagent for rest of turn's git work so commit context and staging decisions stay in one place.
- Configure subagent through `agent-skills/agents/git-workflow.toml` and `agent-skills/agents/git-workflow.md`, similar to existing `context_retriever` setup.
- Keep subagent's model selection in `agent-skills/agents/git-workflow.toml` instead of hardcoding model overrides in parent prompt.
- Tell subagent it is not alone in codebase, it must not revert unrelated user changes, and it should stage only minimum hunks needed for requested commit.
- Keep implementation edits delegated to registered `workflow_code` subagent, and use this git subagent for staging, diff review, commit hygiene, and other git-only work.

## Git Practices
- Create atomic commits that follow conventional commit prefixes like `chore`, `feat`, `fix`, or similar.
- Enforce atomic commits by splitting unrelated changes into separate commits or explicitly asking before grouping.
- Before any git operations, ensure you use `--no-pager` flag.
- Have dedicated git subagent inspect `git --no-pager status` and `git --no-pager diff` before choosing staging plan.
- Treat `.env` files as staging hazards and generally do not commit them.
- Never commit secrets, credentials, tokens, or similar sensitive values, including any found in `.env` files.
- Prefer surgical commits
    - perform `git diff`, then identify related changes
    - generate grouped patches with `skills/workflow-git/group-patches.sh`
    - use line ranges to keep only related hunks for each group
    - review curated patch for correctness and scope
    - stage it non-interactively with `git apply --cached <patch>`
    - then commit atomically.
- Example: grouped patch files with line ranges
    - create grouped patches with line ranges, then stage group you want.
```bash
./skills/workflow-git/group-patches.sh -o /tmp/patches api=src/a.py:10-30,src/b.py:5-9
git apply --check /tmp/patches/api.patch
git apply --cached /tmp/patches/api.patch
```
- Curation checklist
    - keep only file sections and hunks that match intended change
    - remove unrelated file headers and hunks
    - ensure each hunk keeps its leading `diff --git`, `index`, and `---/+++` headers intact
    - never edit `@@ -a,b +c,d @@` hunk headers without understanding line counts
- Tip: adjust group quickly
    - use excludes to drop bad range without regenerating full diff.
```bash
./skills/workflow-git/group-patches.sh -o /tmp/patches api=src/a.py:10-30,!src/a.py:15-18
```
- Tip: validate ranges without writing patches
    - use `--dry-run` to see which hunks are kept or excluded.
```bash
./skills/workflow-git/group-patches.sh --dry-run api=src/a.py:10-30,!src/a.py:15-18
```
- Each commit message must include subject and concise body.
    - use multi-line message with blank line between subject and body.
    - keep body to 1-2 short sentences describing what changed and why.
    - write commit subject and body in normal clear prose, not caveman style, even when caveman is default elsewhere.
    - if `tmux send-keys` is explicitly requested, wrap each `-m` argument in single quotes or escape spaces so message is not collapsed.
- Ask git subagent to report exact git commands it ran, files or hunks it staged, and any leftover unstaged changes that still need user attention.
- Default to conventional, atomic commits without asking; ask only when user explicitly requests different approach.
- Prefer many small commits while iterating, then group related work using `fixup!`/`squash!` and `git rebase -i --autosquash` before sharing.
- Use `git commit --amend` only for most recent local commit; otherwise use `fixup!` commits intended for autosquash.

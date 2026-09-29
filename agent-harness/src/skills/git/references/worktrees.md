# Worktrees

Use a dedicated Git worktree for every non-trivial task and for every code
change. The **project root** is the repository top-level directory reported by
`git rev-parse --show-toplevel`, regardless of which checkout runs the command.
Place each worktree at:

```text
<project-root>/.agents/tasks/<task>/worktree/
```

For plan-mode tasks (`plan-mode-tasks`), keep the sibling artifacts
`.agents/tasks/<task>/plan.md` and `.agents/tasks/<task>/tasks.md` at the task root,
never inside the worktree:

```text
<project-root>/.agents/tasks/<task>/
├── plan.md
├── tasks.md
└── worktree/
```

## Setup

Before creating a worktree:

1. Inspect the source checkout with `git status --short --branch` and preserve
   unrelated changes.
2. Choose and state an explicit task branch and start point; do not rely on an
   implicit current branch or `HEAD`.
3. Confirm the task path is unused and obtain approval before any Git mutation.

After approval, create a new task branch and worktree from the stated start
point, for example:

```bash
git -C <project-root> worktree add \
  -b <task-branch> \
  <project-root>/.agents/tasks/<task>/worktree \
  <start-point>
```

If the task branch already exists, use the appropriate non-creating form only
after confirming that reusing it is intentional.

## Isolation and safety

- Make code changes and run project commands only in the dedicated worktree.
- Keep plan-mode `plan.md` and `tasks.md` at the sibling task root.
- Do not modify the primary checkout or another task's worktree.
- Treat branches and repository metadata as shared across worktrees; never
  reset, rebase, delete, or force-update shared state without explicit approval.
- Preserve unrelated changes, and inspect status before handoff or cleanup.

## Verification and handoff

Run the narrowest relevant checks in the task worktree, then broader checks when
warranted. Before handoff, inspect the worktree status, confirm the diff is
limited to the requested scope, and report the changed paths, checks and
results, skipped verification, remaining risks, and any user action required.
Do not move, merge, commit, or otherwise integrate the branch without approval.

## Cleanup

Use the bundled `src/skills/git/scripts/cleanup-worktrees.sh` helper (available
as `<skill-directory>/scripts/cleanup-worktrees.sh`). Always provide the base
branch explicitly and preview first:

```bash
<skill-directory>/scripts/cleanup-worktrees.sh --base <local-base-branch>
```

Review the `ELIGIBLE` entries. Only after explicit approval, rerun with removal
enabled:

```bash
<skill-directory>/scripts/cleanup-worktrees.sh \
  --base <local-base-branch> \
  --remove
```

The helper skips the primary and current worktrees and worktrees that are dirty,
locked, prunable, detached, missing, not on a local branch, or not merged into
the selected base. Removal deletes eligible worktree directories, not their
branches. Never bypass the preview and approval steps.

---
name: aitrium
description: Use when working on any Aitrium or EGPT repository under gitlab.gbsemea-scm-gitlab.aws.fisv.cloud/EMEA/GBS/EGPT, or local workspaces containing enterprise-gpt-api, enterprise-gpt-ui, enterprise-gpt-data-models, enterprise-gpt-admin-api, aitrium-document-conversion-api, or aitrium-document-search-api. Provides Aitrium context, repo map, shorthand policy, task isolation policy, planning defaults, and repo-specific rules.
---

# Aitrium

## Skill Boundaries

- This skill owns Aitrium context, repo identity, shorthand, safety policy, task isolation policy, planning defaults, and repo-specific rules.
- Use `aitrium-dev-workspace` for executable task workspace helpers, Git worktree bootstrap, tmux windows, cross-repo status, cross-repo diffs, and workspace command examples.
- Use `local-development` for local laptop services, Coder workspace access, port forwarding, Dockerized dependencies, and repo-local Node/Python environment templates.

## Core Context

- Aitrium work usually spans multiple repos from `https://gitlab.gbsemea-scm-gitlab.aws.fisv.cloud/EMEA/GBS/EGPT`.
- Treat `enterprise-gpt-*` repos as `egpt-*` in conversation only, e.g. `enterprise-gpt-api` as `egpt-api`.
- Use full repo names in generated artifacts, docs, code, commits, and task files unless user asks otherwise.
- Shared workspace roots may contain many task directories and shared root clones.
- Treat shared root clones as read-only references unless user explicitly asks to work there.

## Core Repos

| Short name | Repository | Source |
| --- | --- | --- |
| `egpt-api` | `enterprise-gpt-api` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/enterprise-gpt-api.git` |
| `egpt-ui` | `enterprise-gpt-ui` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/ui/enterprise-gpt-ui.git` |
| `egpt-data-models` | `enterprise-gpt-data-models` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/enterprise-gpt-data-models.git` |
| `egpt-admin-api` | `enterprise-gpt-admin-api` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/enterprise-gpt-admin-api.git` |
| `doc-conversion-api` | `aitrium-document-conversion-api` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/aitrium-document-conversion-api.git` |
| `doc-search-api` | `aitrium-document-search-api` | `https://gitlab.scm-emea.aws.fisv.cloud/EMEA/GBS/EGPT/applications/apis/aitrium-document-search-api.git` |

## Task Isolation Policy

- Start or continue work inside task-specific directories, not unrelated active task folders.
- Do not do feature work directly in shared root clones unless user explicitly asks.
- Use one task directory per task, named with enough context to identify later.
- For Jira-backed work, prefer `<jira-key>-<task-slug>-<yyyy-mm-dd>`, e.g. `gvte-4883-token-computation-2026-05-26`.
- Avoid vague ticket-only directory names like `gvte-4883-2026-05-26`.
- Prefer task-local worktrees or task-local repo copies under the active task directory.
- Do not reuse repos or worktrees from another active task directory.
- Do not mix branches for multiple tasks inside one cloned repo or worktree.
- Before editing a core repo, confirm repo path belongs to the active task directory.
- Keep one task's branches, env files, generated output, installs, and notes isolated from other tasks.
- Never stage, commit, branch, rebase, tag, clean, or delete unless user explicitly asks.
- Never clean or delete another task directory unless user explicitly asks.
- Treat unknown local changes as user-owned; work with them, do not revert them.

## Branch Policy

- When user asks to create a task branch, base it on `origin/HEAD` unless user gives another base.
- Use `origin/develop` only when `origin/HEAD` is missing, wrong, or user explicitly asks for `develop`.
- Branch names should use `<type>/<jira-key>-<task-slug>`, where `type` is `feat`, `fix`, or `chore`.
- For Jira-backed feature work, prefer `feat/<jira-key>-<task-slug>`, e.g. `feat/gvte-4883-token-computation`.
- If team wants long-form feature naming, `feature/<jira-key>-<task-slug>` is also accepted.

## Planning Defaults

- For multi-repo changes, state assumptions and affected repos before implementation.
- Prefer additive compatibility over broad renames when public routes, payload keys, DB names, or consumer contracts may exist.
- Use full repo names in plan artifacts and generated docs.
- Keep task artifacts inside the active task directory, usually `.agents/tasks/<task-name>/`.
- At handoff, report changed repos, changed files, tests run, and unverified areas.

## Data Model Migrations

- For `enterprise-gpt-data-models`, make schema changes model-first, then generate migrations with Alembic autogenerate.
- Do not hand-write Alembic revision files for normal schema diffs unless user explicitly asks or autogenerate cannot express the change.
- Preferred flow:

```bash
mise exec -- poetry install --with dev
mise exec -- poetry run alembic revision --autogenerate -m "short migration message"
```

- Inspect generated migration before keeping it; remove unrelated autogenerate noise.
- Keep migrations additive and nullable first when cross-repo deploy order matters.

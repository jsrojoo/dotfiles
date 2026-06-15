# Agent Skills

Shared instructions, skills, and subagent definitions for coding-agent workflows.

## What this repo is
- This repo packages a reusable agent operating model, not just prompt snippets.
- `AGENTS.md` is the main entrypoint for response style, approval flow, planning rules, and required skill routing.
- `skills/` contains the reusable skills that can be invoked by name.
- `agents/` contains the registered subagent definitions those skills depend on.

## Who this is for
- Use this repo if you want a coding agent setup with consistent investigation, implementation, testing, planning, and git hygiene.
- It is most useful when your runtime can load a top-level instruction file and discover reusable skills.
- It is even more useful when your runtime also supports registered subagents, because several workflows are intentionally delegated instead of handled in the main thread.

## Repo layout
```text
.
├── AGENTS.md                    # Global rules loaded first
├── README.md                    # Consumer-facing overview
├── agents/                      # Registered subagent prompts and configs
│   ├── *.md
│   └── *.toml
└── skills/                      # Reusable skills invoked by name
    ├── agent-context-retriever/
    ├── codebase-understanding/
    ├── plan-mode-tasks/
    ├── workflow-code/
    ├── workflow-execution/
    ├── workflow-git/
    └── workflow-testing/
```

## How it works
- Load `AGENTS.md` first so the global operating rules are always in effect.
- Make `skills/` discoverable so the agent can trigger the right skill when a task matches.
- Make `agents/` available if your runtime supports registered subagents.
- Mention a skill by name when you want a specific workflow, or rely on the skill metadata if your runtime auto-selects skills.

## Quick adoption guide
1. Copy or link `AGENTS.md` into the location your agent runtime uses for top-level instructions.
2. Copy or link `skills/` into the location your runtime uses for reusable skills.
3. If your runtime supports subagent registration, also copy or link `agents/`.
4. Start with a simple task and explicitly mention the workflow you want, such as `agent-context-retriever` or `workflow-code`.
5. Keep this repo updated so future runs pick up instruction and skill changes.

## Core operating model
- The repo is built around delegation.
- `AGENTS.md` requires the main agent to route certain work to the matching specialized subagent instead of doing everything directly.
- This keeps repo exploration, command execution, code editing, testing, planning artifacts, and git hygiene scoped to the right workflow.

### Typical flow
1. Use `agent-context-retriever` before broad repo inspection.
2. Use `workflow-code` for implementation changes and related documentation updates.
3. Use `workflow-testing` for focused verification.
4. Use `workflow-git` when the task includes staging or commits.
5. Use `plan-mode-tasks` after an approved plan needs `plan.md` and `tasks.md` artifacts.
6. Use `codebase-understanding` when the goal is explanation, diagrams, or a reusable understanding artifact.

## Shipped skills

### Workflow skills
- `agent-context-retriever` — gathers minimal, evidence-backed repo context before broad local inspection.
- `codebase-understanding` — explains how a feature or workflow is implemented and can generate reusable understanding artifacts.
- `plan-mode-tasks` — creates and updates approved plan artifacts such as `plan.md` and `tasks.md`.
- `workflow-code` — guides implementation, naming, TDD, documentation updates, and validation expectations.
- `workflow-execution` — defines shell discipline, environment handling, and tmux-oriented command execution rules.
- `workflow-git` — handles diff review, staging, commit grouping, and commit hygiene.
- `workflow-testing` — guides focused verification and concise test reporting.

## Subagents included
- `agents/context-retriever.*` — repo discovery support.
- `agents/codebase-understanding.*` — implementation walkthrough and artifact generation support.
- `agents/plan-mode-tasks.*` — plan artifact support.
- `agents/workflow-code.*` — implementation support.
- `agents/workflow-execution.*` — execution discipline support.
- `agents/workflow-testing.*` — testing support.
- `agents/git-workflow.*` — git-only workflow support.

## Conventions consumers should expect
- Responses are expected to be short, structured, and citation-backed.
- Complex tasks usually start with a multi-step plan and wait for approval before implementation.
- Code changes are expected to update relevant documentation in the same task.
- Plan Mode work uses task artifacts such as `./.agents/tasks/<task>/plan.md` and `tasks.md`.
- Code-understanding runs can generate reusable artifacts under `./.agents/artifacts/<topic-slug>/`.

## Tooling expectations
- `tmux` is used by the execution workflow for inspectable command runs.
- `git` is expected for repository inspection and commit workflows.
- `rg` is preferred for text search.
- `sg` (ast-grep) is available for structural search.

## Updating or extending this repo
- Add or update a skill in `skills/<skill-name>/SKILL.md`.
- Keep each skill focused on one workflow or capability.
- Update the matching subagent files in `agents/` when that skill depends on delegated behavior.
- Keep `README.md` and `AGENTS.md` aligned with any behavior, structure, or workflow changes.

## Current uncertainty
- This README stays runtime-agnostic on purpose.
- Exact discovery and registration steps differ by agent runtime, so adopt the copy or link pattern that matches your tool.
- If your runtime does not support registered subagents, the skills are still useful, but delegation-heavy workflows may need adaptation.

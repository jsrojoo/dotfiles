# Agent Skills

## Overview
- This subtree is a shared library of agent skills and workflow rules.
- `AGENTS.md` defines the top-level instructions that should be loaded first.
- Each skill lives under `skills/<skill-name>/SKILL.md` and is referenced by name in prompts.

## Structure
- `AGENTS.md` is the entrypoint for global rules.
- `skills/<skill-name>/SKILL.md` contains the instructions for that skill.
- `skills/<skill-name>/agents/` holds tool-specific prompt snippets when needed.

## Usage With your coding agent CLI
- Point it to this repo so it can load `AGENTS.md` and discover `skills/`.
- When you want a workflow, mention the skill by name in your prompt (example: `workflow-execution`).
- Keep this repo updated and it will pick up changes on the next run.

Example: ask install and link the instructions for you.

```text
Please link the instructions and skills: 

# codex
/path-to/agent-skills/AGENTS.md into /your-path/.codex/AGENTS.md
/path-to/agent-skills/skills into /your-path/.codex/skills

# claude
/path-to/agent-skills/AGENTS.md into /your-path/CLAUDE.md
/path-to/agent-skills/skills into /your-path/.claude/skills
```

## Dependencies
- `tmux` for command execution workflows.
- `git` for repo inspection and patch workflows.
- `rg` (ripgrep) for fast search.
- `sg` (ast-grep) for structural search and replace.

## Adding Or Updating Skills
- Create or edit `skills/<skill-name>/SKILL.md` with concise, actionable rules.
- Prefer small, focused skills that cover one workflow or domain.
- Keep wording consistent with `AGENTS.md` and other skills.

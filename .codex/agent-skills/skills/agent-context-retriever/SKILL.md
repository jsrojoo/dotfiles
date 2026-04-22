---
name: agent-context-retriever
description: Use `context_retriever` subagent to gather small, evidence-backed repo context before broad local inspection. Use when Codex needs to answer where feature lives, which files matter, how code path behaves, what dependencies or call sites matter, or what unknowns remain after first read.
---

# Agent Context Retriever

## Overview

Use this skill to route repo discovery through existing `context_retriever` subagent instead of spending main session on broad inspection.
Return compact handoff with exact file references, key behaviors, and explicit unknowns.

## Workflow

1. Decide if task really needs retrieval.
2. If task is trivial or needed context is already known, skip subagent.
3. Otherwise, invoke `context_retriever` subagent first.
4. Ask only for minimum context needed to unblock parent task.
5. Use returned evidence to continue in main session.

## Delegation Guidance

- Keep subagent request narrow.
- Prefer prompts like:
  - "Find files and symbols needed to understand auth login flow."
  - "Identify where retry behavior is implemented and summarize relevant call path."
  - "List smallest set of files needed to explain how configuration X is resolved."
- Ask for exact file paths and line ranges.
- Ask subagent to separate facts, inferences, and unknowns.
- Do not ask subagent to propose edits unless parent task explicitly needs that.

## Handoff Format

Ask for this structure unless parent task needs something else:

1. Direct answer
2. Relevant files
3. Key behaviors and dependencies
4. Unknowns, assumptions, or risks

Keep output short and evidence-backed so main session gets compressed context packet, not full exploration trace.


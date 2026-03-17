---
name: agent-context-retriever
description: Invoke the `context_retriever` subagent to gather minimal, evidence-backed repository context before broad local inspection. Use when Codex needs to answer questions like where a feature is implemented, which files matter for a subsystem, how a code path behaves, what dependencies or call sites are relevant, or what unknowns remain after an initial read.
---

# Agent Context Retriever

## Overview

Use this skill to route repository discovery work through the existing `context_retriever` subagent instead of spending the main session on broad inspection.
Return a compact handoff with exact file references, key behaviors, and explicit unknowns.

## Workflow

1. Decide whether the task actually needs retrieval.
2. If the task is trivial or the needed context is already known, skip the subagent.
3. Otherwise, invoke the `context_retriever` subagent first.
4. Ask only for the minimum context needed to unblock the parent task.
5. Use the returned evidence to continue in the main session.

## Delegation Guidance

- Keep the subagent request narrowly scoped to the actual question.
- Prefer prompts like:
  - "Find the files and symbols needed to understand the auth login flow."
  - "Identify where retry behavior is implemented and summarize the relevant call path."
  - "List the smallest set of files needed to explain how configuration X is resolved."
- Ask for exact file paths and line ranges.
- Ask the subagent to distinguish facts, inferences, and unknowns.
- Do not ask the subagent to propose edits unless the parent task explicitly needs that.

## Handoff Format

Ask for this structure unless the parent task needs something else:

1. Direct answer
2. Relevant files
3. Key behaviors and dependencies
4. Unknowns, assumptions, or risks

Keep the output short and evidence-backed so the main session receives a compressed context packet instead of a full exploration trace.

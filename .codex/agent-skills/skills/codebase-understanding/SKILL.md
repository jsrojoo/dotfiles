---
name: codebase-understanding
description: Explain how a feature, workflow, subsystem, or concept is implemented in this codebase. Use it when the user wants an evidence-backed implementation walkthrough, key files, request or data flow, Mermaid diagrams, C4-style visuals, sample inputs and outputs, or a reusable artifact generated after the understanding run completes.
---

# Codebase Understanding

## Delegation Model
- Route implementation-understanding work through the registered `codebase_understanding` subagent instead of doing broad discovery in the parent thread.
- Invoke `codebase_understanding` when the user asks how something is implemented, where a behavior lives, how data moves through the system, or to turn that analysis into a reusable artifact.
- Reuse the same `codebase_understanding` subagent for the rest of the turn so the evidence, diagrams, and terminology stay consistent.
- Configure the subagent through `agent-skills/agents/codebase-understanding.toml` and `agent-skills/agents/codebase-understanding.md`.
- Keep the subagent self-contained; if narrow discovery, command-backed validation, or runtime verification would help, have it report that need back to the parent agent so the parent can decide whether to delegate.

## When To Use
- Use this skill for prompts like:
  - "How is auth session renewal implemented?"
  - "Trace the order pricing flow from API request to persistence."
  - "Explain where retry behavior is implemented and what triggers it."
  - "Create an implementation artifact for the cache invalidation pipeline."
- Skip this skill when the task is pure code editing, git hygiene, or a trivial factual answer that is already known from the current context.

## Investigation Workflow
1. Define the topic boundary and the output goal.
2. Start with the smallest likely entrypoints, files, or symbols.
3. Read only the minimum slices needed to explain the control flow, data flow, and key decisions.
4. Separate facts from inferences and call out any unknowns.
5. Build a concise explanation with file citations, Mermaid diagrams, and a C4-style visual.
6. Generate `.agents/artifacts/<topic-slug>.md` only after the understanding run is complete and the topic name is clear.

## Output Requirements
- Keep the explanation easy to scan and evidence-backed.
- Include these sections unless the parent task requests a different format:
  1. Direct answer
  2. Relevant files
  3. Implementation flow
  4. Diagrams
  5. Risks or unknowns
  6. Artifact path when generated
- Use Mermaid for at least one flow diagram when the system behavior spans multiple components.
- Use a C4-style visual when showing actors, containers, or major boundaries helps explain the implementation.
- Prefer short bullets, direct wording, and exact file paths with line ranges when available.

## Artifact Generation Rule
- Only create `.agents/artifacts/<topic-slug>.md` after the code-understanding analysis is complete.
- Use one topic-specific markdown file per analyzed implementation area instead of fixed buckets like feature or business-logic.
- Choose a filename that matches the implementation topic, such as `.agents/artifacts/auth-session-renewal.md` or `.agents/artifacts/order-pricing-pipeline.md`.
- Use `references/code-understanding-artifact-template.md` as the output template reference when generating the artifact.

## Reference Files
- Read `references/code-understanding-artifact-template.md` when the task asks for a reusable artifact or when you need the standard section order for a deep implementation walkthrough.

## Sample Inputs
- "How is webhook signature verification implemented in this repo?"
- "Explain the sync job pipeline with a diagram I can skim quickly."
- "Trace the configuration resolution path for feature flags and create an artifact I can revisit later."
- "Show me how the billing retry logic works, including the main files and extension points."

## Sample Output Shape
- `Direct answer`: one short paragraph that states how the implementation works.
- `Relevant files`: a compact list of the most important files and why they matter.
- `Implementation flow`: the main request, data, and decision path in order.
- `Diagrams`: one Mermaid flow or sequence diagram plus one C4-style view when helpful.
- `Risks or unknowns`: edge cases, inferred behavior, and unanswered questions.
- `Artifact path`: present only after `.agents/artifacts/<topic-slug>.md` has actually been generated.

---
name: codebase-understanding
description: Explain how a feature, workflow, subsystem, or concept is implemented in this codebase. Use it when the user wants an evidence-backed implementation walkthrough, key files, request or data flow, D2 visuals, EventStorming-style analysis, sample inputs and outputs, or a reusable artifact generated after the understanding run completes.
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
5. Choose the visual mode that best fits the topic without asking the user to pick unless they explicitly request a specific framing:
   - Default to D2 for reusable artifacts and any explanation that benefits from rendered visuals in markdown.
   - Use an EventStorming lens when commands, domain events, actors, policies, read models, aggregates, or bounded contexts explain the system better than a raw control-flow view.
   - Use Mermaid only for inline chat explanations when no artifact is requested and fast text-only visuals are sufficient.
6. Build a concise explanation with file citations, diagrams, and a boundary-oriented visual when helpful.
7. Generate `.agents/artifacts/<topic-slug>/<topic-slug>.md` only after the understanding run is complete and the topic name is clear.

## Output Requirements
- Keep the explanation easy to scan and evidence-backed.
- Include these sections unless the parent task requests a different format:
  1. Direct answer
  2. Relevant files
  3. Implementation flow
  4. Diagrams
  5. Risks or unknowns
  6. Artifact path when generated
- For reusable artifacts, prefer D2 source plus rendered SVG referenced from markdown.
- Use a boundary-oriented visual when actors, containers, aggregates, or major subsystem edges help explain the implementation.
- In EventStorming mode, identify the main actors, commands, domain events, policies, read models, aggregates, and bounded contexts before drawing the diagram.
- Prefer short bullets, direct wording, and exact file paths with line ranges when available.

## D2 Artifact Flow
- Keep each artifact self-contained in `.agents/artifacts/<topic-slug>/`.
- Store the markdown artifact at `.agents/artifacts/<topic-slug>/<topic-slug>.md`.
- Store diagram sources and renders beside it, such as:
  - `.agents/artifacts/<topic-slug>/flow.d2`
  - `.agents/artifacts/<topic-slug>/flow.svg`
  - `.agents/artifacts/<topic-slug>/flow.png` when a PNG is specifically needed
- Render D2 to SVG first and reference the SVG from markdown with a relative image path.
- Generate PNG only when a downstream tool or preview path specifically requires it.
- If the `d2` CLI is unavailable, keep the D2 source and call out that rendering remains pending instead of pretending the image exists.

## EventStorming Mode
- Use EventStorming mode when the user is asking about a domain workflow, lifecycle, business process, or event-driven behavior.
- Start by naming the actor or trigger, then map commands, domain events, policies, read models, and aggregates in execution order.
- Distinguish facts from inferences, especially when inferring business events from controller or persistence code.
- Keep the scope bounded; do not force EventStorming onto low-level utility flows where a simple control-flow diagram is clearer.
- Default to whichever explanation mode makes the implementation easiest to understand; do not ask the user to choose between standard flow and EventStorming unless they have explicitly requested that choice.

## Artifact Generation Rule
- Only create `.agents/artifacts/<topic-slug>/<topic-slug>.md` after the code-understanding analysis is complete.
- Use one topic-specific directory per analyzed implementation area instead of fixed buckets like feature or business-logic.
- Choose a directory name that matches the implementation topic, such as `.agents/artifacts/auth-session-renewal/` or `.agents/artifacts/order-pricing-pipeline/`.
- Name the markdown artifact `<topic-slug>.md` inside that directory.
- Use `references/code-understanding-artifact-template.md` as the output template reference when generating the artifact.

## Reference Files
- Read `references/code-understanding-artifact-template.md` when the task asks for a reusable artifact or when you need the standard section order for a deep implementation walkthrough.

## Sample Inputs
- "How is webhook signature verification implemented in this repo?"
- "Explain the sync job pipeline with a diagram I can skim quickly."
- "Trace the configuration resolution path for feature flags and create an artifact I can revisit later."
- "Show me how the billing retry logic works, including the main files and extension points."
- "Map the order lifecycle in EventStorming terms and generate a reusable artifact with diagrams."

## Sample Output Shape
- `Direct answer`: one short paragraph that states how the implementation works.
- `Relevant files`: a compact list of the most important files and why they matter.
- `Implementation flow`: the main request, data, and decision path in order.
- `Diagrams`: D2-backed rendered visuals for artifacts, or Mermaid inline when the task is chat-only and lightweight.
- `Risks or unknowns`: edge cases, inferred behavior, and unanswered questions.
- `Artifact path`: present only after `.agents/artifacts/<topic-slug>/<topic-slug>.md` has actually been generated.

---
name: codebase-understanding
description: Explain how a feature, workflow, subsystem, or concept is implemented in this codebase. Use when user wants evidence-backed implementation walkthrough, key files, request or data flow, D2 visuals, EventStorming-style analysis, sample inputs and outputs, or reusable artifact after understanding run completes.
---

# Codebase Understanding

## Delegation Model
- Route implementation-understanding work through registered `codebase_understanding` subagent instead of broad discovery in parent thread.
- Invoke `codebase_understanding` when user asks how something is implemented, where behavior lives, how data moves through system, or to turn analysis into reusable artifact.
- Reuse same `codebase_understanding` subagent for rest of turn so evidence, diagrams, and terms stay consistent.
- Configure subagent through `agent-skills/agents/codebase-understanding.toml` and `agent-skills/agents/codebase-understanding.md`.
- Keep subagent self-contained; if narrow discovery, command-backed validation, or runtime verification would help, have it report that need back to parent agent so parent can decide whether to delegate.

## When To Use
- Use this skill for prompts like:
  - "How is auth session renewal implemented?"
  - "Trace the order pricing flow from API request to persistence."
  - "Explain where retry behavior is implemented and what triggers it."
  - "Create an implementation artifact for the cache invalidation pipeline."
- Skip this skill when task is pure code editing, git hygiene, or trivial factual answer already known from current context.

## Investigation Workflow
1. Define topic boundary and output goal.
2. Start with smallest likely entrypoints, files, or symbols.
3. Read only minimum slices needed to explain control flow, data flow, and key decisions.
4. Separate facts from inferences and call out unknowns.
5. Choose visual mode that best fits topic without asking user to pick unless they explicitly request specific framing:
   - Default to D2 for reusable artifacts and explanations that benefit from rendered visuals in markdown.
   - Default flowcharts and diagrams to top-down orientation: D2 `direction: down`; Mermaid `flowchart TD` or `graph TD`.
   - Use another orientation only when user explicitly requests it.
   - Use EventStorming lens when commands, domain events, actors, policies, read models, aggregates, or bounded contexts explain system better than raw control-flow view.
   - Use Mermaid only for inline chat explanations when no artifact is requested and fast text-only visuals are enough.
6. Build concise explanation with file citations, diagrams, and boundary-oriented visual when helpful.
7. Generate `.agents/artifacts/<topic-slug>/<topic-slug>.md` only after understanding run is complete and topic name is clear.

## Output Requirements
- Keep explanation easy to scan and evidence-backed.
- Include these sections unless parent task requests different format:
  1. Direct answer
  2. Relevant files
  3. Implementation flow
  4. Diagrams
  5. Risks or unknowns
  6. Artifact path when generated
- For reusable artifacts, prefer D2 source plus rendered SVG referenced from markdown.
- Use boundary-oriented visual when actors, containers, aggregates, or major subsystem edges help explain implementation.
- In EventStorming mode, identify main actors, commands, domain events, policies, read models, aggregates, and bounded contexts before drawing diagram.
- Prefer short bullets, direct wording, and exact file paths with line ranges when available.

## D2 Artifact Flow
- Keep each artifact self-contained in `.agents/artifacts/<topic-slug>/`.
- Start D2 flowcharts and diagrams with `direction: down` unless user explicitly requests another orientation.
- Store markdown artifact at `.agents/artifacts/<topic-slug>/<topic-slug>.md`.
- Store diagram sources and renders beside it, such as:
  - `.agents/artifacts/<topic-slug>/flow.d2`
  - `.agents/artifacts/<topic-slug>/flow.svg`
  - `.agents/artifacts/<topic-slug>/flow.png` when PNG is specifically needed
- Render D2 to SVG first and reference SVG from markdown with relative image path.
- Generate PNG only when downstream tool or preview path specifically requires it.
- If `d2` CLI is unavailable, keep D2 source and call out that rendering remains pending instead of pretending image exists.

## EventStorming Mode
- Use EventStorming mode when user asks about domain workflow, lifecycle, business process, or event-driven behavior.
- Start by naming actor or trigger, then map commands, domain events, policies, read models, and aggregates in execution order.
- Distinguish facts from inferences, especially when inferring business events from controller or persistence code.
- Keep scope bounded; do not force EventStorming onto low-level utility flows where simple control-flow diagram is clearer.
- Default to explanation mode that makes implementation easiest to understand; do not ask user to choose between standard flow and EventStorming unless they explicitly request that choice.

## Artifact Generation Rule
- Only create `.agents/artifacts/<topic-slug>/<topic-slug>.md` after code-understanding analysis is complete.
- Use one topic-specific directory per analyzed implementation area instead of fixed buckets like feature or business-logic.
- Choose directory name that matches implementation topic, such as `.agents/artifacts/auth-session-renewal/` or `.agents/artifacts/order-pricing-pipeline/`.
- Name markdown artifact `<topic-slug>.md` inside that directory.
- Use `references/code-understanding-artifact-template.md` as output template reference when generating artifact.

## Reference Files
- Read `references/code-understanding-artifact-template.md` when task asks for reusable artifact or when you need standard section order for deep implementation walkthrough.

## Sample Inputs
- "How is webhook signature verification implemented in this repo?"
- "Explain the sync job pipeline with a diagram I can skim quickly."
- "Trace the configuration resolution path for feature flags and create an artifact I can revisit later."
- "Show me how the billing retry logic works, including the main files and extension points."
- "Map the order lifecycle in EventStorming terms and generate a reusable artifact with diagrams."

## Sample Output Shape
- `Direct answer`: one short paragraph that states how implementation works.
- `Relevant files`: compact list of most important files and why they matter.
- `Implementation flow`: main request, data, and decision path in order.
- `Diagrams`: D2-backed rendered visuals for artifacts, or Mermaid inline when task is chat-only and lightweight.
- `Risks or unknowns`: edge cases, inferred behavior, and unanswered questions.
- `Artifact path`: present only after `.agents/artifacts/<topic-slug>/<topic-slug>.md` has actually been generated.

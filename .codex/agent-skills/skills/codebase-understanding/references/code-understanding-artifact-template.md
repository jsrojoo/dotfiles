# <Topic Title>

## Why This Exists
- Summarize why this implementation matters and when an engineer would read this artifact.
- State the scope boundary so adjacent systems are not confused as part of the same flow.

## Artifact Layout
- Artifact directory: `.agents/artifacts/<topic-slug>/`
- Markdown artifact: `.agents/artifacts/<topic-slug>/<topic-slug>.md`
- D2 source files: `.agents/artifacts/<topic-slug>/*.d2`
- Rendered visuals: `.agents/artifacts/<topic-slug>/*.svg`
- Optional PNG exports: `.agents/artifacts/<topic-slug>/*.png`

## Executive Summary
- Explain the implementation in 3-5 bullets.
- Separate confirmed behavior from inferred behavior.

## Primary Entry Points
- List the user-facing, API, CLI, scheduler, or event entrypoints.
- Cite the exact repo files that initiate the flow.

## Key Files And Responsibilities
- For each file, explain its role in one sentence.
- Prefer the smallest set of files that makes the design understandable.

## End-To-End Flow
1. Describe the trigger.
2. Describe the first hop.
3. Describe the major control-flow branches.
4. Describe how state or data changes.
5. Describe where the flow ends or returns.

## Visuals
- Prefer D2 for all reusable artifact visuals.
- Render to SVG first and embed the SVG with markdown image syntax.
- Add PNG only when a downstream viewer specifically needs it.
- If `d2` is unavailable, keep the `.d2` file path here and state that rendering is still pending.

### Flow Diagram
![Flow diagram](./flow.svg)
- Source: `./flow.d2`
- Show the main trigger, major components, and the most important state transition or dependency edges.

### Sequence Or Timeline Diagram
![Sequence or timeline diagram](./sequence.svg)
- Source: `./sequence.d2`
- Use this when call order, async steps, or retries matter more than static structure.

### Boundary View
![Boundary view](./boundaries.svg)
- Source: `./boundaries.d2`
- Focus on actors, containers, aggregates, or subsystem boundaries rather than every function call.

### EventStorming View
![EventStorming view](./eventstorm.svg)
- Source: `./eventstorm.d2`
- Include only when commands, domain events, policies, read models, aggregates, or bounded contexts clarify the implementation.
- Label inferred events or policies clearly when the code does not name them directly.

## State, Rules, And Constraints
- Capture business rules, guard clauses, retries, caching, idempotency, and ordering constraints.
- Mark anything that is inferred instead of directly evidenced.

## Extension Points
- List the interfaces, hooks, config, or branch points an engineer would modify.
- Call out high-risk files where changes would have broad impact.

## Risks And Unknowns
- List any unclear behavior, unverified runtime assumptions, or missing tests.
- Be explicit when more investigation is needed.

## Sample Questions For Future Exploration
- "What breaks if this dependency fails?"
- "Where should a new variant plug into this flow?"
- "Which tests give the best coverage for this implementation?"

## Artifact Metadata
- Suggested artifact path: `.agents/artifacts/<topic-slug>/<topic-slug>.md`
- Use one topic-specific directory per implementation area.
- Keep citations inline with the explanation using repo file paths and line ranges.

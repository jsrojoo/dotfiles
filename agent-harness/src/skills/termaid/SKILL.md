---
name: termaid
description: Render compact Mermaid diagrams as ASCII. Use when visualizing a plan, workflow, architecture, state transition, or change with Before, After, and What changed views.
---

# Termaid

Render standard Mermaid syntax with `termaid`. Diagrams explain confirmed behavior and planned changes; they do not replace the numbered plan or invent architecture.

## Visualize a plan

Render three separate diagrams in this order:

1. `Before`: current flow, state, or boundaries relevant to the plan.
2. `After`: expected flow, state, or boundaries after implementation.
3. `What changed`: only added, removed, or modified pieces and their dependencies.

Keep each diagram compact and readable at a glance. Show only detail needed to understand the plan.

## Render

Pass Mermaid source through stdin without installing packages or accessing the network:

```bash
uvx --offline termaid --ascii <<'MERMAID'
flowchart TD
    Input --> Change
    Change --> Result
MERMAID
```

Inspect every render. If syntax fails or output is unclear, simplify the Mermaid source and render again.

Present each renderer output under its matching heading in a fenced `text` block. Preserve output exactly; do not redraw or reformat it. If offline rendering is unavailable, report the blocker instead of fabricating output.

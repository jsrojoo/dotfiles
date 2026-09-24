---
name: minimal-code-gen
description: Generate code in small, strictly bounded units (roughly 50 tokens per function or script) instead of large multi-function dumps. Use when the user wants tiny, modular, easily reviewable code, or explicitly asks for a minimal/lazy/small implementation.
---

# Minimal code generation

Generate the smallest working unit of code per call, not a full feature in one shot.

## Budget

- One function, one small script, or one edit: about 50 tokens (~35-40 words, ~200 characters) per `write`/`edit` tool call.
- This is enforced mechanically by `code-size-guardrail.ts` (hooks `tool_call` on edit/write) whenever `PI_CODE_TOKEN_BUDGET` is set. An over-budget call is blocked with a reason; split it smaller and retry. Do not ask for the budget to be lifted.

## How to apply the budget

The budget is a per-call override on the `subagent` tool, not a separate agent. Any code-writing agent (`workflow_code`, or others) can be called with it:

```text
Use subagent with agent: workflow_code, maxOutputTokens: 50, task: write a Python function that validates an email format.
```

`maxOutputTokens` is available on single-mode calls, and per-item on `tasks` (parallel) and `chain` entries, so a chain can tighten the budget on only the steps that write code.

Skip the override for large, tightly coupled changes that cannot be meaningfully split (e.g. a single complex algorithm that only makes sense as one block); call the agent normally and say why a minimal-unit split does not apply.

## Writing under budget yourself

If not delegating, still write in the smallest unit that stands alone:

- No boilerplate: skip comments, docstrings, and scaffolding unless requested.
- No speculative abstractions.
- Prefer stdlib and existing project helpers over new code (see the `ponytail` skill for the full ladder).
- If a task needs multiple units, do multiple small `write`/`edit` calls, each under budget, rather than one large call.


# Pi Agent — Supplemental Instructions

Pi-specific rules that extend the cross-harness `AGENTS.md` loaded from parent directories.

## Response Format

- Never use emojis or non-standard Unicode characters (no symbols, decorative glyphs, arrows as Unicode, etc.) in any response. Plain ASCII text only.

## Background Tasks

- Use `triggerOnCompletion: true` only for tasks that block the next step or whose output must be acted on immediately.
- Use `triggerOnCompletion: false` for regression checks, secondary validations, and parallel verification runs.
- When `triggerOnCompletion: false`, retrieve results with `bg_logs` only when explicitly asked or when the output is needed for a follow-up step.

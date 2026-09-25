---
name: tdd
description: Enforce test-driven development for code changes. Use when implementing, fixing, or refactoring testable behavior.
---

# Test-driven development

Require every implementation change to include a relevant test change and end with a passing test.

1. Define observable success criteria.
2. Add or update the smallest relevant test and implementation in either order or in parallel.
3. Run the focused test after both changes and confirm it passes.
4. Refactor only while tests stay green.

A failing test before implementation is useful evidence, not a sequencing requirement. Source-only changes do not satisfy this workflow.

If TDD is impractical, state why and use the closest focused verification.

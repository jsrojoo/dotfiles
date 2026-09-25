---
name: tdd
description: Enforce test-driven development for code changes. Use when implementing, fixing, or refactoring testable behavior.
---

# Test-driven development

Require a failing test before changing implementation code.

1. Add or update the smallest relevant test.
2. Run it and confirm it fails for the expected reason.
3. Make the smallest implementation change.
4. Run the test and confirm it passes.
5. Refactor only while tests stay green.

If an implementation edit is blocked, continue: add/update test, confirm red, implement, confirm green. Ask the user only if the implementation edit remains blocked after a recognized test fails.

If TDD is impractical, state why and use the closest focused verification.

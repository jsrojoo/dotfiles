# Database SQL Workflow

For SQL work, use task-workspace artifacts:

- `.local.artifacts/<task>/sql/query.sql`: exact SQL prepared for execution.
- `.local.artifacts/<task>/sql/query.result`: execution output piped here for agent inspection.

## Safety And Validation

- Never execute destructive or mutative SQL, including DDL and data writes. Agents may prepare it; user must execute it manually and capture result.
- For agent-permitted read-only SQL, execute exact `query.sql`, pipe output to `query.result`, then inspect that file. For mutative or destructive SQL, user performs execution and piping manually.
- Before any statement targeting data, prove its predicate with simple read-only `SELECT ... WHERE ...` query that returns intended rows; capture proof in `query.result`.
- Never assume SQL is valid. Validate and test it before treating it as usable.
- Generated-SQL assertions and unit tests are necessary checks, not proof target warehouse accepts SQL.

## Live SQL Checks

- When authorized, run minimal read-only `SELECT ... WHERE ...` probes through same production driver, dialect, and bind layer before production queries.
- Validate new functions, casts, JSON or VARIANT expressions, and bind types with separate focused probes.
- Keep probes small and non-sensitive; capture concise proof without credentials or PII.
- Validate execution mode separately: successful `SELECT` does not prove `executemany`, bulk, or batch writes work.
- For non-read-only behavior, use proven repository pattern or isolated temporary-table integration only with explicit authorization; agent still must not execute mutative SQL.
- When live validation is unavailable, label compatibility unverified; do not claim production safety.

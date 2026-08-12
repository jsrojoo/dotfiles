# SQL Execution Validation

- Treat generated-SQL assertions and unit tests as necessary checks, not proof that SQL is valid in the target warehouse.
- For dialect- or driver-specific SQL, when authorized, run minimal read-only `SELECT ... WHERE ...` probes through the same production driver, dialect, and bind layer before production queries.
- Validate novel functions, casts, JSON or VARIANT expressions, and bind types with separate focused probes.
- Keep probes small and non-sensitive; capture concise proof without credentials or PII.
- Validate execution mode separately: a successful `SELECT` does not prove `executemany`, bulk, or batch writes work.
- For non-read-only behavior, use a proven repository pattern or an isolated temporary-table integration only with explicit authorization.
- When live validation is unavailable, label warehouse compatibility unverified and do not claim production safety.

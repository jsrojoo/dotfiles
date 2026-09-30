# Context guidance

- When the `context` coordinator is available, delegate repository read and investigation work through one main invocation.
- The coordinator may fan out internally to 2-4 read-only `context-retriever` leaves; do not invoke those leaves directly.
- Give each context invocation a concise `purpose`.
- Return only relevant context; omit exploratory and internal investigation details.
- Keep context agents read-only. Use verified read-only queries for external services; otherwise do not access them.
- If the coordinator is unavailable, use the available direct read/search tools and disclose the fallback.

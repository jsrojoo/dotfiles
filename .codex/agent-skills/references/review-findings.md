# Review Finding Format

Use this format for `/review` findings.

Findings must be detailed enough to fix without follow-up.

Lead with findings, ordered by severity.

Include only findings backed by code evidence.

Move weak or uncertain concerns to `Questions`, not `Findings`.

If a finding cannot include a concrete example or failure mode, downgrade it to an open question unless it is a clear standards, security, or correctness violation.

Format each finding as a readable block, not one dense paragraph and not an over-compressed checklist.

Use short section labels with enough prose to explain the issue without forcing the reader to reconstruct it.

Every finding must use this shape:

```md
### [Severity] - [Short Problem]

**Location:** `path/to/file:line`

**Problem:** Explain the concrete bug or risk in 1-2 sentences.

**Why it matters:** Explain the user-visible failure, security risk, data loss, regression, or maintenance cost.

**Evidence:** Name the exact code behavior that proves the issue.

**Exhibit:** Include a tiny code snippet, text block, table, or ASCII flow that makes the failure easy to see.

**Proof:** Include concrete input/output data, a tiny failing assertion, or a before/after row that proves the behavior.

**Suggested fix:** Include a small code/text sketch that shows the intended change shape, not a full patch unless small.

**Test gap:** Name the test or scenario that should fail before fix and pass after.
```

Keep sections short, but use complete sentences where needed for readability.

Prefer one blank line between sections when a finding has more than four fields.

Use `Exhibit` for small grounded examples that clearly show the problem shape.

Good exhibits include 3-8 lines of code, a before/after text block, a tiny table, or a short ASCII flow.

Do not paste large files, full functions, or noisy logs; trim to the smallest snippet that proves the issue.

Use `Proof` for concrete failing data, not only prose.

Good proof includes `input -> process -> bad output`, a tiny expected-vs-actual table, or a failing assertion.

Use `Suggested fix` for a small implementation sketch when words alone are ambiguous.

Good suggested fixes include 3-8 lines of pseudocode, SQL shape, or before/after condition.

Bad finding: `Auth handling may be incorrect.`

Good finding:

````md
### High - Expired Token Accepted

**Location:** `src/auth/session.ts:42`

**Problem:** Expired tokens are accepted at the exact expiry boundary because the comparison excludes equality.

**Why it matters:** A token can remain valid for one extra authenticated request when `expiresAt` equals current time.

**Evidence:** The expiry check uses `expiresAt < now` instead of `expiresAt <= now`.

**Exhibit:**
```ts
if (session.expiresAt < now) {
  return reject();
}
return accept();
```

**Proof:**
```ts
const now = Date.now();
validateSession({ expiresAt: now }, now); // actual: accepted, expected: rejected
```

**Suggested fix:**
```ts
if (session.expiresAt <= now) {
  return reject();
}
return accept();
```

**Test gap:** Add a boundary test where `expiresAt` equals current time and expect rejection.
````

Good data-pipeline finding:

````md
### Medium - GHCP Snapshot Fallback Misses Codex-Only Dates

**Location:** `src/ai_usage_metrics/sources/aitrium/view/associate_ai_usage_daily_units.sql:42`

**Problem:** The carried-forward GHCP inventory row is built only from `ghcp_associates`, so Codex/Claude-only dates can miss a GHCP units row.

**Why it matters:** A final daily row can show GHCP seat cost while `gh_copilot_is_user=false`, which is inconsistent user-visible reporting.

**Evidence:** Spend fallback uses `ASSOCIATE_AI_USAGE_DAILY_ASSOCIATES_VW`, while units fallback uses `ghcp_associates`.

**Exhibit:**
```text
Monday: GHCP snapshot says is_user=true, seat_cost=10
Tuesday: Codex event exists, no GHCP event

Spend fallback sees Tuesday associate -> seat_cost=10
Units fallback misses Tuesday associate -> gh_copilot_is_user=false
```

**Proof:**
```text
Input rows:
2026-07-27 GHCP snapshot: is_user=true, seat_cost=10
2026-07-28 Codex usage: tokens=1200

Actual final row:
2026-07-28 seat_cost=10, gh_copilot_is_user=false
```

**Suggested fix:**
```sql
from ASSOCIATE_AI_USAGE_DAILY_ASSOCIATES_VW associates
left join ghcp_inventory_snapshot snapshot
  on snapshot.associate_id = associates.associate_id
 and snapshot.snapshot_date <= associates.activity_date
```

**Test gap:** Add a contract test for a non-GHCP activity date using an older same-week GHCP snapshot.
````

import assert from "node:assert/strict";
import test from "node:test";

import { mutativeSqlExecutionEvaluate } from "#agent-harness/core/guardrails/sql/block-mutative-sql";

test("blocks executed SQL mutations but not reads or inspected text", () => {
	assert.equal(
		mutativeSqlExecutionEvaluate('psql -c "UPDATE users SET active = true"').block,
		true,
	);
	assert.equal(mutativeSqlExecutionEvaluate('psql -c "SELECT * FROM users"').block, false);
	assert.equal(mutativeSqlExecutionEvaluate("rg 'UPDATE users' .").block, false);
});

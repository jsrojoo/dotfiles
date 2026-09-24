import assert from "node:assert/strict";
import test from "node:test";

import {
	sqlCommandExecutes,
	sqlCommandMutates,
	sqlTextNeedsProof,
} from "#agent-harness/core/guardrails/sql-guardrail/classify-sql";

test("recognizes database execution without treating inspection commands as execution", () => {
	assert.equal(sqlCommandExecutes('psql -c "SELECT 1"'), true);
	assert.equal(sqlCommandExecutes('python3 -c "cursor.execute(sql)"'), true);
	assert.equal(sqlCommandExecutes("rg 'UPDATE users' ."), false);
});

test("recognizes mutative SQL and ignores ordinary update prose", () => {
	assert.equal(sqlCommandMutates("UPDATE app.users SET active = true"), true);
	assert.equal(sqlCommandMutates("DROP TABLE app.users"), true);
	assert.equal(sqlCommandMutates("Update Azure and Bedrock tests"), false);
});

test("requires proof for SQL statements but not ordinary prose", () => {
	assert.equal(sqlTextNeedsProof("```sql\nSELECT * FROM app.users WHERE id = 1\n```"), true);
	assert.equal(sqlTextNeedsProof("UPDATE app.users AS u SET active = true"), true);
	assert.equal(
		sqlTextNeedsProof("Select exact provider pricing during materialization."),
		false,
	);
});

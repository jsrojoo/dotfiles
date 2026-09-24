import assert from "node:assert/strict";
import test from "node:test";

import {
	sqlValidationCompletionEvaluate,
	sqlValidationProofRecord,
	sqlValidationStateCreate,
} from "#agent-harness/core/guardrails/sql-guardrail/require-validation-proof";

test("records proof only from a successful SELECT WHERE execution with output", () => {
	const initial = sqlValidationStateCreate();
	const proven = sqlValidationProofRecord(
		initial,
		'psql -c "SELECT id FROM users WHERE id = 1"',
		"1",
		false,
	);
	const failed = sqlValidationProofRecord(
		initial,
		'psql -c "SELECT id FROM users WHERE id = 1"',
		"error",
		true,
	);

	assert.equal(proven.proofRecorded, true);
	assert.equal(failed.proofRecorded, false);
});

test("requests one correction when SQL lacks validation proof", () => {
	const initial = sqlValidationStateCreate();
	const first = sqlValidationCompletionEvaluate(
		initial,
		"```sql\nUPDATE users SET active = true WHERE id = 1\n```",
	);
	const second = sqlValidationCompletionEvaluate(first.state, "UPDATE users SET active = true WHERE id = 1");

	assert.equal(first.correct, true);
	assert.equal(second.correct, false);
});

test("allows SQL after proof and non-SQL without proof", () => {
	const proven = sqlValidationProofRecord(
		sqlValidationStateCreate(),
		'psql -c "SELECT id FROM users WHERE id = 1"',
		"1",
		false,
	);

	assert.equal(sqlValidationCompletionEvaluate(proven, "UPDATE users SET active = true WHERE id = 1").correct, false);
	assert.equal(sqlValidationCompletionEvaluate(sqlValidationStateCreate(), "Updated the service tests.").correct, false);
});

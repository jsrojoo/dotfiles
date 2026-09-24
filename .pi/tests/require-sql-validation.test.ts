import assert from "node:assert/strict";
import test from "node:test";

import { finalAnswerNeedsProof, hasMutativeSql } from "../agent/extensions/require-sql-validation.ts";

test("rejects UPDATE prose without required SET", () => {
	const prose = "Update Azure and Bedrock tests";

	assert.equal(finalAnswerNeedsProof(prose), false);
	assert.equal(hasMutativeSql(prose), false);
});

test("ignores ordinary prose containing select before a later from", () => {
	const prose = [
		"Select exact provider pricing during materialization.",
		"Keep immutable facts separate from derived spend.",
	].join("\n");

	assert.equal(finalAnswerNeedsProof(prose), false);
});

test("accepts real UPDATE SQL with dotted tables and aliases", () => {
	const statements = ["UPDATE app.users u SET u.active = true", "UPDATE app.users AS u SET u.active = true"];

	for (const statement of statements) {
		assert.equal(finalAnswerNeedsProof(statement), true);
		assert.equal(hasMutativeSql(statement), true);
	}
});

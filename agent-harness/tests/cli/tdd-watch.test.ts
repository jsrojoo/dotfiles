import assert from "node:assert/strict";
import test from "node:test";

import {
	tddWatchStatusEvaluate,
	tddWatchStatusPath,
} from "#agent-harness/cli/tdd-watch";

test("watch status is green only for a fresh completed pass", () => {
	const passed = { command: ["npm", "test"], state: "passed" as const, startedAtMs: 20 };

	assert.equal(tddWatchStatusEvaluate(passed, 10).green, true);
	assert.equal(tddWatchStatusEvaluate(passed, 21).green, false);
	assert.equal(tddWatchStatusEvaluate({ ...passed, state: "running" }, 10).green, false);
	assert.equal(tddWatchStatusEvaluate({ ...passed, state: "failed" }, 10).green, false);
	assert.equal(tddWatchStatusEvaluate(undefined, 10).green, false);
});

test("watch status path is stable per workspace", () => {
	assert.equal(tddWatchStatusPath("/tmp/project"), tddWatchStatusPath("/tmp/project"));
	assert.notEqual(tddWatchStatusPath("/tmp/project"), tddWatchStatusPath("/tmp/other"));
});

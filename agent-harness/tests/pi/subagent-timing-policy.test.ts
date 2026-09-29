import assert from "node:assert/strict";
import test from "node:test";

import {
	SUBAGENT_HEARTBEAT_INTERVAL_MS,
	SUBAGENT_TIMEOUT_MS,
	buildTimeoutDiagnostic,
	hasDurationExpired,
	validatePositiveFiniteDuration,
} from "#agent-harness/pi/extensions/subagent/timing-policy";

test("exports the production heartbeat and timeout durations", () => {
	assert.equal(SUBAGENT_HEARTBEAT_INTERVAL_MS, 60_000);
	assert.equal(SUBAGENT_TIMEOUT_MS, 300_000);
});

test("validates positive finite durations", () => {
	assert.equal(validatePositiveFiniteDuration(1), 1);
	assert.equal(validatePositiveFiniteDuration(SUBAGENT_TIMEOUT_MS), SUBAGENT_TIMEOUT_MS);
	for (const durationMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
		assert.throws(() => validatePositiveFiniteDuration(durationMs), RangeError);
	}
});

test("expires exactly at the configured boundary", () => {
	const startTimeMs = 1_000;
	assert.equal(hasDurationExpired(startTimeMs, startTimeMs + SUBAGENT_TIMEOUT_MS - 1, SUBAGENT_TIMEOUT_MS), false);
	assert.equal(hasDurationExpired(startTimeMs, startTimeMs + SUBAGENT_TIMEOUT_MS, SUBAGENT_TIMEOUT_MS), true);
});

test("rejects invalid expiration times and limits", () => {
	for (const invalidTimeMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
		assert.throws(() => hasDurationExpired(invalidTimeMs, 1, 1), RangeError);
		assert.throws(() => hasDurationExpired(0, invalidTimeMs, 1), RangeError);
	}
	assert.throws(() => hasDurationExpired(2, 1, 1), /Current time must not precede start time/);
	assert.throws(() => hasDurationExpired(0, 1, 0), RangeError);
});

test("builds an actionable timeout diagnostic with compact durations", () => {
	assert.equal(
		buildTimeoutDiagnostic(300_000, 300_000),
		"Subagent timed out after 300.0s (limit 300.0s). Parent: inspect partial output/logs and re-scope to a smaller actionable task.",
	);
	assert.match(buildTimeoutDiagnostic(50, 60_000), /after <0\.1s \(limit 60\.0s\)/);
});

test("rejects invalid diagnostic durations", () => {
	for (const invalidElapsedMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
		assert.throws(() => buildTimeoutDiagnostic(invalidElapsedMs, 1), RangeError);
	}
	assert.throws(() => buildTimeoutDiagnostic(0, 0), RangeError);
});

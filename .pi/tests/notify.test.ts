import assert from "node:assert/strict";
import test from "node:test";

import { piSessionNameResolve } from "../agent/extensions/notify/session_name.ts";

test("uses the explicit Pi session name", () => {
	assert.equal(piSessionNameResolve("Named Pi Session", "pi-session-123"), "Named Pi Session");
});

test("falls back to the Pi session ID for unusable names", () => {
	assert.equal(piSessionNameResolve("  ", "pi-session-123"), "pi-session-123");
	assert.equal(piSessionNameResolve(undefined, "pi-session-123"), "pi-session-123");
});

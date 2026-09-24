import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { notificationScriptPathResolve } from "#agent-harness/pi/extensions/notify";
import { piSessionNameResolve } from "#agent-harness/pi/extensions/notify/session_name";

test("resolves the shared notification script", () => {
	assert.equal(existsSync(notificationScriptPathResolve()), true);
});

test("uses the explicit Pi session name", () => {
	assert.equal(piSessionNameResolve("Named Pi Session", "pi-session-123"), "Named Pi Session");
});

test("falls back to the Pi session ID for unusable names", () => {
	assert.equal(piSessionNameResolve("  ", "pi-session-123"), "pi-session-123");
	assert.equal(piSessionNameResolve(undefined, "pi-session-123"), "pi-session-123");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const keybindings = JSON.parse(
	readFileSync(new URL("../agent/keybindings.json", import.meta.url), "utf8"),
) as Record<string, string[]>;

test("leaves Escape behavior at Pi defaults", () => {
	assert.equal(Object.hasOwn(keybindings, "tui.altScreen.bottom"), false);
	assert.equal(Object.hasOwn(keybindings, "app.interrupt"), false);
	assert.equal(Object.hasOwn(keybindings, "tui.select.cancel"), false);
});

test("keeps built-in Ctrl-C clear and copy disabled", () => {
	assert.deepEqual(keybindings["app.clear"], []);
	assert.deepEqual(keybindings["tui.input.copy"], []);
});

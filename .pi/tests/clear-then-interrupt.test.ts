import assert from "node:assert/strict";
import test from "node:test";

import { createEditorInputPolicy } from "../agent/extensions/clear-then-interrupt-policy.ts";

test("clears first, then interrupts active work within 500ms", () => {
	let time = 1_000;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", false), "clear");
	time += 500;
	assert.equal(handle("ctrl+c", false), "abort");
});

test("recognizes a double press when the clock starts at zero", () => {
	let time = 0;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", false), "clear");
	time += 100;
	assert.equal(handle("ctrl+c", false), "abort");
});

test("a backwards clock change starts a new clear sequence", () => {
	let time = 1_000;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", false), "clear");
	time -= 100;
	assert.equal(handle("ctrl+c", false), "clear");
});

test("a press outside the window starts a new clear sequence", () => {
	let time = 1_000;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", false), "clear");
	time += 501;
	assert.equal(handle("ctrl+c", false), "clear");
});

test("an idle double press is consumed and resets the sequence", () => {
	let time = 1_000;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", true), "clear");
	time += 100;
	assert.equal(handle("ctrl+c", true), "consume");
	time += 100;
	assert.equal(handle("ctrl+c", false), "clear");
});

test("consumes Escape only while the main session is active", () => {
	const handle = createEditorInputPolicy(() => 1_000);

	assert.equal(handle("escape", false), "consume");
	assert.equal(handle("escape", true), "delegate");
});

test("intervening input resets the Ctrl-C sequence", () => {
	let time = 1_000;
	const handle = createEditorInputPolicy(() => time);

	assert.equal(handle("ctrl+c", false), "clear");
	assert.equal(handle("other", false), "delegate");
	time += 100;
	assert.equal(handle("ctrl+c", false), "clear");

	assert.equal(handle("escape", false), "consume");
	time += 100;
	assert.equal(handle("ctrl+c", false), "clear");
});

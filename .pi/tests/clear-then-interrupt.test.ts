import assert from "node:assert/strict";
import test from "node:test";

import {
	createEditorInputPolicy,
	installViewportInputBridge,
	shouldDeferCtrlUToTree,
} from "../agent/extensions/clear-then-interrupt-policy.ts";

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

test("defers Ctrl-U only when the tree selector is focused", () => {
	assert.equal(shouldDeferCtrlUToTree(true, "TreeSelectorComponent"), true);
	assert.equal(shouldDeferCtrlUToTree(true, "FocusAwareEditor"), false);
	assert.equal(shouldDeferCtrlUToTree(true, "TreeSelectorComponentSubclass"), false);
	assert.equal(shouldDeferCtrlUToTree(false, "TreeSelectorComponent"), false);
	assert.equal(shouldDeferCtrlUToTree(true, undefined), false);
});

test("the viewport bridge defers Ctrl-U to a focused tree selector", () => {
	let delegated = false;
	const target = {
		getFocusedComponent: () => ({
			constructor: { name: "TreeSelectorComponent" },
		}),
		handleViewportInput: (_data: string) => {
			delegated = true;
			return { consume: true };
		},
	};

	installViewportInputBridge(target, (data) => data === "ctrl-u");

	assert.equal(target.handleViewportInput("ctrl-u"), undefined);
	assert.equal(delegated, false);
});

test("the viewport bridge delegates non-tree and non-Ctrl-U input", () => {
	const delegated: string[] = [];
	const target = {
		getFocusedComponent: () => ({ constructor: { name: "FocusAwareEditor" } }),
		handleViewportInput: (data: string) => {
			delegated.push(data);
			return `handled:${data}`;
		},
	};

	installViewportInputBridge(target, (data) => data === "ctrl-u");

	assert.equal(target.handleViewportInput("ctrl-u"), "handled:ctrl-u");
	target.getFocusedComponent = () => ({
		constructor: { name: "TreeSelectorComponent" },
	});
	assert.equal(target.handleViewportInput("other"), "handled:other");
	assert.deepEqual(delegated, ["ctrl-u", "other"]);
});

test("viewport bridge cleanup restores the base handler", () => {
	const baseHandler = (data: string) => `handled:${data}`;
	const target = {
		getFocusedComponent: () => ({
			constructor: { name: "TreeSelectorComponent" },
		}),
		handleViewportInput: baseHandler,
	};
	const cleanup = installViewportInputBridge(
		target,
		(data) => data === "ctrl-u",
	);

	assert.notEqual(target.handleViewportInput, baseHandler);
	cleanup();
	assert.equal(target.handleViewportInput, baseHandler);
	assert.equal(target.handleViewportInput("ctrl-u"), "handled:ctrl-u");
});

test("an old cleanup cannot undo a newer bridge installation", () => {
	let delegatedCount = 0;
	const baseHandler = (data: string) => {
		delegatedCount += 1;
		return `handled:${data}`;
	};
	const target = {
		getFocusedComponent: () => ({
			constructor: { name: "TreeSelectorComponent" },
		}),
		handleViewportInput: baseHandler,
	};
	const cleanupFirst = installViewportInputBridge(
		target,
		(data) => data === "ctrl-u",
	);
	const firstBridge = target.handleViewportInput;
	const cleanupSecond = installViewportInputBridge(
		target,
		(data) => data === "new-ctrl-u",
	);
	const secondBridge = target.handleViewportInput;

	assert.notEqual(secondBridge, firstBridge);
	cleanupFirst();
	assert.equal(target.handleViewportInput, secondBridge);
	assert.equal(target.handleViewportInput("ctrl-u"), "handled:ctrl-u");
	assert.equal(target.handleViewportInput("new-ctrl-u"), undefined);
	assert.equal(target.handleViewportInput("other"), "handled:other");
	assert.equal(delegatedCount, 2);

	cleanupSecond();
	assert.equal(target.handleViewportInput, baseHandler);
});

test("the viewport bridge safely no-ops when private methods are absent", () => {
	const targetWithoutHandler = {
		getFocusedComponent: () => ({
			constructor: { name: "TreeSelectorComponent" },
		}),
	};
	const cleanupWithoutHandler = installViewportInputBridge(
		targetWithoutHandler,
		() => true,
	);
	assert.doesNotThrow(cleanupWithoutHandler);
	assert.equal(Object.hasOwn(targetWithoutHandler, "handleViewportInput"), false);

	const baseHandler = (data: string) => data;
	const targetWithoutFocus = { handleViewportInput: baseHandler };
	const cleanupWithoutFocus = installViewportInputBridge(
		targetWithoutFocus,
		() => true,
	);
	assert.equal(targetWithoutFocus.handleViewportInput, baseHandler);
	assert.doesNotThrow(cleanupWithoutFocus);
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

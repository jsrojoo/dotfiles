import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prompt = readFileSync(new URL("../.pi/agent/extensions/plan-mode/plan-mode-prompt.md", import.meta.url), "utf8");
const source = readFileSync(new URL("../.pi/agent/extensions/plan-mode/index.ts", import.meta.url), "utf8");

test("loads plan mode prompt from its own file", () => {
	assert.match(prompt, /^\[PLAN MODE ACTIVE\]/);
	assert.match(prompt, /`plan` skill/);
	assert.doesNotMatch(source, /You are in plan mode/);
});

test("preserves newly registered tools when restoring plan mode", () => {
	assert.match(
		source,
		/toolsBeforePlanMode = uniqueToolNames\(\[\.\.\.\(toolsBeforePlanMode \?\? \[\]\), \.\.\.pi\.getActiveTools\(\)\]\)/,
	);
});

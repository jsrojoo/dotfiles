import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prompt = readFileSync(new URL("../.pi/agent/extensions/plan-mode/plan-mode-prompt.md", import.meta.url), "utf8");
const source = readFileSync(new URL("../.pi/agent/extensions/plan-mode/index.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../.pi/agent/settings.json", import.meta.url), "utf8");
const agentInstructions = readFileSync(new URL("../.pi/agent/AGENTS.md", import.meta.url), "utf8");

test("loads plan mode prompt from its own file", () => {
	assert.match(prompt, /^\[PLAN MODE ACTIVE\]/);
	assert.match(prompt, /`plan` skill/);
	assert.match(prompt, /`ponytail` skill/);
	assert.match(prompt, /`plan-mode-tasks`/);
	assert.match(settings, /"~\/dotfiles\/\.pi\/agent\/extensions\/plan-mode"/);
	assert.doesNotMatch(source, /You are in plan mode/);
});

test("preserves newly registered tools when restoring plan mode", () => {
	assert.match(
		source,
		/toolsBeforePlanMode = uniqueToolNames\(\[\.\.\.\(toolsBeforePlanMode \?\? \[\]\), \.\.\.pi\.getActiveTools\(\)\]\)/,
	);
});

test("exposes model-callable plan entry while preserving approval and enforcement", () => {
	assert.match(source, /name:\s*"enter_plan_mode"/);
	assert.match(source, /togglePlanMode\(ctx\)/);
	assert.match(source, /ctx\.ui\.select\("Plan mode - what next\?"/);
	assert.match(source, /pi\.on\("tool_call"/);
	assert.match(source, /isSafeCommand\(command\)/);
	assert.match(agentInstructions, /Use `enter_plan_mode` for non-trivial implementation work or when the user asks for a plan\./);
	assert.match(agentInstructions, /always send a final completion summary after all tool and monitor output/);
	assert.match(agentInstructions, /Never leave a background-job, tool, or monitor notification as the final user-facing response/);
	assert.doesNotMatch(agentInstructions, /^## Plan Approval Gate$/m);
});

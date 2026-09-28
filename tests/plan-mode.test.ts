import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSafeCommand } from "../.pi/agent/extensions/plan-mode/utils.ts";

const prompt = readFileSync(new URL("../.pi/agent/extensions/plan-mode/plan-mode-prompt.md", import.meta.url), "utf8");
const source = readFileSync(new URL("../.pi/agent/extensions/plan-mode/index.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../.pi/agent/settings.json", import.meta.url), "utf8");
const agentInstructions = readFileSync(new URL("../.pi/agent/AGENTS.md", import.meta.url), "utf8");

test("loads plan mode prompt from its own file", () => {
	assert.match(prompt, /^\[PLAN MODE ACTIVE\]/);
	assert.match(prompt, /`plan` skill/);
	assert.match(prompt, /`ponytail` skill/);
	assert.match(prompt, /`plan-mode-tasks`/);
	assert.match(prompt, /scope-based top-level phases/);
	assert.match(prompt, /dependency graph/);
	assert.match(prompt, /parallel execution groups/);
	assert.match(prompt, /chronological execution order/);
	assert.match(prompt, /non-numbered bullets/);
	assert.match(prompt, /end with `High-level summary:` and then `TL;DR:`/);
	assert.match(prompt, /final visible content/);
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
	assert.doesNotMatch(source, /ctx\.ui\.(?:select|editor)\(/);
	assert.match(source, /pi\.on\("input"/);
	assert.match(source, /pi\.on\("tool_call"/);
	assert.match(source, /isSafeCommand\(command\)/);
	assert.match(agentInstructions, /Use `enter_plan_mode` for non-trivial implementation work or when the user asks for a plan\./);
	assert.match(agentInstructions, /through one main `context` coordinator invocation/);
	assert.match(agentInstructions, /fan out internally to 2-4 read-only `context-retriever` leaves/);
	assert.doesNotMatch(agentInstructions, /Run independent investigations in one parallel call with at most 4 concurrent context children/);
	assert.match(agentInstructions, /always send a final completion summary after all tool and monitor output/);
	assert.match(agentInstructions, /Never leave a background-job, tool, or monitor notification as the final user-facing response/);
	assert.doesNotMatch(agentInstructions, /^## Plan Approval Gate$/m);
});

test("allows only offline termaid rendering through uvx", () => {
	assert.equal(isSafeCommand("uvx --offline termaid --ascii"), true);
	assert.equal(
		isSafeCommand("uvx --offline termaid --ascii <<'MERMAID'\nflowchart TD\n  A --> B\nMERMAID"),
		true,
	);

	assert.equal(isSafeCommand("uvx termaid --ascii"), false);
	assert.equal(isSafeCommand("uvx --offline other-package --ascii"), false);
	assert.equal(isSafeCommand("uvx --offline termaid"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii --output diagram.txt"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii | tee diagram.txt"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii > diagram.txt"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii; touch changed.txt"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii $(touch changed.txt)"), false);
	assert.equal(isSafeCommand("uvx --offline termaid --ascii <<MERMAID\n$(touch changed.txt)\nMERMAID"), false);
});

test("handles explicit chat approval without consuming refinement", () => {
	assert.match(source, /function isPlanApproval\(input: string\): boolean/);
	assert.match(source, /approve\(\?:d\)\?/);
	assert.match(source, /execute\(\?: the plan\)\?/);
	assert.match(source, /implement\(\?: the plan\| it\)\?/);
	assert.match(source, /go ahead\|proceed/);
	assert.match(source, /event\.streamingBehavior !== undefined/);
	assert.match(source, /!isPlanApproval\(event\.text\)/);
	assert.match(source, /return \{ action: "handled" \}/);
	assert.match(source, /return \{ action: "continue" \}/);
});

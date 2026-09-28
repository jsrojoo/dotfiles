import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	areAllTodosCompleted,
	derivePlanModeLifecycle,
	extractDoneSteps,
	isSafeCommand,
	markCompletedSteps,
	validatePlanModeState,
} from "../.pi/agent/extensions/plan-mode/utils.ts";

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
	assert.match(prompt, /chronological execution order/);
	assert.match(prompt, /non-numbered bullets/);
	assert.match(prompt, /end with `High-level summary:` and then `TL;DR:`/);
	assert.match(prompt, /final visible content/);
	assert.match(settings, /"~\/dotfiles\/\.pi\/agent\/extensions\/plan-mode"/);
	assert.doesNotMatch(source, /You are in plan mode/);
});

test("validates and defensively copies persisted plan mode state", () => {
	const persisted = {
		enabled: false,
		executing: true,
		todos: [{ step: 1, text: "Implement persistence", completed: false }],
		toolsBeforePlanMode: ["read", "bash"],
	};

	const state = validatePlanModeState(persisted);
	assert.deepEqual(state, persisted);
	assert.notEqual(state, persisted);
	assert.notEqual(state?.todos, persisted.todos);
	assert.notEqual(state?.toolsBeforePlanMode, persisted.toolsBeforePlanMode);
});

test("rejects malformed persisted plan mode state", () => {
	assert.equal(validatePlanModeState(null), null);
	assert.equal(validatePlanModeState({ enabled: "yes" }), null);
	assert.equal(validatePlanModeState({ enabled: true, todos: [{ step: 0, text: "Bad", completed: false }] }), null);
	assert.equal(validatePlanModeState({ enabled: true, todos: [{ step: 1, text: "", completed: false }] }), null);
	assert.equal(validatePlanModeState({ enabled: true, toolsBeforePlanMode: ["read", 1] }), null);
	assert.equal(validatePlanModeState({ enabled: false, executing: true, todos: [] }), null);
	assert.equal(
		validatePlanModeState({
			enabled: true,
			executing: true,
			todos: [{ step: 1, text: "Contradictory", completed: false }],
		}),
		null,
	);
	assert.equal(
		validatePlanModeState({
			enabled: false,
			executing: true,
			todos: [
				{ step: 1, text: "First", completed: false },
				{ step: 1, text: "Duplicate", completed: false },
			],
		}),
		null,
	);
});

test("uses persisted todos for marker detection and completion", () => {
	const todos = [
		{ step: 1, text: "First", completed: false },
		{ step: 2, text: "Second", completed: false },
	];

	assert.deepEqual(extractDoneSteps("done [done:2] and [DONE:99]"), [2, 99]);
	assert.equal(markCompletedSteps("done [DONE:2] and [DONE:99]", todos), 2);
	assert.deepEqual(todos.map((todo) => todo.completed), [false, true]);
	assert.equal(areAllTodosCompleted(todos), false);
	markCompletedSteps("[DONE:1]", todos);
	assert.equal(areAllTodosCompleted(todos), true);
	assert.equal(areAllTodosCompleted([]), false);
});

test("derives the plan workflow lifecycle from persisted state", () => {
	const todos = [{ step: 1, text: "Implement", completed: false }];

	assert.equal(derivePlanModeLifecycle({ enabled: false }), "inactive");
	assert.equal(derivePlanModeLifecycle({ enabled: true, todos }), "planning");
	assert.equal(derivePlanModeLifecycle({ enabled: false, executing: true, todos }), "executing");
	assert.equal(
		derivePlanModeLifecycle({ enabled: false, executing: true, todos: [{ ...todos[0], completed: true }] }),
		"completed",
	);
});

test("fails closed on a malformed newest persisted plan mode entry", () => {
	assert.match(
		source,
		/pi\.on\("session_start"[\s\S]*?planModeEnabled = pi\.getFlag\("plan"\) === true;\s*executionMode = false;\s*todoItems = \[\];\s*toolsBeforePlanMode = undefined;/,
	);
	assert.match(
		source,
		/if \(entry\.type !== "custom" \|\| entry\.customType !== "plan-mode"\) continue;\s*restoredState = validatePlanModeState\(entry\.data\);\s*break;/,
	);
	assert.doesNotMatch(
		source,
		/restoredState = validatePlanModeState\(entry\.data\);\s*if \(restoredState\) break;/,
	);
});

test("clears replay-completed execution during restoration", () => {
	assert.match(
		source,
		/markCompletedSteps\(allText, todoItems\);\s*}\s*if \(derivePlanModeLifecycle\(\{ enabled: planModeEnabled, executing: executionMode, todos: todoItems }\) === "completed"\) \{\s*executionMode = false;\s*todoItems = \[\];\s*persistState\(\);\s*}/,
	);
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
	assert.match(source, /if \(executeIndex >= 0\)/);
});

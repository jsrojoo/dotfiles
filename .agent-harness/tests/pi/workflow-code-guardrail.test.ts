import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { objectiveScopeEnforcementCreate } from "#agent-harness/pi/extensions/workflow-code/enforce-objective-scope";
import { testDrivenDevelopmentEnforcementCreate } from "#agent-harness/pi/extensions/workflow-code/enforce-test-driven-development";

type Handler = (event: any, context: any) => any;
type CommandHandler = (argumentsText: string, context: any) => any;

const ALIGNED_VERDICT = JSON.stringify({
	verdict: "aligned",
	summary: "The implementation matches the objective.",
	evidence: [],
	required_changes: [],
});

test("Pi settings load shared extensions independently of the working directory", () => {
	const settingsUrl = new URL("../../../.pi/agent/settings.json", import.meta.url);
	const settings = JSON.parse(readFileSync(settingsUrl, "utf8"));

	assert.deepEqual(settings.extensions, [
		"~/dotfiles/.agent-harness/src/pi/extensions/notify.ts",
		"~/dotfiles/.agent-harness/src/pi/extensions/workflow-code/enforce-test-driven-development.ts",
		"~/dotfiles/.agent-harness/src/pi/extensions/workflow-code/enforce-objective-scope.ts",
	]);
});

function harnessCreate(judgeComplete = async () => ALIGNED_VERDICT) {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, CommandHandler>();
	const notifications: string[] = [];
	const pi = {
		on(name: string, handler: Handler) {
			const previous = handlers.get(name);
			handlers.set(name, async (event, context) => {
				const previousResult = await previous?.(event, context);
				const result = await handler(event, context);
				return result ?? previousResult;
			});
			return () => undefined;
		},
		registerCommand(name: string, options: { handler: CommandHandler }) {
			commands.set(name, options.handler);
		},
	};
	const context = {
		sessionManager: {
			getBranch: () => [],
			getSessionId: () => "session-1",
		},
		ui: { notify: (message: string) => notifications.push(message) },
	};

	testDrivenDevelopmentEnforcementCreate()(pi as any);
	objectiveScopeEnforcementCreate(judgeComplete)(pi as any);
	return { commands, context, handlers, notifications };
}

test("Pi adapter enforces red before source edits and green before completion", async () => {
	const { context, handlers } = harnessCreate();
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;
	const beforeSettle = handlers.get("agent_before_settle")!;

	const blocked = await toolCall(
		{ toolName: "edit", input: { path: "src/account.ts" } },
		context,
	);
	assert.equal(blocked.block, true);

	await toolResult(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: true },
		context,
	);
	assert.equal(
		await toolCall(
			{ toolCallId: "edit-1", toolName: "edit", input: { path: "src/account.ts", edits: [] } },
			context,
		),
		undefined,
	);
	await toolResult(
		{ toolCallId: "edit-1", toolName: "edit", input: {}, isError: false },
		context,
	);

	const reminder = await beforeSettle({}, context);
	assert.equal(reminder.continue, true);
	assert.equal(reminder.entries[0].customType, "workflow-code-guardrail");
	assert.equal(await beforeSettle({}, context), undefined);

	await toolResult(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: false },
		context,
	);
	assert.equal(await beforeSettle({}, context), undefined);
});

test("Pi adapter notifies when an objective milestone is aligned", async () => {
	const { context, handlers, notifications } = harnessCreate();
	await handlers.get("tool_result")!(
		{
			toolName: "bash",
			input: { command: "node --test account.test.ts" },
			isError: true,
			content: [],
		},
		context,
	);

	assert.match(notifications.at(-1)!, /workflow check passed.*red/i);
});

test("Pi adapter keeps source locked when the red milestone is out of scope", async () => {
	const reviseVerdict = JSON.stringify({
		verdict: "revise",
		summary: "The failing test does not cover the requested behavior.",
		evidence: [
			{
				path: "tests/account.test.ts",
				change: "Tests an unrelated field",
				objective_conflict: "The objective only concerns account names",
			},
		],
		required_changes: ["Add a failing test for blank account names"],
	});
	const { context, handlers, notifications } = harnessCreate(async () => reviseVerdict);
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	const feedback = await toolResult(
		{
			toolName: "bash",
			input: { command: "node --test account.test.ts" },
			isError: true,
			content: [],
		},
		context,
	);
	assert.match(feedback.content.at(-1).text, /does not cover/i);
	assert.match(notifications.at(-1)!, /workflow drift detected.*red/i);
	assert.equal(
		(
			await toolCall(
				{ toolName: "edit", input: { path: "src/account.ts" } },
				context,
			)
		).block,
		true,
	);
});

test("Pi adapter runs one final objective correction without looping", async () => {
	const milestones: string[] = [];
	const judgeComplete = async (prompt: string) => {
		assert.match(prompt, /Reject blank account names only/);
		const milestone = /\"milestone\":\"([^\"]+)/.exec(prompt)?.[1] ?? "unknown";
		milestones.push(milestone);
		if (milestone !== "completion") return ALIGNED_VERDICT;
		return JSON.stringify({
			verdict: "revise",
			summary: "An unrelated fallback was added.",
			evidence: [
				{
					path: "src/account.ts",
					change: "Added an unrelated fallback",
					objective_conflict: "The objective only changes blank-name validation",
				},
			],
			required_changes: ["Remove the unrelated fallback"],
		});
	};
	const { context, handlers, notifications } = harnessCreate(judgeComplete);
	const beforeSettle = handlers.get("agent_before_settle")!;
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	await input(
		{ source: "interactive", text: "Reject blank account names only" },
		context,
	);
	await toolResult(
		{ toolName: "bash", input: { command: "pytest" }, isError: true, content: [] },
		context,
	);
	await toolCall(
		{ toolCallId: "edit-1", toolName: "edit", input: { path: "src/account.py", edits: [] } },
		context,
	);
	await toolResult(
		{ toolCallId: "edit-1", toolName: "edit", input: {}, isError: false },
		context,
	);
	await toolResult(
		{ toolName: "bash", input: { command: "pytest" }, isError: false, content: [] },
		context,
	);

	const correction = await beforeSettle({}, context);
	assert.equal(correction.continue, true);
	assert.equal(correction.entries[0].customType, "workflow-code-judge");
	assert.match(notifications.at(-1)!, /workflow drift detected.*completion/i);
	assert.equal(await beforeSettle({}, context), undefined);
	assert.deepEqual(milestones, ["red", "green", "completion"]);
});

test("Pi adapter checks scope after several successful production edits", async () => {
	const milestones: string[] = [];
	const judgeComplete = async (prompt: string) => {
		const milestone = /\"milestone\":\"([^\"]+)/.exec(prompt)?.[1] ?? "unknown";
		milestones.push(milestone);
		if (milestone !== "implementation") return ALIGNED_VERDICT;
		return JSON.stringify({
			verdict: "revise",
			summary: "The next edit adds unrelated behavior.",
			evidence: [
				{
					path: "src/extra.ts",
					change: "Adds an unrelated helper",
					objective_conflict: "The objective only changes account validation",
				},
			],
			required_changes: ["Do not add the unrelated helper"],
		});
	};
	const { context, handlers, notifications } = harnessCreate(judgeComplete);
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	await input({ source: "interactive", text: "Change account validation only" }, context);
	await toolResult(
		{ toolName: "bash", input: { command: "pytest" }, isError: true, content: [] },
		context,
	);
	for (let index = 0; index < 3; index += 1) {
		const toolCallId = `edit-${index}`;
		assert.equal(
			await toolCall(
				{
					toolCallId,
					toolName: "edit",
					input: { path: "src/account.ts", edits: [{ newText: `change-${index}` }] },
				},
				context,
			),
			undefined,
		);
		await toolResult(
			{ toolCallId, toolName: "edit", input: {}, isError: false },
			context,
		);
	}

	const blocked = await toolCall(
		{
			toolCallId: "edit-extra",
			toolName: "write",
			input: { path: "src/extra.ts", content: "export const extra = true;" },
		},
		context,
	);
	assert.equal(blocked.block, true);
	assert.match(blocked.reason, /unrelated behavior/i);
	assert.match(notifications.at(-1)!, /workflow drift detected.*implementation/i);
	assert.deepEqual(milestones, ["red", "implementation"]);
});

test("Pi adapter allows one coherent large edit before a semantic checkpoint", async () => {
	const milestones: string[] = [];
	const { context, handlers } = harnessCreate(async (prompt: string) => {
		milestones.push(/\"milestone\":\"([^\"]+)/.exec(prompt)?.[1] ?? "unknown");
		return ALIGNED_VERDICT;
	});
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	await toolResult(
		{ toolName: "bash", input: { command: "pytest" }, isError: true, content: [] },
		context,
	);
	assert.equal(
		await toolCall({
			toolCallId: "large-edit",
			toolName: "write",
			input: { path: "src/parser.ts", content: "x".repeat(5_000) },
		}, context),
		undefined,
	);
	await toolResult(
		{ toolCallId: "large-edit", toolName: "write", input: {}, isError: false },
		context,
	);

	assert.deepEqual(milestones, ["red"]);
});

test("Pi adapter resets on a new request", async () => {
	const { context, handlers } = harnessCreate();
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: true }, context);
	assert.equal(
		await toolCall({ toolName: "write", input: { path: "src/account.py" } }, context),
		undefined,
	);

	await input({ source: "interactive", text: "another task" }, context);
	const blocked = await toolCall(
		{ toolName: "write", input: { path: "src/other.py" } },
		context,
	);
	assert.equal(blocked.block, true);
});

test("Pi adapter keeps the current cycle for steering input", async () => {
	const { context, handlers } = harnessCreate();
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;

	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: true }, context);
	await toolCall({ toolName: "edit", input: { path: "src/account.py" } }, context);
	await input(
		{ source: "interactive", text: "also update the mapper", streamingBehavior: "steer" },
		context,
	);

	assert.equal(
		await toolCall({ toolName: "edit", input: { path: "src/mapper.py" } }, context),
		undefined,
	);
});

test("Pi adapter honors the guardrail kill switch", async () => {
	const previousValue = process.env.AGENT_HARNESS_GUARDRAIL_OFF;
	process.env.AGENT_HARNESS_GUARDRAIL_OFF = "1";

	try {
		const { context, handlers } = harnessCreate();
		const result = await handlers.get("tool_call")!(
			{ toolName: "write", input: { path: "src/account.ts" } },
			context,
		);
		assert.equal(result, undefined);
	} finally {
		if (previousValue === undefined) delete process.env.AGENT_HARNESS_GUARDRAIL_OFF;
		else process.env.AGENT_HARNESS_GUARDRAIL_OFF = previousValue;
	}
});

test("Pi adapter applies a one-request TDD kill switch", async () => {
	const { commands, context, handlers, notifications } = harnessCreate();
	const skip = commands.get("tdd-skip")!;
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;

	await skip("", context);
	assert.match(notifications.at(-1)!, /next request/i);
	await input({ source: "interactive", text: "continue" }, context);
	assert.equal(
		await toolCall({ toolName: "edit", input: { path: "src/generated.ts" } }, context),
		undefined,
	);

	await input({ source: "interactive", text: "new task" }, context);
	const blocked = await toolCall(
		{ toolName: "edit", input: { path: "src/other.ts" } },
		context,
	);
	assert.equal(blocked.block, true);
});

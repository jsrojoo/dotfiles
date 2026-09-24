import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { objectiveAlignmentEnforcementCreate } from "#agent-harness/pi/extensions/workflow-code/register-objective-alignment";
import { testDrivenDevelopmentEnforcementCreate } from "#agent-harness/pi/extensions/workflow-code/register-test-driven-development";

type Handler = (event: any, context: any) => any;
type CommandHandler = (argumentsText: string, context: any) => any;

const ALIGNED_VERDICT = JSON.stringify({
	align: true,
	summary: "The implementation matches the objective.",
	evidence: [],
	required_changes: [],
});

test("Pi settings load shared extensions independently of the working directory", () => {
	const settingsUrl = new URL("../../../../.pi/agent/settings.json", import.meta.url);
	const settings = JSON.parse(readFileSync(settingsUrl, "utf8"));

	assert.deepEqual(settings.extensions, [
		"~/dotfiles/.agent-harness/src/pi/extensions/notify.ts",
		"~/dotfiles/.agent-harness/src/pi/extensions/sql-guardrail/block-mutative-sql.ts",
		"~/dotfiles/.agent-harness/src/pi/extensions/sql-guardrail/require-sql-validation.ts",
		"~/dotfiles/.agent-harness/src/pi/extensions/workflow-code/register-test-driven-development.ts",
	]);
});

function harnessCreate(
	judgeComplete = async () => ALIGNED_VERDICT,
	branch: any[] = [],
	workspaceStateRead: Parameters<typeof objectiveAlignmentEnforcementCreate>[1] = () =>
		undefined,
) {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, CommandHandler>();
	const entries: Array<{ customType: string; data: any }> = [];
	let editorText = "";
	const notifications: string[] = [];
	const renderers = new Map<string, Function>();
	const pi = {
		appendEntry(customType: string, data: any) {
			entries.push({ customType, data });
		},
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
		registerEntryRenderer(name: string, renderer: Function) {
			renderers.set(name, renderer);
		},
	};
	const context = {
		sessionManager: {
			getBranch: () => branch,
			getSessionId: () => "session-1",
		},
		ui: {
			notify: (message: string) => notifications.push(message),
			setEditorText: (text: string) => {
				editorText = text;
			},
		},
	};

	testDrivenDevelopmentEnforcementCreate()(pi as any);
	objectiveAlignmentEnforcementCreate(judgeComplete, workspaceStateRead)(pi as any);
	return {
		commands,
		context,
		entries,
		getEditorText: () => editorText,
		handlers,
		notifications,
		renderers,
	};
}

test("Pi adapter enforces and notifies red before source edits and green before completion", async () => {
	const { context, handlers, notifications } = harnessCreate();
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;
	const beforeSettle = handlers.get("agent_before_settle")!;

	const blocked = await toolCall(
		{ toolName: "edit", input: { path: "src/account.ts" } },
		context,
	);
	assert.equal(blocked.block, true);
	assert.equal(notifications.at(-1), blocked.reason);

	await toolResult(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: true },
		context,
	);
	assert.equal(
		notifications.at(-1),
		"TDD guardrail: red established; production-code edits unlocked.",
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
	assert.match(notifications.at(-1)!, /passing test/);
	assert.equal(await beforeSettle({}, context), undefined);

	await toolResult(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: false },
		context,
	);
	assert.equal(notifications.at(-1), "TDD guardrail: green established.");
	assert.equal(await beforeSettle({}, context), undefined);
});

test("Pi adapter keeps aligned objective checks invisible", async () => {
	const { context, entries, handlers, notifications, renderers } = harnessCreate();
	await handlers.get("tool_result")!(
		{
			toolName: "bash",
			input: { command: "node --test account.test.ts" },
			isError: true,
			content: [],
		},
		context,
	);

	assert.deepEqual(notifications, [
		"TDD guardrail: red established; production-code edits unlocked.",
	]);
	assert.equal(
		entries.some((entry) => entry.customType === "workflow-code-judge-check"),
		false,
	);
	assert.equal(renderers.has("workflow-code-judge-check"), true);
});

test("Pi adapter detects failed subagent workspace changes before a passing test", async () => {
	const milestones: string[] = [];
	const prompts: string[] = [];
	let files: Array<{
		path: string;
		status: string;
		fingerprint: string;
		excerpt: string;
		characterCount: number;
	}> = [];
	const workspaceStateRead = () => ({ root: "/repo", files });
	const { context, handlers } = harnessCreate(
		async (prompt: string) => {
			prompts.push(prompt);
			milestones.push(/\"milestone\":\"([^\"]+)/.exec(prompt)?.[1] ?? "unknown");
			return ALIGNED_VERDICT;
		},
		[],
		workspaceStateRead,
	);

	await handlers.get("input")!(
		{ source: "interactive", text: "Update account validation" },
		context,
	);
	files = [{
		path: "src/account.ts",
		status: " M",
		fingerprint: "changed-account",
		excerpt: "export const account = 'changed';",
		characterCount: 33,
	}];
	await handlers.get("tool_result")!(
		{ toolName: "subagent", input: {}, isError: true, content: [] },
		context,
	);
	await handlers.get("tool_result")!(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: false, content: [] },
		context,
	);

	assert.deepEqual(milestones, ["green"]);
	assert.match(prompts[0], /src\/account\.ts/);
	assert.match(prompts[0], /changed-account|export const account/);
});

test("Pi adapter does not attribute unchanged pre-existing dirty workspace state", async () => {
	const prompts: string[] = [];
	const files = [{
		path: "src/user-work.ts",
		status: " M",
		fingerprint: "pre-existing",
		excerpt: "user change",
		characterCount: 11,
	}];
	const { context, handlers } = harnessCreate(async (prompt: string) => {
		prompts.push(prompt);
		return ALIGNED_VERDICT;
	}, [], () => ({ root: "/repo", files }));

	await handlers.get("input")!(
		{ source: "interactive", text: "Update account validation" },
		context,
	);
	await handlers.get("tool_result")!(
		{ toolName: "subagent", input: {}, isError: false, content: [] },
		context,
	);
	await handlers.get("tool_result")!(
		{ toolName: "bash", input: { command: "node --test account.test.ts" }, isError: false, content: [] },
		context,
	);
	assert.equal(await handlers.get("agent_before_settle")!({}, context), undefined);
	assert.deepEqual(prompts, []);
});

test("Pi adapter keeps source locked when the red milestone is out of scope", async () => {
	const reviseVerdict = JSON.stringify({
		align: false,
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
	const { context, entries, handlers, notifications, renderers } = harnessCreate(
		async () => reviseVerdict,
	);
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;
	await handlers.get("input")!(
		{ source: "interactive", text: "Reject blank account names" },
		context,
	);

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
	assert.equal(
		notifications.at(-1),
		"Objective: Reject blank account names\n" +
			"Drift: The failing test does not cover the requested behavior.\n" +
			"Re-align: Add a failing test for blank account names",
	);
	const driftEntry = entries.find((entry) => entry.customType === "workflow-code-judge-check")!;
	const rendered = renderers.get("workflow-code-judge-check")!(
		{ data: driftEntry.data },
		{ expanded: true },
	).render();
	assert.deepEqual(rendered, [
		"Objective: Reject blank account names",
		"Drift: The failing test does not cover the requested behavior.",
		"Re-align: Add a failing test for blank account names",
	]);
	assert.doesNotMatch(rendered.join("\n"), /align:(?:true|false)|implementation|completion|red|green/i);
	const blocked = await toolCall(
		{ toolName: "edit", input: { path: "src/account.ts" } },
		context,
	);
	assert.equal(blocked.block, true);
	assert.equal(blocked.terminate, true);
});

test("Pi adapter runs one final objective correction without looping", async () => {
	const milestones: string[] = [];
	const judgeComplete = async (prompt: string) => {
		assert.match(prompt, /Reject blank account names only/);
		const milestone = /\"milestone\":\"([^\"]+)/.exec(prompt)?.[1] ?? "unknown";
		milestones.push(milestone);
		if (milestone !== "completion") return ALIGNED_VERDICT;
		return JSON.stringify({
			align: false,
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
	assert.match(notifications.at(-1)!, /^Objective: Reject blank account names only\nDrift:/);
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
			align: false,
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
	assert.equal(blocked.terminate, true);
	assert.match(blocked.reason, /unrelated behavior/i);
	assert.match(notifications.at(-1)!, /^Objective: Change account validation only\nDrift:/);
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

test("Pi adapter changes an active objective only through explicit editing", async () => {
	const prompts: string[] = [];
	const { context, handlers } = harnessCreate(async (prompt: string) => {
		prompts.push(prompt);
		return ALIGNED_VERDICT;
	});
	const input = handlers.get("input")!;

	await input({ source: "interactive", text: "Refactor workflow guardrails" }, context);
	await input({ source: "interactive", text: "Keep the preferred factory name" }, context);
	await handlers.get("tool_result")!(
		{ toolName: "bash", input: { command: "node --test" }, isError: true, content: [] },
		context,
	);

	assert.match(prompts[0], /Refactor workflow guardrails/);
	assert.doesNotMatch(prompts[0], /Keep the preferred factory name/);
});

test("Pi adapter starts fresh objective history after aligned completion", async () => {
	const prompts: string[] = [];
	const { context, entries, handlers } = harnessCreate(async (prompt: string) => {
		prompts.push(prompt);
		return ALIGNED_VERDICT;
	});
	const input = handlers.get("input")!;
	const toolCall = handlers.get("tool_call")!;
	const toolResult = handlers.get("tool_result")!;
	const beforeSettle = handlers.get("agent_before_settle")!;

	await input({ source: "interactive", text: "First objective" }, context);
	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: true, content: [] }, context);
	await toolCall({ toolCallId: "old-edit", toolName: "edit", input: { path: "src/old.ts", edits: [{ newText: "old-change" }] } }, context);
	await toolResult({ toolCallId: "old-edit", toolName: "edit", input: {}, isError: false }, context);
	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: false, content: [] }, context);
	await beforeSettle({}, context);

	await input({ source: "interactive", text: "Second objective" }, context);
	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: true, content: [] }, context);
	await toolCall({ toolCallId: "new-edit", toolName: "edit", input: { path: "src/new.ts", edits: [{ newText: "new-change" }] } }, context);
	await toolResult({ toolCallId: "new-edit", toolName: "edit", input: {}, isError: false }, context);
	await toolResult({ toolName: "bash", input: { command: "pytest" }, isError: false, content: [] }, context);
	await beforeSettle({}, context);

	const completionPrompts = prompts.filter((prompt) => /"milestone":"completion"/.test(prompt));
	assert.equal(completionPrompts.length, 2);
	assert.match(completionPrompts[1], /new-change/);
	assert.doesNotMatch(completionPrompts[1], /old-change/);
	assert.deepEqual(entries.map((entry) => entry.customType).filter((type) => type.includes("objective")), [
		"workflow-code-objective-start",
		"workflow-code-objective-end",
		"workflow-code-objective-start",
		"workflow-code-objective-end",
	]);
});

test("Pi adapter restores objective history from start and end entries", async () => {
	const branch = [
		{ type: "custom", customType: "workflow-code-objective-start", data: { objectiveId: 1, objective: "Old objective", status: "active", startedAt: 10 } },
		{ type: "custom", customType: "workflow-code-objective-end", data: { objectiveId: 1, objective: "Old objective", status: "completed", startedAt: 10, endedAt: 20 } },
		{ type: "custom", customType: "workflow-code-objective-start", data: { objectiveId: 2, objective: "Current objective", status: "active", startedAt: 30 } },
	];
	const { commands, context, getEditorText, handlers } = harnessCreate(async () => ALIGNED_VERDICT, branch);
	await handlers.get("session_start")!({}, context);
	await commands.get("workflow-objective-edit")!("", context);
	assert.equal(getEditorText(), "Current objective");
});

test("Pi adapter loads the current objective for external editing", async () => {
	const { commands, context, entries, getEditorText, handlers, notifications } = harnessCreate();
	await handlers.get("input")!(
		{ source: "interactive", text: "Original objective" },
		context,
	);

	await commands.get("workflow-objective-edit")!("", context);

	assert.equal(getEditorText(), "Original objective");
	assert.match(notifications.at(-1)!, /Ctrl\+G/);

	await handlers.get("input")!(
		{ source: "interactive", text: "Corrected objective" },
		context,
	);
	assert.equal(entries.at(-1)?.customType, "workflow-code-objective");
	assert.equal(entries.at(-1)?.data.objective, "Corrected objective");
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

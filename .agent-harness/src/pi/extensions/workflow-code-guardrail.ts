import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
	ToolResultEventResult,
} from "@earendil-works/pi-coding-agent";
import {
	workflowCodeJudgeRun,
} from "#agent-harness/core/guardrails/workflow-code/judge";
import {
	workflowCodeCompletionEvaluate,
	workflowCodePathClassify,
	workflowCodeStateCreate,
	workflowCodeStateSkip,
	workflowCodeTestCommandIsRecognized,
	workflowCodeTestResultApply,
	workflowCodeWriteEvaluate,
} from "#agent-harness/core/guardrails/workflow-code/policy";
import type {
	WorkflowCodeChange,
	WorkflowCodeJudgeComplete,
	WorkflowCodeJudgeOutcome,
	WorkflowCodeJudgeRequest,
	WorkflowCodeState,
	WorkflowCodeTestEvidence,
} from "#agent-harness/core/guardrails/workflow-code/types";

const GREEN_REMINDER =
	"Workflow-code guardrail: production code changed without a subsequent passing test. " +
	"Run the narrowest relevant test now. If verification is unavailable, explain why before completing.";

interface SessionGuardrailState {
	changes: WorkflowCodeChange[];
	completionCorrectionSent: boolean;
	conversationContext: string[];
	cycle: WorkflowCodeState;
	judgeCache: Map<string, WorkflowCodeJudgeOutcome>;
	objective: string;
	previousFeedback: string[];
	skipNext?: boolean;
}

type PiJudgeComplete = (prompt: string, ctx: ExtensionContext) => Promise<string>;

function guardrailDisabled(): boolean {
	return (
		process.env.AGENT_HARNESS_GUARDRAIL_OFF === "1" ||
		process.env.PI_GUARDRAIL_OFF === "1"
	);
}

function messageTextExtract(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: "text"; text: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: string }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string",
		)
		.map((block) => block.text)
		.join("\n");
}

function conversationContextBuild(ctx: ExtensionContext): string[] {
	return ctx.sessionManager
		.getBranch()
		.slice(-8)
		.flatMap((entry) => {
			if (entry.type !== "message" || !entry.message) return [];
			const message = entry.message as { role?: string; content?: unknown };
			const text = messageTextExtract(message.content).trim();
			return text ? [`${message.role ?? "message"}: ${text}`] : [];
		});
}

function changeBuild(event: ToolCallEvent): WorkflowCodeChange | undefined {
	if (event.toolName === "write") {
		const input = event.input as { content?: string; path?: string };
		return {
			operation: "write",
			path: String(input.path ?? ""),
			excerpt: String(input.content ?? ""),
		};
	}
	if (event.toolName === "edit") {
		const input = event.input as {
			edits?: Array<{ oldText?: string; newText?: string }>;
			path?: string;
		};
		return {
			operation: "edit",
			path: String(input.path ?? ""),
			excerpt: JSON.stringify(input.edits ?? []),
		};
	}
	return undefined;
}

function testEvidenceBuild(event: ToolResultEvent): WorkflowCodeTestEvidence {
	return {
		command: String((event.input as { command?: string }).command ?? ""),
		status: event.isError ? "failed" : "passed",
		output: messageTextExtract(event.content),
	};
}

function judgeFeedbackBuild(outcome: WorkflowCodeJudgeOutcome): string {
	const requiredChanges = outcome.required_changes.map((item) => `- ${item}`).join("\n");
	return [
		`Workflow-code judge: ${outcome.summary}`,
		requiredChanges ? `Required changes:\n${requiredChanges}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

async function piJudgeComplete(prompt: string, ctx: ExtensionContext): Promise<string> {
	const model = ctx.model ?? ctx.modelRegistry.getAvailable()[0];
	if (!model) throw new Error("no model is available for the scope judge");

	const stream = ctx.modelRegistry.streamSimple(
		model,
		{
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: prompt }],
					timestamp: Date.now(),
				},
			],
		},
		{ maxTokens: 1_000, reasoning: "low" },
	);
	let text = "";
	for await (const event of stream) {
		if (event.type === "text_delta") text += event.delta;
		if (event.type === "error") throw new Error(event.error.errorMessage);
	}
	return text;
}

export function workflowCodeGuardrailCreate(
	judgeComplete: PiJudgeComplete = piJudgeComplete,
): (pi: ExtensionAPI) => void {
	return function workflowCodeGuardrailRegister(pi: ExtensionAPI): void {
		const sessions = new Map<string, SessionGuardrailState>();

		function sessionGet(ctx: ExtensionContext): SessionGuardrailState {
			const sessionId = ctx.sessionManager.getSessionId();
			const existing = sessions.get(sessionId);
			if (existing) return existing;

			const created: SessionGuardrailState = {
				changes: [],
				completionCorrectionSent: false,
				conversationContext: [],
				cycle: workflowCodeStateCreate(),
				judgeCache: new Map(),
				objective: "",
				previousFeedback: [],
			};
			sessions.set(sessionId, created);
			return created;
		}

		async function judgeRun(
			session: SessionGuardrailState,
			ctx: ExtensionContext,
			request: WorkflowCodeJudgeRequest,
		): Promise<WorkflowCodeJudgeOutcome> {
			const key = JSON.stringify(request);
			const cached = session.judgeCache.get(key);
			if (cached) return cached;

			const outcome = await workflowCodeJudgeRun(request, (prompt) =>
				judgeComplete(prompt, ctx),
			);
			session.judgeCache.set(key, outcome);
			if (outcome.verdict === "unavailable") {
				ctx.ui.notify(outcome.summary, "warning");
			}
			return outcome;
		}

		function requestBuild(
			session: SessionGuardrailState,
			milestone: WorkflowCodeJudgeRequest["milestone"],
			test?: WorkflowCodeTestEvidence,
		): WorkflowCodeJudgeRequest {
			return {
				milestone,
				objective: session.objective,
				conversationContext: session.conversationContext,
				changes: session.changes,
				test,
				previousFeedback: session.previousFeedback,
			};
		}

		pi.registerCommand("tdd-skip", {
			description: "Disable the TDD guardrail for the next request",
			handler: async (_args, ctx) => {
				const session = sessionGet(ctx);
				session.skipNext = true;
				ctx.ui.notify("TDD guardrail disabled for the next request.", "info");
			},
		});

		pi.on("input", (event, ctx) => {
			if (
				event.source === "extension" ||
				event.streamingBehavior !== undefined ||
				guardrailDisabled()
			) return;

			const session = sessionGet(ctx);
			session.changes = [];
			session.completionCorrectionSent = false;
			session.conversationContext = conversationContextBuild(ctx);
			session.cycle = session.skipNext
				? workflowCodeStateSkip(workflowCodeStateCreate())
				: workflowCodeStateCreate();
			session.judgeCache.clear();
			session.objective = event.text;
			session.previousFeedback = [];
			session.skipNext = false;
		});

		pi.on(
			"tool_call",
			(event: ToolCallEvent, ctx: ExtensionContext): ToolCallEventResult | void => {
				if (guardrailDisabled()) return;
				const change = changeBuild(event);
				if (!change) return;

				const session = sessionGet(ctx);
				const decision = workflowCodeWriteEvaluate(session.cycle, change.path);
				session.cycle = decision.state;
				if (decision.block) return { block: true, reason: decision.reason };
				session.changes.push(change);
			},
		);

		pi.on(
			"tool_result",
			async (
				event: ToolResultEvent,
				ctx: ExtensionContext,
			): Promise<ToolResultEventResult | void> => {
				if (guardrailDisabled() || event.toolName !== "bash") return;
				const test = testEvidenceBuild(event);
				if (!workflowCodeTestCommandIsRecognized(test.command)) return;

				const session = sessionGet(ctx);
				const milestone = event.isError
					? session.cycle.phase === "locked" || session.cycle.phase === "red"
						? "red"
						: undefined
					: session.cycle.phase === "code-changed"
						? "green"
						: undefined;

				if (!milestone) {
					session.cycle = workflowCodeTestResultApply(
						session.cycle,
						test.command,
						event.isError,
					);
					return;
				}

				const outcome = await judgeRun(
					session,
					ctx,
					requestBuild(session, milestone, test),
				);
				if (outcome.verdict !== "revise") {
					session.cycle = workflowCodeTestResultApply(
						session.cycle,
						test.command,
						event.isError,
					);
					return;
				}

				const feedback = judgeFeedbackBuild(outcome);
				session.previousFeedback.push(feedback);
				return {
					content: [...event.content, { type: "text", text: feedback }],
				};
			},
		);

		pi.on("agent_before_settle", async (_event, ctx) => {
			if (guardrailDisabled()) return;

			const session = sessionGet(ctx);
			const completion = workflowCodeCompletionEvaluate(session.cycle);
			session.cycle = completion.state;
			if (completion.remind) {
				return {
					entries: [
						{
							type: "custom_message" as const,
							customType: "workflow-code-guardrail",
							content: GREEN_REMINDER,
							display: false,
						},
					],
					continue: true,
				};
			}

			const sourceChanged = session.changes.some(
				(change) => workflowCodePathClassify(change.path) === "source",
			);
			if (!sourceChanged || session.completionCorrectionSent) return;

			const outcome = await judgeRun(
				session,
				ctx,
				requestBuild(session, "completion"),
			);
			if (outcome.verdict !== "revise") return;

			const feedback = judgeFeedbackBuild(outcome);
			session.previousFeedback.push(feedback);
			session.completionCorrectionSent = true;
			return {
				entries: [
					{
						type: "custom_message" as const,
						customType: "workflow-code-judge",
						content: feedback,
						display: false,
					},
				],
				continue: true,
			};
		});
	};
}

export default workflowCodeGuardrailCreate();

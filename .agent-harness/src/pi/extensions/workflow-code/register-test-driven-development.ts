import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import {
	workflowCodeCompletionEvaluate,
	workflowCodeStateCreate,
	workflowCodeStateSkip,
	workflowCodeTestCommandIsRecognized,
	workflowCodeTestResultApply,
	workflowCodeWriteEvaluate,
} from "#agent-harness/core/guardrails/skills/coding/enforce-test-driven-development";
import type { WorkflowCodeState } from "#agent-harness/core/guardrails/skills/coding/workflow-code-contracts";

const GREEN_REMINDER =
	"TDD guardrail: run a relevant test and confirm it passes.";
const RED_ESTABLISHED = "TDD guardrail: red";
const GREEN_ESTABLISHED = "TDD guardrail: green";

interface SessionTddState {
	cycle: WorkflowCodeState;
	pendingPaths: Map<string, string>;
	skipNext?: boolean;
}

function guardrailDisabled(): boolean {
	return (
		process.env.AGENT_HARNESS_GUARDRAIL_OFF === "1" ||
		process.env.PI_GUARDRAIL_OFF === "1"
	);
}

export function testDrivenDevelopmentEnforcementCreate(): (pi: ExtensionAPI) => void {
	return function testDrivenDevelopmentEnforcementRegister(pi: ExtensionAPI): void {
		const sessions = new Map<string, SessionTddState>();

		function sessionGet(ctx: ExtensionContext): SessionTddState {
			const sessionId = ctx.sessionManager.getSessionId();
			const existing = sessions.get(sessionId);
			if (existing) return existing;

			const created = {
				cycle: workflowCodeStateCreate(),
				pendingPaths: new Map<string, string>(),
			};
			sessions.set(sessionId, created);
			return created;
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
			session.cycle = session.skipNext
				? workflowCodeStateSkip(workflowCodeStateCreate())
				: workflowCodeStateCreate();
			session.pendingPaths.clear();
			session.skipNext = false;
		});

		pi.on(
			"tool_call",
			(event: ToolCallEvent, ctx: ExtensionContext): ToolCallEventResult | void => {
				if (guardrailDisabled()) return;
				if (event.toolName !== "edit" && event.toolName !== "write") return;

				const path = String((event.input as { path?: string }).path ?? "");
				const session = sessionGet(ctx);
				const decision = workflowCodeWriteEvaluate(session.cycle, path);
				if (decision.block) return { block: true, reason: decision.reason };
				session.pendingPaths.set(event.toolCallId, path);
			},
		);

		pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext) => {
			if (guardrailDisabled()) return;
			const session = sessionGet(ctx);

			if (event.toolName === "edit" || event.toolName === "write") {
				const path = session.pendingPaths.get(event.toolCallId);
				session.pendingPaths.delete(event.toolCallId);
				if (!path || event.isError) return;
				session.cycle = workflowCodeWriteEvaluate(session.cycle, path).state;
				return;
			}

			if (event.toolName !== "bash") return;
			const command = String((event.input as { command?: string }).command ?? "");
			if (!workflowCodeTestCommandIsRecognized(command)) return;
			const previousPhase = session.cycle.phase;
			session.cycle = workflowCodeTestResultApply(session.cycle, command, event.isError);
			if (previousPhase !== "red" && session.cycle.phase === "red") {
				ctx.ui.notify(RED_ESTABLISHED, "info");
			}
			if (previousPhase !== "green" && session.cycle.phase === "green") {
				ctx.ui.notify(GREEN_ESTABLISHED, "info");
			}
		});

		pi.on("agent_before_settle", (_event, ctx) => {
			if (guardrailDisabled()) return;

			const session = sessionGet(ctx);
			const completion = workflowCodeCompletionEvaluate(session.cycle);
			session.cycle = completion.state;
			if (!completion.remind) return;

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
		});
	};
}

export default testDrivenDevelopmentEnforcementCreate();

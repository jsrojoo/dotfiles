import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	sqlCommandExecutes,
	sqlCommandMutates,
} from "#agent-harness/core/guardrails/sql-validation/classify-sql";
import {
	type SqlValidationState,
	sqlValidationCompletionEvaluate,
	sqlValidationProofRecord,
	sqlValidationStateCreate,
} from "#agent-harness/core/guardrails/sql-validation/require-validation-proof";

const REMINDER =
	"SQL validation required. Read `~/.agents/skills/workflow-code/references/database-sql-workflow.md`. " +
	"Run a successful read-only SELECT ... WHERE probe through the same driver before presenting " +
	"data-targeting SQL; never execute mutative SQL or DDL as agent. Then resend the complete answer.";

function assistantMessageIs(message: AgentMessage): message is AssistantMessage {
	return message.role === "assistant" && Array.isArray(message.content);
}

function assistantTextExtract(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

export default function sqlValidationEnforcementRegister(pi: ExtensionAPI): void {
	const sessions = new Map<string, SqlValidationState>();

	function sessionGet(ctx: ExtensionContext): SqlValidationState {
		return sessions.get(ctx.sessionManager.getSessionId()) ?? sqlValidationStateCreate();
	}

	function sessionSet(ctx: ExtensionContext, state: SqlValidationState): void {
		sessions.set(ctx.sessionManager.getSessionId(), state);
	}

	pi.on("input", (event, ctx) => {
		if (event.source === "extension" || event.streamingBehavior !== undefined) return;
		sessionSet(ctx, sqlValidationStateCreate());
	});

	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const command = String((event.input as { command?: string }).command ?? "");
		if (!sqlCommandExecutes(command) || !sqlCommandMutates(command)) return;
		return {
			block: true,
			reason:
				"SQL guardrail: the agent cannot execute mutative SQL or DDL. Prepare exact SQL for user execution after SELECT ... WHERE validation.",
		};
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.toolName !== "bash") return;
		const command = String((event.input as { command?: string }).command ?? "");
		const output = event.content
			.filter((block): block is TextContent => block.type === "text")
			.map((block) => block.text)
			.join("\n");
		sessionSet(
			ctx,
			sqlValidationProofRecord(sessionGet(ctx), command, output, event.isError),
		);
	});

	pi.on("turn_end", (event, ctx) => {
		if (ctx.mode === "print" || ctx.mode === "json") return;
		const message = event.message;
		if (!assistantMessageIs(message) || message.stopReason !== "stop") return;
		if (message.content.some((block) => block.type === "toolCall")) return;

		const decision = sqlValidationCompletionEvaluate(
			sessionGet(ctx),
			assistantTextExtract(message),
		);
		sessionSet(ctx, decision.state);
		if (!decision.correct) return;

		return {
			entries: [
				{
					type: "custom_message" as const,
					customType: "require-sql-validation",
					content: REMINDER,
					display: false,
				},
			],
			continue: true,
		};
	});
}

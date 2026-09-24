import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mutativeSqlExecutionEvaluate } from "#agent-harness/core/guardrails/sql/block-mutative-sql";

export default function mutativeSqlBlockingRegister(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const command = String((event.input as { command?: string }).command ?? "");
		const decision = mutativeSqlExecutionEvaluate(command);
		if (decision.block) return decision;
	});
}

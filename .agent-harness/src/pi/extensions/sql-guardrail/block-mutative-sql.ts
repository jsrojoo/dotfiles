import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	sqlCommandExecutes,
	sqlCommandMutates,
} from "#agent-harness/core/guardrails/sql-guardrail/classify-sql";

export default function mutativeSqlBlockingRegister(pi: ExtensionAPI): void {
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
}

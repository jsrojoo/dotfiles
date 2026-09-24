/**
 * SQL guard rail.
 *
 * Blocks obvious agent-executed writes/DDL and requires a successful read-only
 * SELECT ... WHERE probe before presenting SQL that targets data.
 * Detection is intentionally heuristic: dynamic SQL is unverified, not trusted.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SQL_EXECUTION_RE = /(?:\bpsql\b|\bsqlcmd\b|\bmysql\b|\bsqlite3\b|\bpython(?:3)?\b|\bpoetry\s+run\s+python\b|\bexecute\s*\(|\.execute\s*\(|\balembic\s+(?:upgrade|downgrade)\b)/i;
const WRITE_RE = /\b(?:insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema|database)|create\s+(?:table|schema|database|index)|drop\s+(?:table|schema|database|index)|truncate\s+(?:table\s+)?\w+|alembic\s+(?:upgrade|downgrade))\b/i;
const SELECT_PROBE_RE = /\bselect\b[\s\S]*\bwhere\b/i;
const SQL_TEXT_RE = /\b(?:select\b[\s\S]*\bfrom\b|insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema)|create\s+(?:table|schema)|drop\s+(?:table|schema)|truncate\s+)/i;
const SQL_LINE_RE = /^[ \t]*(?:select\s+[\w.*\",()]+\s+from\s+[\w.\"-]+|insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema)|create\s+(?:table|schema)|drop\s+(?:table|schema)|truncate\s+)/im;
const SQL_FENCE_RE = /```sql[^\S\r\n]*\r?\n([\s\S]*?)```/gi;

const REMINDER =
	"SQL validation required. Read `~/.agents/skills/references/database-sql-workflow.md`. " +
	"Run a successful read-only SELECT ... WHERE probe through the same driver before presenting " +
	"data-targeting SQL; never execute mutative SQL or DDL as agent. Then resend the complete answer.";

function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
	return message.role === "assistant" && Array.isArray(message.content);
}

function textOf(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

function isSqlExecutionCommand(command: string): boolean {
	if (!SQL_EXECUTION_RE.test(command)) return false;
	return !/^\s*(?:grep|rg|find|cat|echo|printf|head|tail)\b/i.test(command);
}

function hasMutativeSql(command: string): boolean {
	return WRITE_RE.test(command);
}

function hasValidationProof(text: string): boolean {
	return SELECT_PROBE_RE.test(text);
}

function finalAnswerNeedsProof(text: string): boolean {
	if (SQL_LINE_RE.test(text)) return true;
	return Array.from(text.matchAll(SQL_FENCE_RE)).some((match) =>
		SQL_TEXT_RE.test(match[1]),
	);
}

export default function requireSqlValidation(pi: ExtensionAPI): void {
	let validationProof = false;
	let retried = false;

	pi.on("agent_start", async () => {
		validationProof = false;
	});

	pi.on("input", async (event) => {
		if (event.source !== "extension") {
			validationProof = false;
			retried = false;
		}
	});

	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") return;
		const command = String(event.input?.command ?? "");
		if (!isSqlExecutionCommand(command) || !hasMutativeSql(command)) return;
		return {
			block: true,
			reason:
				"SQL guard: agent cannot execute mutative SQL or DDL. Prepare exact SQL for user execution after SELECT ... WHERE validation.",
		};
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName !== "bash" || event.isError) return;
		const command = String(event.input?.command ?? "");
		if (!isSqlExecutionCommand(command) || hasMutativeSql(command)) return;
		const output = event.content
			.filter((block): block is TextContent => block.type === "text")
			.map((block) => block.text)
			.join("\n");
		if (hasValidationProof(command) && output.trim()) validationProof = true;
	});

	pi.on("turn_end", async (event, ctx) => {
		if (ctx.mode === "print" || ctx.mode === "json" || retried) return;
		const message = event.message;
		if (!isAssistantMessage(message) || message.stopReason !== "stop") return;
		if (message.content.some((block) => block.type === "toolCall")) return;
		const text = textOf(message);
		if (!finalAnswerNeedsProof(text) || validationProof) return;
		retried = true;
		return {
			entries: [{ type: "custom_message", customType: "require-sql-validation", content: REMINDER, display: false }],
			continue: true,
		};
	});
}

export { finalAnswerNeedsProof, hasMutativeSql, hasValidationProof, isSqlExecutionCommand };

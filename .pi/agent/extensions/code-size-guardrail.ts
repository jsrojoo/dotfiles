/**
 * Code size guardrail.
 *
 * Enforces a per-call output token budget on edit/write tool calls when
 * PI_CODE_TOKEN_BUDGET is set (set by the subagent runner via maxOutputTokens
 * on any agent, e.g. workflow_code). No-op otherwise, so the main session
 * and other subagents are unaffected.
 *
 * Two parts:
 *   1. before_agent_start: injects a guideline announcing the budget up
 *      front, so the model writes small the first time instead of relying on
 *      trial and error against the reactive block below.
 *   2. tool_call: blocks oversized edit/write calls after the fact, as a
 *      backstop for whatever the first part did not prevent.
 *
 * Token estimate: chars/4, a standard rough heuristic, not a real tokenizer.
 * ponytail: good enough to force small diffs, swap for a real tokenizer if
 * false blocks on dense code become a problem.
 */

import type {
	BeforeAgentStartEvent,
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function newContentSize(event: ToolCallEvent): number {
	if (event.toolName === "write") return estimateTokens(event.input.content);
	if (event.toolName === "edit") {
		return event.input.edits.reduce((sum, e) => sum + estimateTokens(e.newText), 0);
	}
	return 0;
}

function readBudget(): number | undefined {
	const budget = Number(process.env.PI_CODE_TOKEN_BUDGET);
	return budget && !Number.isNaN(budget) ? budget : undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event: BeforeAgentStartEvent, _ctx: ExtensionContext) => {
		const budget = readBudget();
		if (!budget) return;

		event.systemPromptOptions.promptGuidelines.push(
			`Hard limit: every write/edit call is capped at ~${budget} tokens of new content (about ${budget * 4} characters, roughly ${Math.max(1, Math.round(budget / 12))}-${Math.max(2, Math.round(budget / 6))} short lines). This is enforced and oversized calls are rejected before executing.\n` +
				"Before writing anything, list the small units the task needs (one function each) and the exact tool-call sequence you will use. Do not draft the full file content first and then trim it.\n" +
				"For one file with multiple functions: `write` the file with only the first function, then use separate `edit` calls to append each remaining function one at a time (`oldText` = end of previous function, `newText` = next function). Do not put more than one function in a single `write` or a single `edit` block.\n" +
				`Example for 3 functions in one file: write(fn1) -> edit(append fn2) -> edit(append fn3). That is 3 calls, each under ~${budget} tokens, not 1 call with all 3.`,
		);
	});

	pi.on("tool_call", (event: ToolCallEvent, _ctx: ExtensionContext): ToolCallEventResult | void => {
		const budget = readBudget();
		if (!budget) return;
		if (event.toolName !== "edit" && event.toolName !== "write") return;

		const size = newContentSize(event);
		if (size <= budget) return;

		return {
			block: true,
			reason: `New content is ~${size} tokens, over the ${budget}-token budget for this agent. Cut this specific call down to one function or one small edit, then make a separate call for the rest.`,
		};
	});
}


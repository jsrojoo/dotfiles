/**
 * Require Termaid Plan Extension
 *
 * Enforces that any "Plan:" response includes a termaid render
 * (bash call containing "termaid" and "--ascii") during the same agent run,
 * shown under "Before", "After", and "What changed" headings, each pasted verbatim
 * from a captured termaid render output (hand-redrawn diagrams fail).
 * If missing, turn_end injects a hidden reminder and forces one continuation turn.
 * Never mask or replace streamed assistant text: failed masking caused stuck placeholder output.
 *
 * Uses turn_end so the continuation stays inside the same agent run.
 * Skipped in print/json modes: their prompt() resolves before extension
 * continuations finish, truncating output (and breaking `pi -p` subagents).
 * Caps at one retry per run to avoid loops.
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PLAN_HEADER_RE = /^[#*\s]*Plan:/m;
const TERMAID_RE = /termaid[\s\S]*--ascii/i;
const SECTION_NAMES = ["Before", "After", "What changed"];
const REQUIRED_RENDERS = SECTION_NAMES.length;

// Heading must be the whole line ("## Before", "**Before**", "Before:"), followed by a
// fenced code block (the rendered diagram), so prose like "After approval, ..." never counts.
// Returns the fenced block body, or undefined when the section is missing.
function diagramSection(text: string, name: string): string | undefined {
	const match = new RegExp(
		`^[#*\\s]*${name}[*:\\s]*\\n(?:[^\\S\\n]*\\n)*[^\\S\\n]*\`\`\`[^\\n]*\\n([\\s\\S]*?)^[^\\S\\n]*\`\`\``,
		"im",
	).exec(text);
	return match?.[1];
}

// Compare renders ignoring trailing whitespace and blank edge lines.
function normalizeRender(text: string): string {
	return text.split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

// Each section's diagram must be pasted from a real termaid render, not redrawn by hand.
function sectionsMatchRenders(text: string, renders: string[]): boolean {
	return SECTION_NAMES.every((name) => {
		const body = normalizeRender(diagramSection(text, name) ?? "");
		return body.length > 0 && renders.some((render) => render.includes(body));
	});
}

// Rule text lives in the termaid skill; keep this pointer-only.
const REMINDER =
	"Plan response is missing the required termaid diagrams. Read the `Planning Requirement` section of " +
	"~/.agents/skills/termaid/SKILL.md, follow it, then resend the full Plan response.";

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

function getText(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

function hasToolCalls(message: AssistantMessage): boolean {
	return message.content.some((block) => block.type === "toolCall");
}

export default function requireTermaidPlan(pi: ExtensionAPI): void {
	let termaidRenders = 0;
	let renderOutputs: string[] = [];
	let retried = false;

	pi.on("agent_start", async () => {
		termaidRenders = 0;
		renderOutputs = [];
	});

	// Reset only for a new user request. Continuation agent_start events must retain retry state.
	pi.on("input", async (event) => {
		if (event.source !== "extension") {
			retried = false;
			termaidRenders = 0;
			renderOutputs = [];
		}
	});

	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") return;
		if (TERMAID_RE.test(String(event.input?.command ?? ""))) termaidRenders++;
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName !== "bash" || event.isError) return;
		if (!TERMAID_RE.test(String(event.input?.command ?? ""))) return;
		const output = event.content
			.filter((block): block is TextContent => block.type === "text")
			.map((block) => block.text)
			.join("\n");
		renderOutputs.push(normalizeRender(output));
	});

	pi.on("turn_end", async (event, ctx) => {
		if (ctx.mode === "print" || ctx.mode === "json") return;
		if (retried) return;
		const message = event.message;
		// Judge only completed final answers, not intermediate tool-use turns or aborts.
		if (!isAssistantMessage(message) || message.stopReason !== "stop" || hasToolCalls(message)) return;
		const text = getText(message);
		if (!PLAN_HEADER_RE.test(text)) return;
		if (termaidRenders >= REQUIRED_RENDERS && sectionsMatchRenders(text, renderOutputs)) return;

		retried = true;
		return {
			entries: [
				{
					type: "custom_message",
					customType: "require-termaid-plan",
					content: REMINDER,
					display: false,
				},
			],
			continue: true,
		};
	});
}

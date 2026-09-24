/**
 * Workflow guardrail (deterministic phase, replaces the LLM-judge version).
 *
 * Rule PIPELINE (bash tool): reject commands that chain independent steps
 * with top-level `&&`, `;`, or `||`. A single pipe chain (`a | b`) is allowed
 * since that IS the sanctioned "pipe result to next command" pattern.
 * Heuristic: split on top-level control operators outside quotes/parens/backticks;
 * this is regex-based, not a full shell parser.
 *
 * Rule TDD (edit/write tools, source code files only): require a failing
 * test run (red) recorded earlier in this session before allowing a write to
 * a source file. Detected via bash tool_result events matching known
 * test-runner commands and a non-zero exit code. Scoped to CODE_FILE_PATTERN
 * (common source extensions) so config, data, docs, and lockfiles (e.g.
 * settings.json, a .env change, a README edit) are not gated: those are not
 * a code-logic workflow and have no meaningful "failing test" to write.
 *
 * Rule ROOT_SCAN (bash tool): reject unscoped filesystem-wide scans rooted
 * at `/` (e.g. `find / -iname ...`, `grep -r ... /`) since these hang for
 * minutes on macOS crawling every mounted volume. Scope the search first.
 *
 * Derived from tdd-pipeline-log.jsonl collected by the earlier LLM-judge
 * version (see workflow-guardrail-llm.ts, now retired). All logged verdicts
 * for the pipeline rule matched simple compound-operator detection; no
 * edit/write calls were exercised, so the TDD rule below is a direct
 * translation of the originally-specified rule rather than data-mined.
 *
 * Kill switch: set PI_GUARDRAIL_OFF=1 to bypass all rules.
 */

import type {
	BashToolResultEvent,
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

const TEST_FILE_PATTERN = /(^|[\\/])(test_[^\\/]+|[^\\/]+\.(test|spec)\.[a-z0-9]+|[^\\/]+_test\.[a-z0-9]+)$/i;
// Only these extensions count as "code" for the TDD rule. Config (json/yaml/toml/env/ini),
// docs (md/txt), and other non-logic files are exempt: no meaningful test to write for them.
const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|c|cc|cpp|h|hpp|cs|php|swift|scala|sh|bash)$/i;
const TEST_RUNNER_PATTERN = /\b(pytest|jest|vitest|mocha|go test|cargo test|npm test|npm run test|yarn test|pnpm test|rspec|phpunit)\b/i;
// Matches find/grep/ls with a bare `/` as a standalone path argument, not part of a longer path.
const ROOT_SCAN_PATTERN = /\b(find|grep|ls)\b[^&|;]*(?:^|\s)\/(?:\s|$)/;

// ponytail: state is per-process, not persisted across pi restarts. Good enough
// for a single working session; upgrade to appendEntry-backed state if that matters.
const redConfirmedBySession = new Map<string, boolean>();

/** Split a bash command on top-level &&, ||, ; while skipping quoted/backtick/paren regions. */
function splitTopLevelChain(command: string): string[] {
	const segments: string[] = [];
	let current = "";
	let i = 0;
	let quote: '"' | "'" | undefined;
	let depth = 0;

	while (i < command.length) {
		const ch = command[i];
		const next2 = command.slice(i, i + 2);

		if (quote) {
			current += ch;
			if (ch === quote && command[i - 1] !== "\\") quote = undefined;
			i += 1;
			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			i += 1;
			continue;
		}

		if (ch === "(" || ch === "{") {
			depth += 1;
			current += ch;
			i += 1;
			continue;
		}
		if (ch === ")" || ch === "}") {
			depth = Math.max(0, depth - 1);
			current += ch;
			i += 1;
			continue;
		}

		if (depth === 0 && (next2 === "&&" || next2 === "||")) {
			segments.push(current);
			current = "";
			i += 2;
			continue;
		}
		if (depth === 0 && ch === ";") {
			segments.push(current);
			current = "";
			i += 1;
			continue;
		}

		current += ch;
		i += 1;
	}
	segments.push(current);
	return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

function checkRootScanRule(command: string): ToolCallEventResult | void {
	if (!ROOT_SCAN_PATTERN.test(command)) return;

	return {
		block: true,
		reason:
			"Command scans the filesystem root (/) unscoped, which can hang for minutes crawling every mounted volume. " +
			"Scope the search to a specific directory instead (e.g. the project root or a known path).",
	};
}

function checkPipelineRule(command: string): ToolCallEventResult | void {
	const segments = splitTopLevelChain(command);
	if (segments.length <= 1) return;

	return {
		block: true,
		reason:
			`Command chains ${segments.length} independent steps with &&/;/||: ${segments.map((s) => `"${s}"`).join(", ")}. ` +
			"Run one step at a time as separate bash calls (a single `|` pipe chain is fine), inspect each result, then issue the next command.",
	};
}

function checkTddRule(ctx: ExtensionContext, path: string): ToolCallEventResult | void {
	if (!CODE_FILE_PATTERN.test(path)) return; // not a source file; config/docs/data are exempt
	if (TEST_FILE_PATTERN.test(path)) return; // always allow test file writes

	const sessionId = ctx.sessionManager.getSessionId();
	if (redConfirmedBySession.get(sessionId)) return;

	return {
		block: true,
		reason:
			`Blocked write to "${path}": no failing test recorded yet in this session. ` +
			"Write a failing test first, run it to confirm red, then edit this file.",
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event: ToolCallEvent, ctx: ExtensionContext): ToolCallEventResult | void => {
		if (process.env.PI_GUARDRAIL_OFF === "1") return;

		if (event.toolName === "bash") {
			return checkRootScanRule(event.input.command) ?? checkPipelineRule(event.input.command);
		}

		if (event.toolName === "edit" || event.toolName === "write") {
			return checkTddRule(ctx, event.input.path);
		}
	});

	pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext) => {
		if (process.env.PI_GUARDRAIL_OFF === "1") return;
		if (event.toolName !== "bash") return;

		const bashEvent = event as BashToolResultEvent;
		const command = String((bashEvent.input as { command?: string }).command ?? "");
		if (!TEST_RUNNER_PATTERN.test(command)) return;

		const sessionId = ctx.sessionManager.getSessionId();
		// isError on the bash tool result reflects a non-zero exit code from the test runner.
		redConfirmedBySession.set(sessionId, bashEvent.isError === true);
	});
}

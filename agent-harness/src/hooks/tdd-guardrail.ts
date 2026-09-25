import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	workflowCodeCompletionEvaluate,
	workflowCodeStateCreate,
	workflowCodeStateSkip,
	workflowCodeTestCommandIsRecognized,
	workflowCodeTestResultApply,
	workflowCodeWriteEvaluate,
} from "#agent-harness/core/guardrails/skills/coding/enforce-test-driven-development";
import type { WorkflowCodeState } from "#agent-harness/core/guardrails/skills/coding/coding-contracts";

export type TddHookHost = "claude" | "codex";

export interface TddHookEvent {
	eventName: string;
	sessionId: string;
	prompt?: string;
	toolName?: string;
	toolId?: string;
	toolInput?: Record<string, unknown>;
	toolResponse?: unknown;
	toolFailed?: boolean;
}

interface TddSessionState {
	cycle: WorkflowCodeState;
	pendingPaths: Record<string, string[]>;
	skipNext: boolean;
}

const GREEN_REMINDER = "TDD guardrail: Add or update a relevant test, then run it and confirm it passes before finishing.";
const IMPLEMENTATION_TOOLS_CLAUDE = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const IMPLEMENTATION_TOOLS_CODEX = new Set(["apply_patch", "write_file", "edit_file"]);

function stateCreate(): TddSessionState {
	return { cycle: workflowCodeStateCreate(), pendingPaths: {}, skipNext: false };
}

function statePath(host: TddHookHost, sessionId: string, directory?: string): string {
	const sessionHash = createHash("sha256").update(sessionId).digest("hex");
	const root = directory ?? process.env.AGENT_HARNESS_TDD_STATE_DIR ?? join(homedir(), ".agent-harness", "tdd");
	return join(root, host, `${sessionHash}.json`);
}

function stateRead(filePath: string): TddSessionState {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<TddSessionState>;
		if (
			parsed.cycle &&
			["locked", "red", "code-changed", "green", "skipped"].includes(parsed.cycle.phase) &&
			parsed.pendingPaths &&
			typeof parsed.pendingPaths === "object"
		) {
			return {
				cycle: { ...parsed.cycle, testChanged: parsed.cycle.testChanged === true },
				pendingPaths: parsed.pendingPaths,
				skipNext: parsed.skipNext === true,
			};
		}
		return stateCreate();
	} catch (error) {
		if ((error as { code?: string }).code === "ENOENT" || error instanceof SyntaxError) return stateCreate();
		throw error;
	}
}

function stateWrite(filePath: string, state: TddSessionState): void {
	// ponytail: atomic replace, concurrent hooks for one session can race; add per-session locking if hosts dispatch them in parallel.
	mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
	const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(state), { mode: 0o600 });
	renameSync(temporaryPath, filePath);
}

function inputPath(input: Record<string, unknown>): string[] {
	const path = input.file_path ?? input.path;
	return typeof path === "string" && path.length > 0 ? [path] : [];
}

function codexPatchPaths(input: Record<string, unknown>): string[] {
	const patch = String(input.patch ?? input.input ?? "");
	const paths = new Set<string>();
	for (const match of patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)) {
		paths.add(match[1].trim());
	}
	for (const match of patch.matchAll(/^(?:\+\+\+ b\/|--- a\/)(.+)$/gm)) {
		paths.add(match[1].trim());
	}
	return [...paths];
}

function implementationPaths(
	host: TddHookHost,
	toolName: string,
	input: Record<string, unknown>,
): string[] {
	if (host === "claude") {
		return IMPLEMENTATION_TOOLS_CLAUDE.has(toolName) ? inputPath(input) : [];
	}
	if (toolName === "apply_patch") return codexPatchPaths(input);
	return IMPLEMENTATION_TOOLS_CODEX.has(toolName) ? inputPath(input) : [];
}

function testCommand(
	host: TddHookHost,
	toolName: string,
	input: Record<string, unknown>,
): string | undefined {
	const isShellTool = host === "claude"
		? toolName === "Bash"
		: toolName === "exec_command" || toolName === "Bash";
	if (!isShellTool) return undefined;
	const command = input.command ?? input.cmd;
	if (typeof command === "string") return command;
	if (Array.isArray(command)) return command.filter((part) => typeof part === "string").join(" ");
	return undefined;
}

function resultFailed(response: unknown): boolean {
	if (response && typeof response === "object") {
		const result = response as Record<string, unknown>;
		if (result.isError === true || result.is_error === true || result.error) return true;
		const exitCode = result.exit_code ?? result.exitCode;
		if (typeof exitCode === "number") return exitCode !== 0;
		if (typeof result.status === "string" && /^(?:failed|error)$/i.test(result.status)) return true;
	}
	const output = typeof response === "string" ? response : JSON.stringify(response ?? "");
	return /\b(?:exit code|exit status)\s*[:=]?\s*[1-9]\d*\b/i.test(output) ||
		/\bexited with (?:code|status)\s*[:=]?\s*[1-9]\d*\b/i.test(output);
}

function resultBlock(
	host: TddHookHost,
	eventName: string,
	reason: string,
): Record<string, unknown> {
	if (eventName === "Stop") return { decision: "block", reason };
	if (host === "claude") {
		return {
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: reason,
			},
		};
	}
	return { decision: "block", reason };
}

export function tddGuardrailHandle(
	host: TddHookHost,
	event: TddHookEvent,
	directory?: string,
): Record<string, unknown> | undefined {
	if (process.env.AGENT_HARNESS_GUARDRAIL_OFF === "1") return undefined;

	const filePath = statePath(host, event.sessionId, directory);
	const state = stateRead(filePath);

	if (event.eventName === "UserPromptSubmit") {
		if (/^\/tdd-skip\s*$/i.test(event.prompt?.trim() ?? "")) {
			state.skipNext = true;
		} else {
			state.cycle = state.skipNext
				? workflowCodeStateSkip(workflowCodeStateCreate())
				: workflowCodeStateCreate();
			state.pendingPaths = {};
			state.skipNext = false;
		}
		stateWrite(filePath, state);
		return undefined;
	}

	if (event.eventName === "PreToolUse") {
		const paths = implementationPaths(host, event.toolName ?? "", event.toolInput ?? {});
		for (const path of paths) {
			const decision = workflowCodeWriteEvaluate(state.cycle, path);
			if (decision.block) {
				return resultBlock(
					host,
					event.eventName,
					decision.reason ?? "TDD guardrail blocked implementation-code change.",
				);
			}
		}
		if (event.toolId && paths.length > 0) {
			state.pendingPaths[event.toolId] = paths;
			stateWrite(filePath, state);
		}
		return undefined;
	}

	if (event.eventName === "PostToolUse" || event.eventName === "PostToolUseFailure") {
		const toolId = event.toolId ?? "";
		const paths = state.pendingPaths[toolId] ?? [];
		delete state.pendingPaths[toolId];
		if (!event.toolFailed) {
			for (const path of paths) state.cycle = workflowCodeWriteEvaluate(state.cycle, path).state;
		}

		const command = testCommand(host, event.toolName ?? "", event.toolInput ?? {});
		if (command && workflowCodeTestCommandIsRecognized(command)) {
			state.cycle = workflowCodeTestResultApply(
				state.cycle,
				command,
				event.toolFailed === true || resultFailed(event.toolResponse),
			);
		}
		stateWrite(filePath, state);
		return undefined;
	}

	if (event.eventName === "Stop") {
		const completion = workflowCodeCompletionEvaluate(state.cycle);
		state.cycle = completion.state;
		stateWrite(filePath, state);
		return completion.remind ? resultBlock(host, "Stop", GREEN_REMINDER) : undefined;
	}

	return undefined;
}

function hookCliRun(
	host: TddHookHost,
	handler: (payload: Record<string, unknown>) => Record<string, unknown> | undefined,
	moduleUrl: string,
): void {
	if (!process.argv[1] || pathToFileURL(realpathSync(resolve(process.argv[1]))).href !== moduleUrl) return;
	try {
		const payload = JSON.parse(readFileSync(0, "utf8")) as Record<string, unknown>;
		const event = host === "claude" ? claudeEventNormalize(payload) : codexEventNormalize(payload);
		const response = handler(event);
		if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
	} catch (error) {
		process.stderr.write(`TDD hook failed: ${String(error)}\n`);
		process.exitCode = 1;
	}
}

function claudeEventNormalize(payload: Record<string, unknown>): Record<string, unknown> {
	return {
		eventName: payload.hook_event_name,
		sessionId: payload.session_id,
		prompt: payload.prompt,
		toolName: payload.tool_name,
		toolId: payload.tool_use_id,
		toolInput: payload.tool_input,
		toolResponse: payload.tool_response,
		toolFailed: payload.hook_event_name === "PostToolUseFailure",
	};
}

function codexEventNormalize(payload: Record<string, unknown>): Record<string, unknown> {
	return {
		eventName: payload.hook_event_name,
		sessionId: payload.session_id,
		prompt: payload.prompt,
		toolName: payload.tool_name,
		toolId: payload.tool_use_id,
		toolInput: payload.tool_input,
		toolResponse: payload.tool_response,
		toolFailed: false,
	};
}

export function tddHookCliRun(host: TddHookHost, moduleUrl: string): void {
	hookCliRun(
		host,
		(payload) => tddGuardrailHandle(host, payload as unknown as TddHookEvent),
		moduleUrl,
	);
}


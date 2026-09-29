/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports three modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *   - Chain: { chain: [{ agent: "name", task: "... {previous} ..." }, ...] }
 *
 * Uses RPC mode to capture structured output from subagents.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	type ExtensionContext,
	getAgentDir,
	getMarkdownTheme,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";
import { subagentDisplayLabelBuild } from "./display-label.ts";
import { subagentModelCandidatesBuild, subagentModelFallbackRun } from "./model-selector.ts";
import { ChildRunError, runChild } from "./run-child.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;

const COLLAPSED_ITEM_COUNT = 10;
const PER_TASK_OUTPUT_CAP = 50 * 1024;
const MAX_LIFECYCLE_MESSAGES = 50;
const MAX_SETTLED_LIFECYCLE_ENTRIES = 50;
const MAX_WIDGET_ENTRIES = 3;
const TRANSCRIPT_LINE_WIDTH = 88;

// Child pi runs skip extension discovery and load only local user extensions.
// Why: package extensions (pi-patty-bg-tasks replaces `bash` with an unref'd
// detached spawn) can let child processes exit mid tool call, so children returned no output.
// "subagent" is excluded so children cannot spawn nested subagents.
// ponytail: local files only; package extensions are dropped for children, add an allowlist if one is needed.
function childExtensionArgs(selected: string[] | undefined, cwd: string): string[] {
	const dir = path.join(getAgentDir(), "extensions");
	const args = ["-ne"];
	if (selected !== undefined) {
		for (const name of selected) {
			const candidates = name === "subagent"
				? [path.dirname(fileURLToPath(import.meta.url))]
				: path.isAbsolute(name) || name.includes(path.sep)
					? [path.resolve(cwd, name)]
					: [path.join(dir, `${name}.ts`), path.join(dir, `${name}.js`), path.join(dir, name)];
			args.push("-e", candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]);
		}
		return args;
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return args;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
			args.push("-e", full);
		} else if (entry.isDirectory() && entry.name !== "subagent") {
			const index = ["index.ts", "index.js"].map((f) => path.join(full, f)).find((f) => fs.existsSync(f));
			if (index) args.push("-e", index);
		}
	}
	return args;
}

function childSkillArgs(selected: string[] | undefined, cwd: string): string[] {
	if (selected === undefined) return [];

	const args = ["-ns"];
	for (const name of selected) {
		const candidates = path.isAbsolute(name) || name.includes(path.sep)
			? [path.resolve(cwd, name)]
			: [
				path.join(cwd, ".agents", "skills", name),
				path.join(cwd, CONFIG_DIR_NAME, "skills", name),
				path.join(os.homedir(), ".agents", "skills", name),
				path.join(getAgentDir(), "skills", name),
			];
		args.push("--skill", candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]);
	}
	return args;
}

function formatResponseDuration(milliseconds: number): string {
	if (!Number.isFinite(milliseconds) || milliseconds < 0) {
		throw new RangeError("Response duration must be finite non-negative milliseconds");
	}
	if (milliseconds > 0 && milliseconds < 100) return "<0.1s";
	return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function elapsedText(milliseconds: number): string {
	return formatResponseDuration(milliseconds);
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatToolCall(
	toolName: string,
	args: Record<string, unknown>,
	themeFg: (color: any, text: string) => string,
): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const offset = args.offset as number | undefined;
			const limit = args.limit as number | undefined;
			let text = themeFg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return themeFg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return (
				themeFg("muted", "grep ") +
				themeFg("accent", `/${pattern}/`) +
				themeFg("dim", ` in ${shortenPath(rawPath)}`)
			);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	agent: string;
	displayLabel: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
	elapsedMs: number;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
	parallelElapsedMs?: number;
}

type LifecycleState = "running" | "settled" | "aborted" | "error";

interface LifecycleEntry {
	id: string;
	agent: string;
	task: string;
	state: LifecycleState;
	startedAt: number;
	updatedAt: number;
	settledAt?: number;
	latestActivity: string;
	messages: Message[];
	result?: SingleResult;
	send?: (message: string) => boolean;
	abort?: () => void;
}

interface LifecycleRuntime {
	send: (message: string) => boolean;
	abort: () => void;
}

interface LifecycleCallbacks {
	onStart: (agent: string, task: string) => string;
	onRuntime: (id: string, runtime: LifecycleRuntime | undefined) => void;
	onActivity: (id: string, activity: string, message?: Message) => void;
	onSettled: (id: string, result: SingleResult) => void;
	onError: (id: string, error: unknown) => void;
}

function lifecycleEntriesSort(entries: Iterable<LifecycleEntry>): LifecycleEntry[] {
	return Array.from(entries).sort((a, b) => {
		if (a.state === "running" && b.state !== "running") return -1;
		if (a.state !== "running" && b.state === "running") return 1;
		return b.updatedAt - a.updatedAt;
	});
}

function pruneLifecycleEntries(entries: Map<string, LifecycleEntry>): void {
	const expired = Array.from(entries.values())
		.filter((entry) => entry.state !== "running")
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(MAX_SETTLED_LIFECYCLE_ENTRIES);
	for (const entry of expired) entries.delete(entry.id);
}

function compactTranscriptValue(value: unknown): string {
	let text: string;
	if (typeof value === "string") text = value;
	else {
		try {
			text = JSON.stringify(value) ?? String(value);
		} catch {
			text = String(value);
		}
	}
	return text.replace(/\s+/g, " ").trim() || "(empty)";
}

function compactTranscriptLine(label: string, value: unknown): string {
	return truncateToWidth(`${label}: ${compactTranscriptValue(value)}`, TRANSCRIPT_LINE_WIDTH);
}

function renderLifecycleStatusSummary(entry: LifecycleEntry): string {
	return `[${entry.state}] ${entry.id} ${entry.agent}: ${compactTranscriptValue(entry.latestActivity)}`;
}

function requestLifecycleStop(entry: LifecycleEntry): string | undefined {
	if (entry.state !== "running") return `Subagent ${entry.id} is already ${entry.state}.`;
	if (!entry.abort) return `Subagent ${entry.id} is running but its stop callback is not ready.`;
	entry.abort();
	entry.latestActivity = "stopping";
	entry.updatedAt = Date.now();
	return undefined;
}

function renderLifecycleTranscript(entry: LifecycleEntry): string {
	const lines = [
		compactTranscriptLine("Agent ID", entry.id),
		compactTranscriptLine("Agent", entry.agent),
		compactTranscriptLine("Task", entry.task),
		compactTranscriptLine("State", entry.state),
		compactTranscriptLine("Started", new Date(entry.startedAt).toISOString()),
		compactTranscriptLine("Updated", new Date(entry.updatedAt).toISOString()),
		compactTranscriptLine("Settled", entry.settledAt ? new Date(entry.settledAt).toISOString() : "(not settled)"),
		compactTranscriptLine("Latest activity", entry.latestActivity),
	];
	if (entry.result) {
		lines.push(compactTranscriptLine("Exit code", entry.result.exitCode));
		lines.push(compactTranscriptLine("Stop reason", entry.result.stopReason ?? "(none)"));
		lines.push(compactTranscriptLine("Model", entry.result.model ?? "(unknown)"));
	}
	const contentCounts = { assistant: 0, thinking: 0, toolCall: 0, toolResult: 0 };
	const messages = entry.result?.messages ?? entry.messages;
	for (const message of messages) {
		const rawMessage = message as any;
		if (rawMessage.role === "assistant") {
			for (const part of rawMessage.content ?? []) {
				if (part.type === "text") {
					lines.push(compactTranscriptLine("Assistant", part.text));
					contentCounts.assistant++;
				} else if (part.type === "thinking") {
					lines.push(compactTranscriptLine("Thinking", part.thinking));
					contentCounts.thinking++;
				} else if (part.type === "toolCall") {
					lines.push(compactTranscriptLine("Tool call", `${part.name} ${compactTranscriptValue(part.arguments)}`));
					contentCounts.toolCall++;
				}
			}
		} else if (rawMessage.role === "toolResult") {
			const resultText = (rawMessage.content ?? [])
				.filter((part: any) => part.type === "text")
				.map((part: any) => part.text)
				.join(" ");
			lines.push(
				compactTranscriptLine(
					"Tool result",
					`${rawMessage.toolName ?? rawMessage.toolCallId ?? "tool"} ${compactTranscriptValue(resultText)}`,
				),
			);
			contentCounts.toolResult++;
		}
	}
	if (contentCounts.assistant === 0) lines.push("Assistant: (none yet)");
	if (contentCounts.thinking === 0) lines.push("Thinking: (none)");
	if (contentCounts.toolCall === 0) lines.push("Tool call: (none)");
	if (contentCounts.toolResult === 0) lines.push("Tool result: (none)");
	const detail =
		entry.state === "aborted" || entry.state === "error"
			? entry.result?.errorMessage || entry.result?.stderr || entry.latestActivity
			: "(none)";
	lines.push(compactTranscriptLine("Error/abort detail", detail));
	if (entry.state !== "running") lines.push("Continuation unavailable: this subagent has finished.");
	return lines.join("\n");
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

function isFailedResult(result: SingleResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

function getPartialOutput(messages: Message[]): string {
	const parts: string[] = [];
	for (const msg of messages) {
		if (msg.role !== "assistant" && msg.role !== "toolResult") continue;
		if (typeof msg.content === "string") parts.push(msg.content);
		else {
			for (const part of msg.content) {
				if (part.type === "text") parts.push(part.text);
			}
		}
	}
	return parts.filter(Boolean).join("\n\n");
}

function getResultOutput(result: SingleResult): string {
	if (isFailedResult(result)) {
		return [result.errorMessage || result.stderr, getPartialOutput(result.messages)].filter(Boolean).join("\n\n") || "(no output)";
	}
	return getFinalOutput(result.messages) || "(no output)";
}

function truncateParallelOutput(output: string): string {
	const byteLength = Buffer.byteLength(output, "utf8");
	if (byteLength <= PER_TASK_OUTPUT_CAP) return output;

	let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
	while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
		truncated = truncated.slice(0, -1);
	}
	return `${truncated}\n\n[Output truncated: ${byteLength - Buffer.byteLength(truncated, "utf8")} bytes omitted. Full output preserved in tool details.]`;
}

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") items.push({ type: "text", text: part.text });
				else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
			}
		}
	}
	return items;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	});
	return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

interface DispatchDefaults {
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

async function runSingleAgentAttempt(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	agent: AgentConfig,
	model: string | undefined,
	task: string,
	purpose: string | undefined,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
	lifecycle: LifecycleCallbacks | undefined,
	lifecycleId: string | undefined,
): Promise<SingleResult> {
	const childCwd = cwd ?? defaultCwd;
	const args: string[] = [
		"--mode",
		"rpc",
		"--no-session",
		...childExtensionArgs(agent.extensions, childCwd),
		...childSkillArgs(agent.skills, childCwd),
	];
	if (model) args.push("--model", model);
	if (dispatchDefaults.thinkingLevel) {
		args.push("--thinking", dispatchDefaults.thinkingLevel);
	}
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const currentResult: SingleResult = {
		agent: agent.name,
		displayLabel: subagentDisplayLabelBuild(agent.name, purpose),
		agentSource: agent.source,
		task,
		exitCode: 0,
		messages: [],
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model,
		step,
		elapsedMs: 0,
	};

	const emitUpdate = (elapsedMs?: number) => {
		if (elapsedMs !== undefined) currentResult.elapsedMs = elapsedMs;
		if (onUpdate) {
			onUpdate({
				content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
				details: makeDetails([currentResult]),
			});
		}
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		let wasAborted = false;
		const invocation = getPiInvocation(args);
		const proc = spawn(invocation.command, invocation.args, {
			cwd: childCwd,
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
			env: process.env,
		});
		const watchdogAbortController = new AbortController();
		const decoder = new StringDecoder("utf8");
		let buffer = "";
		let stdoutEnded = false;
		let logicallySettled = false;
		let runChildSettled = false;
		let abortEscalationTimer: ReturnType<typeof setTimeout> | undefined;

		const failRpc = (error: unknown) => {
			if (runChildSettled || watchdogAbortController.signal.aborted) return;
			currentResult.stopReason = "error";
			currentResult.errorMessage = error instanceof Error ? error.message : String(error);
			if (lifecycleId) lifecycle?.onActivity(lifecycleId, `error: ${currentResult.errorMessage}`);
			watchdogAbortController.abort(error);
		};
		const handleStdinError = (error: unknown) => failRpc(error);

		const writeRpcCommand = (command: Record<string, unknown>): boolean => {
			if (!proc.stdin.writable || proc.stdin.destroyed) {
				failRpc(`Unable to write ${String(command.type)} RPC command`);
				return false;
			}
			try {
				proc.stdin.write(`${JSON.stringify(command)}\n`, (error) => {
					if (error) failRpc(error);
				});
				return true;
			} catch (error) {
				failRpc(error);
				return false;
			}
		};

		const processLine = (line: string) => {
			if (!line.trim()) return;
			let event: any;
			try {
				event = JSON.parse(line);
			} catch (error) {
				failRpc(new Error(`Malformed RPC JSONL: ${error instanceof Error ? error.message : String(error)}`));
				return;
			}

			if (event.type === "response" && event.success === false) {
				failRpc(event.error || `RPC command ${event.command || "unknown"} failed`);
				return;
			}

			if (event.type === "tool_execution_start") {
				const toolName = event.toolCall?.name || event.toolName || event.name || "tool";
				if (lifecycleId) lifecycle?.onActivity(lifecycleId, `tool: ${toolName}`);
			}

			if (event.type === "tool_execution_end") {
				const toolName = event.toolCall?.name || event.toolName || event.name || "tool";
				const failed = Boolean(event.isError || event.result?.isError || event.error);
				if (lifecycleId)
					lifecycle?.onActivity(lifecycleId, failed ? `tool error: ${toolName}` : `tool done: ${toolName}`);
			}

			if (event.type === "message_end" && event.message) {
				const msg = event.message as Message;
				currentResult.messages.push(msg);
				if (lifecycleId) lifecycle?.onActivity(lifecycleId, `message: ${msg.role}`, msg);

				if (msg.role === "assistant") {
					currentResult.usage.turns++;
					const usage = msg.usage;
					if (usage) {
						currentResult.usage.input += usage.input || 0;
						currentResult.usage.output += usage.output || 0;
						currentResult.usage.cacheRead += usage.cacheRead || 0;
						currentResult.usage.cacheWrite += usage.cacheWrite || 0;
						currentResult.usage.cost += usage.cost?.total || 0;
						currentResult.usage.contextTokens = usage.totalTokens || 0;
					}
					if (!currentResult.model && msg.model) currentResult.model = msg.model;
					if (msg.stopReason) currentResult.stopReason = msg.stopReason;
					if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
				}
				emitUpdate();
			}

			if (event.type === "agent_settled") {
				logicallySettled = true;
				if (!proc.stdin.destroyed) proc.stdin.end();
			}
		};

		const processStdoutText = (text: string) => {
			buffer += text;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) processLine(line);
		};

		const flushStdout = () => {
			if (stdoutEnded) return;
			stdoutEnded = true;
			processStdoutText(decoder.end());
			if (buffer.trim()) processLine(buffer);
			buffer = "";
		};

		proc.stdout.on("data", (data) => {
			processStdoutText(decoder.write(data));
		});
		proc.stdout.once("end", flushStdout);
		proc.stderr.on("data", (data) => {
			currentResult.stderr += data.toString();
		});
		proc.stdin.on("error", handleStdinError);

		const abortProc = () => {
			if (wasAborted || logicallySettled) return;
			wasAborted = true;
			if (!writeRpcCommand({ id: "abort", type: "abort" })) {
				watchdogAbortController.abort(signal?.reason);
				return;
			}
			abortEscalationTimer = setTimeout(() => watchdogAbortController.abort(signal?.reason), 5000);
		};
		if (lifecycleId) {
			lifecycle?.onRuntime(lifecycleId, {
				send: (message) => writeRpcCommand({ id: `steer-${randomUUID()}`, type: "steer", message }),
				abort: abortProc,
			});
		}

		const promptCommand = { id: "prompt", type: "prompt", message: `Task: ${task}` };
		writeRpcCommand(promptCommand);
		if (signal) {
			if (signal.aborted) abortProc();
			else signal.addEventListener("abort", abortProc, { once: true });
		}

		try {
			const outcome = await runChild(proc, {
				signal: watchdogAbortController.signal,
				onHeartbeat: emitUpdate,
				onTimeout(diagnostic, elapsedMs) {
					currentResult.elapsedMs = elapsedMs;
					currentResult.exitCode = 1;
					currentResult.stopReason = "timeout";
					currentResult.errorMessage = diagnostic;
					emitUpdate(elapsedMs);
				},
			});
			runChildSettled = true;
			flushStdout();
			currentResult.elapsedMs = outcome.elapsedMs;
			if (wasAborted) {
				currentResult.exitCode = outcome.exitCode === 0 ? 1 : (outcome.exitCode ?? 1);
				currentResult.stopReason = "aborted";
				currentResult.errorMessage = "Subagent was aborted";
			} else if (!logicallySettled) {
				currentResult.exitCode = outcome.exitCode && outcome.exitCode !== 0 ? outcome.exitCode : 1;
				currentResult.stopReason = "error";
				currentResult.errorMessage ||= "Subagent exited before agent_settled";
			} else {
				currentResult.exitCode = currentResult.stopReason === "error" ? 1 : (outcome.exitCode ?? 0);
			}
		} catch (error) {
			runChildSettled = true;
			if (!(error instanceof ChildRunError)) throw error;
			currentResult.elapsedMs = error.elapsedMs;
			currentResult.exitCode = 1;
			if (error.kind === "timeout") {
				currentResult.stopReason = "timeout";
				currentResult.errorMessage = error.diagnostic ?? error.message;
			} else if (error.kind === "aborted" && wasAborted) {
				currentResult.stopReason = "aborted";
				currentResult.errorMessage = "Subagent was aborted";
			} else {
				currentResult.stopReason = "error";
				currentResult.errorMessage ||= error.diagnostic ?? error.message;
			}
		} finally {
			if (signal) signal.removeEventListener("abort", abortProc);
			if (abortEscalationTimer) clearTimeout(abortEscalationTimer);
			proc.stdin.removeListener("error", handleStdinError);
		}
		return currentResult;
	} finally {
		if (lifecycleId) lifecycle?.onRuntime(lifecycleId, undefined);
		if (tmpPromptPath)
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				/* ignore */
			}
		if (tmpPromptDir)
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				/* ignore */
			}
	}
}

async function runSingleAgent(
	defaultCwd: string,
	dispatchDefaults: DispatchDefaults,
	agents: AgentConfig[],
	agentName: string,
	task: string,
	purpose: string | undefined,
	cwd: string | undefined,
	step: number | undefined,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
	lifecycle?: LifecycleCallbacks,
): Promise<SingleResult> {
	const agent = agents.find((candidate) => candidate.name === agentName);
	if (!agent) {
		const available = agents.map((candidate) => `"${candidate.name}"`).join(", ") || "none";
		return {
			agent: agentName,
			displayLabel: subagentDisplayLabelBuild(agentName, purpose),
			agentSource: "unknown",
			task,
			exitCode: 1,
			messages: [],
			stderr: `Unknown agent: "${agentName}". Available agents: ${available}.`,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			step,
			elapsedMs: 0,
		};
	}

	let models: Array<string | undefined>;
	try {
		models = subagentModelCandidatesBuild(agent, dispatchDefaults.model);
	} catch (error) {
		return {
			agent: agentName,
			displayLabel: subagentDisplayLabelBuild(agentName, purpose),
			agentSource: agent.source,
			task,
			exitCode: 1,
			messages: [],
			stderr: String(error),
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			step,
			elapsedMs: 0,
		};
	}

	const lifecycleId = lifecycle?.onStart(agentName, task);
	let stopRequested = signal?.aborted ?? false;
	const lifecycleAbortController = new AbortController();
	const attemptSignal = signal
		? AbortSignal.any([signal, lifecycleAbortController.signal])
		: lifecycleAbortController.signal;
	let activeSend: ((message: string) => boolean) | undefined;
	const requestStop = () => {
		stopRequested = true;
		lifecycleAbortController.abort();
	};
	const persistentRuntime: LifecycleRuntime = {
		send: (message) => activeSend?.(message) ?? false,
		abort: requestStop,
	};
	const attemptLifecycle =
		lifecycle && lifecycleId
			? {
					...lifecycle,
					onRuntime(id: string, runtime: LifecycleRuntime | undefined) {
						activeSend = runtime?.send;
						lifecycle.onRuntime(id, persistentRuntime);
					},
				}
			: lifecycle;
	if (lifecycleId) lifecycle?.onRuntime(lifecycleId, persistentRuntime);

	const createAbortedResult = (model: string | undefined): SingleResult => ({
		agent: agentName,
		displayLabel: subagentDisplayLabelBuild(agentName, purpose),
		agentSource: agent.source,
		task,
		exitCode: 1,
		messages: [],
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model,
		stopReason: "aborted",
		errorMessage: "Subagent was aborted",
		step,
		elapsedMs: 0,
	});

	try {
		const result = await subagentModelFallbackRun(
			models,
			async (model) => {
				if (stopRequested || signal?.aborted) return createAbortedResult(model);
				return runSingleAgentAttempt(
					defaultCwd,
					dispatchDefaults,
					agent,
					model,
					task,
					purpose,
					cwd,
					step,
					attemptSignal,
					onUpdate,
					makeDetails,
					attemptLifecycle,
					lifecycleId,
				);
			},
			(result) => isFailedResult(result) && result.stopReason !== "timeout" && result.stopReason !== "aborted",
		);
		if (lifecycleId) lifecycle?.onSettled(lifecycleId, result);
		return result;
	} catch (error) {
		if (lifecycleId) lifecycle?.onError(lifecycleId, error);
		throw error;
	}
}

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	purpose: Type.Optional(Type.String({ description: "Short display purpose for this invocation" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	purpose: Type.Optional(Type.String({ description: "Short display purpose for this invocation" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	purpose: Type.Optional(Type.String({ description: "Short display purpose for the single invocation" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

const SubagentStatusParams = Type.Object({
	agentId: Type.Optional(Type.String({ description: "Stable subagent ID for full lifecycle details" })),
});

const SubagentStopParams = Type.Object({
	agentId: Type.String({ description: "Stable ID of the running subagent to stop" }),
});

export default function (pi: ExtensionAPI) {
	const lifecycleEntries = new Map<string, LifecycleEntry>();

	const updateLifecycleWidget = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		const labels: Record<LifecycleState, string> = {
			running: "RUN",
			settled: "DONE",
			aborted: "ABORT",
			error: "ERROR",
		};
		const lines = lifecycleEntriesSort(lifecycleEntries.values())
			.slice(0, MAX_WIDGET_ENTRIES)
			.map((entry) =>
				truncateToWidth(
					`[${labels[entry.state]}] ${entry.id} ${entry.agent}: ${compactTranscriptValue(entry.latestActivity)}`,
					TRANSCRIPT_LINE_WIDTH,
				),
			);
		ctx.ui.setWidget("subagent-lifecycle", lines.length > 0 ? lines : undefined);
	};

	pi.on("session_start", (_event, ctx) => {
		lifecycleEntries.clear();
		if (ctx.mode === "tui") ctx.ui.setWidget("subagent-lifecycle", undefined);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		for (const entry of lifecycleEntries.values()) {
			if (entry.state === "running") entry.abort?.();
		}
		lifecycleEntries.clear();
		if (ctx.mode === "tui") ctx.ui.setWidget("subagent-lifecycle", undefined);
	});

	pi.registerCommand("agents", {
		description: "View and control subagent invocations",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/agents is available only in TUI mode", "warning");
				return;
			}
			const entries = lifecycleEntriesSort(lifecycleEntries.values());
			if (entries.length === 0) {
				ctx.ui.notify("No subagent invocations in this session", "info");
				return;
			}
			const optionToId = new Map<string, string>();
			for (const entry of entries) {
				const option = `${truncateToWidth(
					`[${entry.state}] ${entry.agent}: ${entry.task}`,
					TRANSCRIPT_LINE_WIDTH,
				)} (${entry.id})`;
				optionToId.set(option, entry.id);
			}
			const selected = await ctx.ui.select("Subagents", Array.from(optionToId.keys()));
			if (!selected) return;
			const entry = lifecycleEntries.get(optionToId.get(selected) ?? "");
			if (!entry) {
				ctx.ui.notify("That subagent is no longer available", "warning");
				return;
			}

			ctx.ui.notify(renderLifecycleTranscript(entry));
			const actions = entry.state === "running" ? ["Steer", "Stop", "Close"] : ["Close"];
			const action = await ctx.ui.select("Subagent action", actions);
			if (!action) return;
			if (action === "Close") {
				updateLifecycleWidget(ctx);
				return;
			}

			if (action === "Steer") {
				const message = await ctx.ui.input("Steer subagent", "Additional instruction");
				if (!message?.trim()) return;
				if (entry.state !== "running" || !entry.send || !entry.send(message.trim())) {
					ctx.ui.notify("Unable to steer this subagent", "error");
				} else {
					entry.latestActivity = `steered: ${compactTranscriptValue(message)}`;
					entry.updatedAt = Date.now();
					ctx.ui.notify("Steering message sent", "info");
				}
			} else if (action === "Stop") {
				const error = requestLifecycleStop(entry);
				ctx.ui.notify(error ?? "Stop requested", error ? "error" : "info");
			}
			pruneLifecycleEntries(lifecycleEntries);
			updateLifecycleWidget(ctx);
		},
	});

	pi.registerTool({
		name: "subagent_status",
		label: "Subagent Status",
		description: "List running and recent subagents, or inspect one by its stable ID.",
		parameters: SubagentStatusParams,
		async execute(_toolCallId, params) {
			if (params.agentId) {
				const entry = lifecycleEntries.get(params.agentId);
				if (!entry) {
					return {
						content: [{ type: "text", text: `Unknown subagent ID: ${params.agentId}` }],
						isError: true,
					};
				}
				return { content: [{ type: "text", text: renderLifecycleTranscript(entry) }] };
			}

			const entries = lifecycleEntriesSort(lifecycleEntries.values());
			return {
				content: [
					{
						type: "text",
						text: entries.length > 0
							? entries.map(renderLifecycleStatusSummary).join("\n")
							: "No running or recent subagents.",
					},
				],
			};
		},
	});

	pi.registerTool({
		name: "subagent_stop",
		label: "Stop Subagent",
		description: "Request that a running subagent stop through its RPC abort path.",
		parameters: SubagentStopParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const entry = lifecycleEntries.get(params.agentId);
			if (!entry) {
				return {
					content: [{ type: "text", text: `Unknown subagent ID: ${params.agentId}` }],
					isError: true,
				};
			}
			const error = requestLifecycleStop(entry);
			if (error) return { content: [{ type: "text", text: error }], isError: true };
			updateLifecycleWidget(ctx);
			return { content: [{ type: "text", text: `Stop requested for subagent ${entry.id}.` }] };
		},
	});

	const initAgents = discoverAgents(process.cwd(), "user", undefined).agents;
	const agentList = initAgents.length > 0
		? `Available agents: ${initAgents.map((a) => `${a.name} (${a.description})`).join("; ")}.`
		: "";

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder).",
			"Set optional purpose to render an invocation as agent: purpose without changing agent lookup.",
			`Default agent scope is "user" (from ${path.join(getAgentDir(), "agents")}).`,
			`To enable project-local agents in ${CONFIG_DIR_NAME}/agents, set agentScope: "both" (or "project").`,
			agentList,
		].filter(Boolean).join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const lifecycle: LifecycleCallbacks = {
				onStart(agent, task) {
					const now = Date.now();
					const entry: LifecycleEntry = {
						id: randomUUID(),
						agent,
						task,
						state: "running",
						startedAt: now,
						updatedAt: now,
						latestActivity: "starting",
						messages: [],
					};
					lifecycleEntries.set(entry.id, entry);
					updateLifecycleWidget(ctx);
					return entry.id;
				},
				onRuntime(id, runtime) {
					const entry = lifecycleEntries.get(id);
					if (!entry) return;
					entry.send = runtime?.send;
					entry.abort = runtime?.abort;
					updateLifecycleWidget(ctx);
				},
				onActivity(id, activity, message) {
					const entry = lifecycleEntries.get(id);
					if (!entry) return;
					entry.latestActivity = activity;
					entry.updatedAt = Date.now();
					if (message) {
						entry.messages.push(message);
						entry.messages = entry.messages.slice(-MAX_LIFECYCLE_MESSAGES);
					}
					updateLifecycleWidget(ctx);
				},
				onSettled(id, result) {
					const entry = lifecycleEntries.get(id);
					if (!entry) return;
					entry.result = result;
					entry.state = result.stopReason === "aborted" ? "aborted" : isFailedResult(result) ? "error" : "settled";
					entry.latestActivity = entry.state;
					entry.updatedAt = Date.now();
					entry.settledAt = entry.updatedAt;
					entry.send = undefined;
					entry.abort = undefined;
					pruneLifecycleEntries(lifecycleEntries);
					updateLifecycleWidget(ctx);
				},
				onError(id, error) {
					const entry = lifecycleEntries.get(id);
					if (!entry) return;
					entry.state = "error";
					entry.latestActivity = `error: ${error instanceof Error ? error.message : String(error)}`;
					entry.updatedAt = Date.now();
					entry.settledAt = entry.updatedAt;
					entry.send = undefined;
					entry.abort = undefined;
					pruneLifecycleEntries(lifecycleEntries);
					updateLifecycleWidget(ctx);
				},
			};

			const agentScope: AgentScope = params.agentScope ?? "user";
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
			};
			const discovery = discoverAgents(ctx.cwd, agentScope, ctx.model?.provider);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);
			const parallelTasks = params.tasks;

			const makeDetails =
				(mode: "single" | "parallel" | "chain") =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			if (
				(agentScope === "project" || agentScope === "both") &&
				confirmProjectAgents &&
				ctx.hasUI &&
				!ctx.isProjectTrusted()
			) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			if (params.chain && params.chain.length > 0) {
				const results: SingleResult[] = [];
				let previousOutput = "";

				for (let i = 0; i < params.chain.length; i++) {
					const step = params.chain[i];
					const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

					// Create update callback that includes all previous results
					const chainUpdate: OnUpdateCallback | undefined = onUpdate
						? (partial) => {
								// Combine completed results with current streaming result
								const currentResult = partial.details?.results[0];
								if (currentResult) {
									const allResults = [...results, currentResult];
									onUpdate({
										content: partial.content,
										details: makeDetails("chain")(allResults),
									});
								}
							}
						: undefined;

					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						step.agent,
						taskWithContext,
						step.purpose,
						step.cwd,
						i + 1,
						signal,
						chainUpdate,
						makeDetails("chain"),
						lifecycle,
					);
					results.push(result);

					const isError = isFailedResult(result);
					if (isError) {
						const errorMsg = getResultOutput(result);
						return {
							content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}` }],
							details: makeDetails("chain")(results),
							isError: true,
						};
					}
					previousOutput = getFinalOutput(result.messages);
				}
				return {
					content: [{ type: "text", text: getFinalOutput(results[results.length - 1].messages) || "(no output)" }],
					details: makeDetails("chain")(results),
				};
			}

			if (parallelTasks && parallelTasks.length > 0) {
				if (parallelTasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${parallelTasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				const parallelStartedAt = performance.now();
				let parallelCompletedAt: number | undefined;
				const makeParallelDetails = (results: SingleResult[]): SubagentDetails => ({
					...makeDetails("parallel")(results),
					parallelElapsedMs: (parallelCompletedAt ?? performance.now()) - parallelStartedAt,
				});

				// Track all results for streaming updates
				const allResults: SingleResult[] = new Array(parallelTasks.length);

				// Initialize placeholder results
				for (let i = 0; i < parallelTasks.length; i++) {
					allResults[i] = {
						agent: parallelTasks[i].agent,
						displayLabel: subagentDisplayLabelBuild(parallelTasks[i].agent, parallelTasks[i].purpose),
						agentSource: "unknown",
						task: parallelTasks[i].task,
						exitCode: -1, // -1 = still running
						messages: [],
						stderr: "",
						usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
						elapsedMs: 0,
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === -1).length;
						const done = allResults.filter((r) => r.exitCode !== -1).length;
						onUpdate({
							content: [
								{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` },
							],
							details: makeParallelDetails([...allResults]),
						});
					}
				};

				const results = await mapWithConcurrencyLimit(parallelTasks, MAX_CONCURRENCY, async (t, index) => {
					const result = await runSingleAgent(
						ctx.cwd,
						dispatchDefaults,
						agents,
						t.agent,
						t.task,
						t.purpose,
						t.cwd,
						undefined,
						signal,
						// Per-task update callback
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeParallelDetails,
						lifecycle,
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});
				parallelCompletedAt = performance.now();

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const hasFailures = results.some(isFailedResult);
				const summaries = results.map((r) => {
					const output = truncateParallelOutput(getResultOutput(r));
					const status = isFailedResult(r)
						? `failed${r.stopReason && r.stopReason !== "end" ? ` (${r.stopReason})` : ""}`
						: "completed";
					return `### [${r.displayLabel}] ${status}\n\n${output}`;
				});
				return {
					content: [
						{
							type: "text",
							text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
						},
					],
					details: makeParallelDetails(results),
					isError: hasFailures,
				};
			}

			if (params.agent && params.task) {
				const result = await runSingleAgent(
					ctx.cwd,
					dispatchDefaults,
					agents,
					params.agent,
					params.task,
					params.purpose,
					params.cwd,
					undefined,
					signal,
					onUpdate,
					makeDetails("single"),
					lifecycle,
				);
				const isError = isFailedResult(result);
				if (isError) {
					const errorMsg = getResultOutput(result);
					return {
						content: [{ type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` }],
						details: makeDetails("single")([result]),
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }],
					details: makeDetails("single")([result]),
				};
			}

			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme, _context) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					// Clean up {previous} placeholder for display
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text +=
						"\n  " +
						theme.fg("muted", `${i + 1}.`) +
						" " +
						theme.fg("accent", subagentDisplayLabelBuild(step.agent, step.purpose)) +
						theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", subagentDisplayLabelBuild(t.agent, t.purpose))}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const displayLabel = subagentDisplayLabelBuild(agentName, args.purpose);
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text =
				theme.fg("toolTitle", theme.bold("subagent ")) +
				theme.fg("accent", displayLabel) +
				theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
				const toShow = limit ? items.slice(-limit) : items;
				const skipped = limit && items.length > limit ? items.length - limit : 0;
				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
				for (const item of toShow) {
					if (item.type === "text") {
						const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
						text += `${theme.fg("toolOutput", preview)}\n`;
					} else {
						text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
					}
				}
				return text.trimEnd();
			};

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const isError = isFailedResult(r);
				const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const displayItems = getDisplayItems(r.messages);
				const finalOutput = getFinalOutput(r.messages);

				if (expanded) {
					const container = new Container();
					let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.displayLabel))}${theme.fg("muted", ` (${r.agentSource})`)}`;
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage)
						container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
					if (displayItems.length === 0 && !finalOutput) {
						container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
					} else {
						for (const item of displayItems) {
							if (item.type === "toolCall")
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
						}
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}
					}
					const usageStr = [elapsedText(r.elapsedMs), formatUsageStats(r.usage, r.model)].filter(Boolean).join(" ");
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.displayLabel))}${theme.fg("muted", ` (${r.agentSource})`)}`;
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
				else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
				else {
					text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
					if (displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				}
				const usageStr = [elapsedText(r.elapsedMs), formatUsageStats(r.usage, r.model)].filter(Boolean).join(" ");
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			const aggregateUsage = (results: SingleResult[]) => {
				const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
				for (const r of results) {
					total.input += r.usage.input;
					total.output += r.usage.output;
					total.cacheRead += r.usage.cacheRead;
					total.cacheWrite += r.usage.cacheWrite;
					total.cost += r.usage.cost;
					total.turns += r.usage.turns;
				}
				return total;
			};

			if (details.mode === "chain") {
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

				if (expanded) {
					const container = new Container();
					container.addChild(
						new Text(
							icon +
								" " +
								theme.fg("toolTitle", theme.bold("chain ")) +
								theme.fg("accent", `${successCount}/${details.results.length} steps`),
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(
								`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.displayLabel)} ${rIcon}`,
								0,
								0,
							),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const stepUsage = [elapsedText(r.elapsedMs), formatUsageStats(r.usage, r.model)].filter(Boolean).join(" ");
						if (stepUsage) container.addChild(new Text(theme.fg("dim", stepUsage), 0, 0));
					}

					const totalElapsedMs = details.results.reduce((total, r) => total + r.elapsedMs, 0);
					const usageStr = [elapsedText(totalElapsedMs), formatUsageStats(aggregateUsage(details.results))]
						.filter(Boolean)
						.join(" ");
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view
				let text =
					icon +
					" " +
					theme.fg("toolTitle", theme.bold("chain ")) +
					theme.fg("accent", `${successCount}/${details.results.length} steps`);
				for (const r of details.results) {
					const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.displayLabel)} ${rIcon}`;
					if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				const totalElapsedMs = details.results.reduce((total, r) => total + r.elapsedMs, 0);
				const usageStr = [elapsedText(totalElapsedMs), formatUsageStats(aggregateUsage(details.results))]
					.filter(Boolean)
					.join(" ");
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel") {
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const successCount = details.results.filter((r) => r.exitCode !== -1 && !isFailedResult(r)).length;
				const failCount = details.results.filter((r) => r.exitCode !== -1 && isFailedResult(r)).length;
				const isRunning = running > 0;
				const icon = isRunning
					? theme.fg("warning", "⏳")
					: failCount > 0
						? theme.fg("warning", "◐")
						: theme.fg("success", "✓");
				const status = isRunning
					? `${successCount + failCount}/${details.results.length} done, ${running} running`
					: `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(
						new Text(
							`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`,
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.displayLabel)} ${rIcon}`, 0, 0),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						// Show tool calls
						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						// Show final output as markdown
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const taskUsage = [elapsedText(r.elapsedMs), formatUsageStats(r.usage, r.model)].filter(Boolean).join(" ");
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}

					const usageStr = [
						elapsedText(details.parallelElapsedMs ?? 0),
						formatUsageStats(aggregateUsage(details.results)),
					]
						.filter(Boolean)
						.join(" ");
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				// Collapsed view (or still running)
				let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					const rIcon =
						r.exitCode === -1
							? theme.fg("warning", "⏳")
							: isFailedResult(r)
								? theme.fg("error", "✗")
								: theme.fg("success", "✓");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.displayLabel)} ${rIcon}`;
					if (displayItems.length === 0)
						text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				if (!isRunning) {
					const usageStr = [
						elapsedText(details.parallelElapsedMs ?? 0),
						formatUsageStats(aggregateUsage(details.results)),
					]
						.filter(Boolean)
						.join(" ");
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});
}

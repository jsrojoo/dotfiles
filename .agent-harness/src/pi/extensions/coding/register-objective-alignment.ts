import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	closeSync,
	lstatSync,
	openSync,
	readlinkSync,
	readSync,
} from "node:fs";
import { resolve } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
	ToolResultEventResult,
} from "@earendil-works/pi-coding-agent";
import { workflowCodeJudgeRun } from "#agent-harness/core/guardrails/skills/coding/objective-alignment/llm";
import {
	objectiveAlignmentChangeEvaluate,
	objectiveAlignmentChangeRecord,
	objectiveAlignmentCompletionDue,
	objectiveAlignmentCourseCorrect,
	objectiveAlignmentOutcomeApply,
	objectiveAlignmentStateCreate,
	objectiveAlignmentTestMilestoneSelect,
} from "#agent-harness/core/guardrails/skills/coding/objective-alignment/state-machine";
import { workflowCodeTestCommandIsRecognized } from "#agent-harness/core/guardrails/skills/coding/enforce-test-driven-development";
import type {
	ObjectiveAlignmentState,
	WorkflowCodeChange,
	WorkflowCodeJudgeOutcome,
	WorkflowCodeJudgeRequest,
	WorkflowCodeTestEvidence,
} from "#agent-harness/core/guardrails/skills/coding/coding-contracts";

type WorkflowCodeObjectiveStatus = "active" | "completed" | "abandoned";

interface WorkflowCodeObjective {
	id: number;
	text: string;
	status: WorkflowCodeObjectiveStatus;
	startedAt: number;
	endedAt?: number;
}

export interface ObjectiveAlignmentWorkspaceFile {
	path: string;
	status: string;
	fingerprint: string;
	excerpt: string;
	characterCount: number;
}

export interface ObjectiveAlignmentWorkspaceSnapshot {
	root: string;
	files: readonly ObjectiveAlignmentWorkspaceFile[];
}

export type ObjectiveAlignmentWorkspaceRead = (
	cwd: string,
	includePaths?: readonly string[],
) => ObjectiveAlignmentWorkspaceSnapshot | undefined;

interface SessionScopeState {
	alignment: ObjectiveAlignmentState;
	conversationContext: string[];
	judgeCache: Map<string, WorkflowCodeJudgeOutcome>;
	objective: string;
	objectiveHistory: WorkflowCodeObjective[];
	objectiveEditArmed?: boolean;
	pendingChanges: Map<string, WorkflowCodeChange>;
	workspace?: ObjectiveAlignmentWorkspaceSnapshot;
}

type PiJudgeComplete = (prompt: string, ctx: ExtensionContext) => Promise<string>;

interface WorkflowCodeJudgeCheckEntry {
	objective: string;
	drift: string;
	reAlign: string;
	milestone: WorkflowCodeJudgeRequest["milestone"];
	timestamp: number;
}

interface WorkflowCodeObjectiveStartEntry {
	objectiveId: number;
	objective: string;
	status: "active";
	startedAt: number;
}

interface WorkflowCodeObjectiveEndEntry {
	objectiveId: number;
	objective: string;
	status: "completed";
	startedAt: number;
	endedAt: number;
}

interface WorkflowCodeObjectiveEntry {
	objective: string;
	timestamp: number;
}

const JUDGE_CHECK_ENTRY = "workflow-code-judge-check";
const OBJECTIVE_ENTRY = "workflow-code-objective";
const OBJECTIVE_START_ENTRY = "workflow-code-objective-start";
const OBJECTIVE_END_ENTRY = "workflow-code-objective-end";
const WORKSPACE_EXCERPT_BYTES = 2_000;

function workspaceFileRead(
	root: string,
	path: string,
	status: string,
): ObjectiveAlignmentWorkspaceFile {
	const absolutePath = resolve(root, path);
	try {
		const stat = lstatSync(absolutePath);
		if (stat.isSymbolicLink()) {
			const target = readlinkSync(absolutePath);
			return {
				path,
				status,
				fingerprint: createHash("sha256").update(target).digest("hex"),
				excerpt: target.slice(0, WORKSPACE_EXCERPT_BYTES),
				characterCount: Buffer.byteLength(target),
			};
		}
		if (!stat.isFile()) {
			return {
				path,
				status,
				fingerprint: `non-file:${stat.mode}`,
				excerpt: "[non-file]",
				characterCount: 0,
			};
		}

		const hash = createHash("sha256");
		const excerpt = Buffer.alloc(Math.min(stat.size, WORKSPACE_EXCERPT_BYTES));
		const chunk = Buffer.alloc(64 * 1024);
		const descriptor = openSync(absolutePath, "r");
		let offset = 0;
		try {
			while (offset < stat.size) {
				const length = readSync(descriptor, chunk, 0, chunk.length, offset);
				if (!length) break;
				hash.update(chunk.subarray(0, length));
				if (offset < excerpt.length) {
					chunk.copy(excerpt, offset, 0, Math.min(length, excerpt.length - offset));
				}
				offset += length;
			}
		} finally {
			closeSync(descriptor);
		}
		return {
			path,
			status,
			fingerprint: hash.digest("hex"),
			excerpt: excerpt.toString("utf8"),
			characterCount: stat.size,
		};
	} catch {
		return {
			path,
			status: status === "clean" ? "deleted" : status,
			fingerprint: "deleted",
			excerpt: "[deleted]",
			characterCount: 0,
		};
	}
}

function workspaceRead(
	cwd: string,
	includePaths: readonly string[] = [],
): ObjectiveAlignmentWorkspaceSnapshot | undefined {
	try {
		const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		if (!root) return undefined;
		const output = execFileSync(
			"git",
			["status", "--porcelain=v1", "-z", "--untracked-files=all"],
			{ cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
		);
		const statuses = new Map<string, string>();
		const records = output.split("\0");
		for (let index = 0; index < records.length; index += 1) {
			const record = records[index];
			if (!record) continue;
			const status = record.slice(0, 2);
			const path = record.slice(3);
			statuses.set(path, status);
			if (status.includes("R") || status.includes("C")) {
				const sourcePath = records[index + 1];
				if (sourcePath) statuses.set(sourcePath, `${status}:source`);
				index += 1;
			}
		}
		for (const path of includePaths) {
			if (!statuses.has(path)) statuses.set(path, "clean");
		}
		return {
			root,
			files: [...statuses].map(([path, status]) => workspaceFileRead(root, path, status)),
		};
	} catch {
		return undefined;
	}
}

function guardrailDisabled(): boolean {
	return (
		process.env.AGENT_HARNESS_GUARDRAIL_OFF === "1" ||
		process.env.PI_GUARDRAIL_OFF === "1"
	);
}

function messageTextExtract(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(block): block is { type: "text"; text: string } =>
				typeof block === "object" &&
				block !== null &&
				(block as { type?: string }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string",
		)
		.map((block) => block.text)
		.join("\n");
}

function conversationContextBuild(ctx: ExtensionContext): string[] {
	return ctx.sessionManager
		.getBranch()
		.slice(-8)
		.flatMap((entry) => {
			if (entry.type !== "message" || !entry.message) return [];
			const message = entry.message as { role?: string; content?: unknown };
			const text = messageTextExtract(message.content).trim();
			return text ? [`${message.role ?? "message"}: ${text}`] : [];
		});
}

function changeBuild(event: ToolCallEvent): WorkflowCodeChange | undefined {
	if (event.toolName === "write") {
		const input = event.input as { content?: string; path?: string };
		const content = String(input.content ?? "");
		return {
			operation: "write",
			path: String(input.path ?? ""),
			excerpt: content,
			characterCount: content.length,
		};
	}
	if (event.toolName === "edit") {
		const input = event.input as {
			edits?: Array<{ oldText?: string; newText?: string }>;
			path?: string;
		};
		const edits = input.edits ?? [];
		return {
			operation: "edit",
			path: String(input.path ?? ""),
			excerpt: JSON.stringify(edits),
			characterCount: edits.reduce(
				(total, edit) => total + String(edit.newText ?? "").length,
				0,
			),
		};
	}
	return undefined;
}

function testEvidenceBuild(event: ToolResultEvent): WorkflowCodeTestEvidence {
	return {
		command: String((event.input as { command?: string }).command ?? ""),
		status: event.isError ? "failed" : "passed",
		output: messageTextExtract(event.content),
	};
}

function displayValueBuild(value: string, fallback: string): string {
	return (value.replace(/\s+/g, " ").trim() || fallback).slice(0, 500);
}

function driftDisplayBuild(
	objective: string,
	outcome: WorkflowCodeJudgeOutcome,
): WorkflowCodeJudgeCheckEntry {
	return {
		objective: displayValueBuild(objective, "Unspecified objective"),
		drift: displayValueBuild(outcome.summary, "Objective drift detected"),
		reAlign: displayValueBuild(
			outcome.required_changes.join("; "),
			"Review changes against objective",
		),
		milestone: "completion",
		timestamp: Date.now(),
	};
}

function driftDisplayRender(entry: WorkflowCodeJudgeCheckEntry): string[] {
	return [
		`Objective: ${entry.objective}`,
		`Drift: ${entry.drift}`,
		`Re-align: ${entry.reAlign}`,
	];
}

function judgeFeedbackBuild(outcome: WorkflowCodeJudgeOutcome): string {
	const requiredChanges = outcome.required_changes.map((item) => `- ${item}`).join("\n");
	return [
		`Workflow-code judge: ${outcome.summary}`,
		requiredChanges ? `Required changes:\n${requiredChanges}` : "",
		!outcome.align ? "Stop and ask the user for feedback before using more tools." : "",
	]
		.filter(Boolean)
		.join("\n");
}

async function piJudgeComplete(prompt: string, ctx: ExtensionContext): Promise<string> {
	const model = ctx.model ?? ctx.modelRegistry.getAvailable()[0];
	if (!model) throw new Error("no model is available for the scope judge");

	const stream = ctx.modelRegistry.streamSimple(
		model,
		{
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: prompt }],
					timestamp: Date.now(),
				},
			],
		},
		{ maxTokens: 1_000, reasoning: "low" },
	);
	let text = "";
	for await (const event of stream) {
		if (event.type === "text_delta") text += event.delta;
		if (event.type === "error") throw new Error(event.error.errorMessage);
	}
	return text;
}

export function objectiveAlignmentEnforcementCreate(
	judgeComplete: PiJudgeComplete = piJudgeComplete,
	workspaceStateRead: ObjectiveAlignmentWorkspaceRead = workspaceRead,
): (pi: ExtensionAPI) => void {
	return function objectiveAlignmentEnforcementRegister(pi: ExtensionAPI): void {
		const sessions = new Map<string, SessionScopeState>();

		pi.registerEntryRenderer<WorkflowCodeJudgeCheckEntry>(
			JUDGE_CHECK_ENTRY,
			(entry) => ({
				render: () => driftDisplayRender(entry.data),
				invalidate: () => undefined,
			}),
		);
		pi.registerEntryRenderer<WorkflowCodeObjectiveEntry>(
			OBJECTIVE_ENTRY,
			(entry, { expanded }) => ({
				render: () => [
					"[workflow objective]",
					...(expanded ? [entry.data.objective] : []),
				],
				invalidate: () => undefined,
			}),
		);
		pi.registerEntryRenderer<WorkflowCodeObjectiveStartEntry>(
			OBJECTIVE_START_ENTRY,
			(entry, { expanded }) => ({
				render: () => [
					"[workflow objective start]",
					...(expanded ? [entry.data.objective] : []),
				],
				invalidate: () => undefined,
			}),
		);
		pi.registerEntryRenderer<WorkflowCodeObjectiveEndEntry>(
			OBJECTIVE_END_ENTRY,
			(entry, { expanded }) => ({
				render: () => [
					"[workflow objective end]",
					...(expanded ? [entry.data.objective] : []),
				],
				invalidate: () => undefined,
			}),
		);

		function contextCwd(ctx: ExtensionContext): string {
			return (ctx as ExtensionContext & { cwd?: string }).cwd ?? process.cwd();
		}

		function sessionGet(ctx: ExtensionContext): SessionScopeState {
			const sessionId = ctx.sessionManager.getSessionId();
			const existing = sessions.get(sessionId);
			if (existing) return existing;

			const created: SessionScopeState = {
				alignment: objectiveAlignmentStateCreate(),
				conversationContext: [],
				judgeCache: new Map(),
				objective: "",
				objectiveHistory: [],
				pendingChanges: new Map(),
				workspace: workspaceStateRead(contextCwd(ctx)),
			};
			sessions.set(sessionId, created);
			return created;
		}

		async function judgeRun(
			session: SessionScopeState,
			ctx: ExtensionContext,
			request: WorkflowCodeJudgeRequest,
		): Promise<WorkflowCodeJudgeOutcome> {
			const key = JSON.stringify(request);
			const cached = session.judgeCache.get(key);
			if (cached) return cached;

			const outcome = await workflowCodeJudgeRun(request, (prompt) =>
				judgeComplete(prompt, ctx),
			);
			session.judgeCache.set(key, outcome);
			if (!outcome.align) {
				const drift = {
					...driftDisplayBuild(session.objective, outcome),
					milestone: request.milestone,
				};
				pi.appendEntry<WorkflowCodeJudgeCheckEntry>(JUDGE_CHECK_ENTRY, drift);
				ctx.ui.notify(driftDisplayRender(drift).join("\n"), "warning");
			}
			return outcome;
		}

		async function workspaceReconcile(
			session: SessionScopeState,
			ctx: ExtensionContext,
		): Promise<boolean> {
			const previous = session.workspace;
			const current = workspaceStateRead(
				contextCwd(ctx),
				previous?.files.map((file) => file.path),
			);
			if (!current) return false;
			session.workspace = current;
			if (!previous || previous.root !== current.root) return false;

			const previousFiles = new Map(previous.files.map((file) => [file.path, file]));
			const currentFiles = new Map(current.files.map((file) => [file.path, file]));
			const paths = new Set([...previousFiles.keys(), ...currentFiles.keys()]);
			for (const path of paths) {
				const before = previousFiles.get(path);
				const after = currentFiles.get(path) ?? {
					path,
					status: "deleted",
					fingerprint: "deleted",
					excerpt: "[deleted]",
					characterCount: 0,
				};
				if (
					before &&
					before.status === after.status &&
					before.fingerprint === after.fingerprint &&
					before.characterCount === after.characterCount
				) continue;

				const change: WorkflowCodeChange = {
					operation:
						after.status === "??" || after.status.includes("A") ? "write" : "edit",
					path,
					excerpt: after.excerpt,
					characterCount: after.characterCount,
				};
				const decision = objectiveAlignmentChangeEvaluate(session.alignment, change);
				if (decision.milestone) {
					const outcome = await judgeRun(session, ctx, {
						...requestBuild(session, decision.milestone),
						changes: [...session.alignment.changes, change],
					});
					session.alignment = objectiveAlignmentOutcomeApply(
						session.alignment,
						decision.milestone,
						outcome,
						judgeFeedbackBuild(outcome),
					);
				}
				session.alignment = objectiveAlignmentChangeRecord(session.alignment, change);
			}
			return true;
		}

		function objectiveStart(
			session: SessionScopeState,
			text: string,
			ctx: ExtensionContext,
		): void {
			const startedAt = Date.now();
			const id = session.objectiveHistory.reduce(
				(maximum, objective) => Math.max(maximum, objective.id),
				0,
			) + 1;
			const objective = { id, text, status: "active" as const, startedAt };
			session.objectiveHistory.push(objective);
			session.objective = text;
			session.workspace = workspaceStateRead(contextCwd(ctx));
			pi.appendEntry<WorkflowCodeObjectiveStartEntry>(OBJECTIVE_START_ENTRY, {
				objectiveId: id,
				objective: text,
				status: "active",
				startedAt,
			});
		}

		function objectiveCompleteMark(session: SessionScopeState): void {
			const objective = session.objectiveHistory.at(-1);
			if (!objective || objective.status !== "active") return;
			const endedAt = Date.now();
			objective.status = "completed";
			objective.endedAt = endedAt;
			pi.appendEntry<WorkflowCodeObjectiveEndEntry>(OBJECTIVE_END_ENTRY, {
				objectiveId: objective.id,
				objective: objective.text,
				status: "completed",
				startedAt: objective.startedAt,
				endedAt,
			});
		}

		function requestBuild(
			session: SessionScopeState,
			milestone: WorkflowCodeJudgeRequest["milestone"],
			test?: WorkflowCodeTestEvidence,
		): WorkflowCodeJudgeRequest {
			return {
				milestone,
				objective: session.objective,
				conversationContext: session.conversationContext,
				changes: session.alignment.changes,
				test,
				previousFeedback: session.alignment.previousFeedback,
			};
		}

		pi.on("session_start", (_event, ctx) => {
			const session = sessionGet(ctx);
			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type !== "custom") continue;
				if (entry.customType === OBJECTIVE_START_ENTRY) {
					const data = entry.data as Partial<WorkflowCodeObjectiveStartEntry>;
					if (
						typeof data.objectiveId === "number" &&
						typeof data.objective === "string" &&
						typeof data.startedAt === "number"
					) {
						session.objectiveHistory.push({
							id: data.objectiveId,
							text: data.objective,
							status: "active",
							startedAt: data.startedAt,
						});
						session.objective = data.objective;
						session.alignment = objectiveAlignmentStateCreate();
					}
					continue;
				}
				if (entry.customType === OBJECTIVE_ENTRY) {
					const data = entry.data as Partial<WorkflowCodeObjectiveEntry>;
					const current = session.objectiveHistory.at(-1);
					if (current?.status === "active" && typeof data.objective === "string") {
						current.text = data.objective;
						session.objective = data.objective;
					}
					continue;
				}
				if (entry.customType !== OBJECTIVE_END_ENTRY) continue;
				const data = entry.data as Partial<WorkflowCodeObjectiveEndEntry>;
				const objective = session.objectiveHistory.find((item) => item.id === data.objectiveId);
				if (objective && typeof data.endedAt === "number") {
					objective.status = "completed";
					objective.endedAt = data.endedAt;
					session.alignment = { ...session.alignment, completed: true };
				}
			}
			if (!session.objectiveHistory.length) {
				const legacy = ctx.sessionManager
					.getBranch()
					.slice()
					.reverse()
					.find((entry) => entry.type === "custom" && entry.customType === OBJECTIVE_ENTRY);
				if (legacy?.type === "custom" && typeof (legacy.data as WorkflowCodeObjectiveEntry).objective === "string") {
					session.objective = (legacy.data as WorkflowCodeObjectiveEntry).objective;
				}
			}
		});

		pi.registerCommand("workflow-objective-edit", {
			description: "Load the current workflow objective into the editor",
			handler: async (_args, ctx) => {
				const session = sessionGet(ctx);
				if (!session.objective.trim()) {
					ctx.ui.notify("No workflow objective is active.", "warning");
					return;
				}
				session.objectiveEditArmed = true;
				ctx.ui.setEditorText(session.objective);
				ctx.ui.notify("Objective loaded. Press Ctrl+G to edit externally, then submit.", "info");
			},
		});

		pi.on("input", (event, ctx) => {
			if (
				event.source === "extension" ||
				event.streamingBehavior !== undefined ||
				guardrailDisabled()
			) return;

			const session = sessionGet(ctx);
			const objectiveComplete = session.alignment.completed;
			const objectiveEdited = session.objectiveEditArmed === true;
			const courseCorrection = objectiveEdited || Boolean(session.alignment.haltedFeedback);
			session.alignment = courseCorrection
				? objectiveAlignmentCourseCorrect(session.alignment)
				: objectiveComplete
					? objectiveAlignmentStateCreate()
					: session.alignment;
			session.conversationContext = conversationContextBuild(ctx);
			session.judgeCache.clear();
			if (!session.objective || objectiveComplete) {
				if (objectiveComplete) session.alignment = objectiveAlignmentStateCreate();
				objectiveStart(session, event.text, ctx);
			} else if (objectiveEdited) {
				session.objective = event.text;
				const current = session.objectiveHistory.at(-1);
				if (current?.status === "active") current.text = event.text;
				pi.appendEntry<WorkflowCodeObjectiveEntry>(OBJECTIVE_ENTRY, {
					objective: session.objective,
					timestamp: Date.now(),
				});
			}
			session.objectiveEditArmed = false;
			session.pendingChanges.clear();
		});

		pi.on(
			"tool_call",
			async (
				event: ToolCallEvent,
				ctx: ExtensionContext,
			): Promise<ToolCallEventResult | void> => {
				if (guardrailDisabled()) return;
				const change = changeBuild(event);
				if (!change) return;

				const session = sessionGet(ctx);
				const decision = objectiveAlignmentChangeEvaluate(session.alignment, change);
				if (decision.block) {
					return { block: true, reason: decision.reason, terminate: true };
				}

				if (decision.milestone) {
					const outcome = await judgeRun(session, ctx, {
						...requestBuild(session, decision.milestone),
						changes: [...session.alignment.changes, change],
					});
					const feedback = judgeFeedbackBuild(outcome);
					session.alignment = objectiveAlignmentOutcomeApply(
						session.alignment,
						decision.milestone,
						outcome,
						feedback,
					);
					if (!outcome.align) {
						return { block: true, reason: feedback, terminate: true };
					}
				}

				session.pendingChanges.set(event.toolCallId, change);
			},
		);

		pi.on(
			"tool_result",
			async (
				event: ToolResultEvent,
				ctx: ExtensionContext,
			): Promise<ToolResultEventResult | void> => {
				if (guardrailDisabled()) return;
				const session = sessionGet(ctx);

				if (event.toolName === "edit" || event.toolName === "write") {
					const change = session.pendingChanges.get(event.toolCallId);
					session.pendingChanges.delete(event.toolCallId);
					if (!change || event.isError) return;
					const reconciled = await workspaceReconcile(session, ctx);
					if (!reconciled) {
						session.alignment = objectiveAlignmentChangeRecord(
							session.alignment,
							change,
						);
					}
					return;
				}

				if (event.toolName === "subagent") {
					await workspaceReconcile(session, ctx);
					return;
				}
				if (event.toolName !== "bash") return;
				await workspaceReconcile(session, ctx);
				const test = testEvidenceBuild(event);
				if (!workflowCodeTestCommandIsRecognized(test.command)) return;
				const milestone = objectiveAlignmentTestMilestoneSelect(
					session.alignment,
					event.isError,
				);
				if (!milestone) return;

				const outcome = await judgeRun(
					session,
					ctx,
					requestBuild(session, milestone, test),
				);
				const feedback = judgeFeedbackBuild(outcome);
				session.alignment = objectiveAlignmentOutcomeApply(
					session.alignment,
					milestone,
					outcome,
					feedback,
				);
				if (outcome.align) return;
				return {
					content: [...event.content, { type: "text", text: feedback }],
				};
			},
		);

		pi.on("agent_before_settle", async (_event, ctx) => {
			if (guardrailDisabled()) return;

			const session = sessionGet(ctx);
			await workspaceReconcile(session, ctx);
			if (!objectiveAlignmentCompletionDue(session.alignment)) return;

			const outcome = await judgeRun(
				session,
				ctx,
				requestBuild(session, "completion"),
			);
			const feedback = judgeFeedbackBuild(outcome);
			session.alignment = objectiveAlignmentOutcomeApply(
				session.alignment,
				"completion",
				outcome,
				feedback,
			);
			if (outcome.align) {
				objectiveCompleteMark(session);
				return;
			}

			return {
				entries: [
					{
						type: "custom_message" as const,
						customType: "workflow-code-judge",
						content: feedback,
						display: false,
					},
				],
				continue: true,
			};
		});
	};
}

export default objectiveAlignmentEnforcementCreate();

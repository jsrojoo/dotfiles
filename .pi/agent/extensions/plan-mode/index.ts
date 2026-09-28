/**
 * Plan Mode Extension
 *
 * Read-only exploration mode for safe code analysis.
 * When enabled, built-in write tools are disabled.
 *
 * Features:
 * - enter_plan_mode tool, /plan command, or Ctrl+Alt+P to enable
 * - Bash restricted to allowlisted read-only commands
 * - Extracts numbered plan steps from "Plan:" sections
 * - [DONE:n] markers to complete steps during execution
 * - Progress tracking widget during execution
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { Type, type AssistantMessage, type TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import {
	derivePlanModeLifecycle,
	extractTodoItems,
	isSafeCommand,
	markCompletedSteps,
	validatePlanModeState,
	type PlanModeState,
	type TodoItem,
} from "./utils.ts";

const PLAN_MODE_PROMPT = readFileSync(new URL("./plan-mode-prompt.md", import.meta.url), "utf8").trim();

// Tools
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];
const PLAN_MODE_DISABLED_TOOLS = new Set<string>(["edit", "write"]);
const PLAN_MANAGED_TOOLS = new Set<string>([...PLAN_MODE_TOOLS, ...NORMAL_MODE_TOOLS]);

// Type guard for assistant messages
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

// Extract text content from an assistant message
function getTextContent(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

function isPlanApproval(input: string): boolean {
	return /^(?:approve(?:d)?|execute(?: the plan)?|implement(?: the plan| it)?|go ahead|proceed)[.!]?$/i.test(input.trim());
}

export default function planModeExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let executionMode = false;
	let todoItems: TodoItem[] = [];
	let toolsBeforePlanMode: string[] | undefined;

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	function updateStatus(ctx: ExtensionContext): void {
		// Footer status
		if (executionMode && todoItems.length > 0) {
			const completed = todoItems.filter((t) => t.completed).length;
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${completed}/${todoItems.length}`));
		} else if (planModeEnabled) {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ plan"));
		} else {
			ctx.ui.setStatus("plan-mode", undefined);
		}

		// Widget showing todo list
		if (executionMode && todoItems.length > 0) {
			const lines = todoItems.map((item) => {
				if (item.completed) {
					return (
						ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(item.text))
					);
				}
				return `${ctx.ui.theme.fg("muted", "☐ ")}${item.text}`;
			});
			ctx.ui.setWidget("plan-todos", lines);
		} else {
			ctx.ui.setWidget("plan-todos", undefined);
		}
	}

	function uniqueToolNames(toolNames: string[]): string[] {
		return [...new Set(toolNames)];
	}

	function getPlanModeTools(activeToolNames: string[]): string[] {
		return uniqueToolNames([
			...activeToolNames.filter((name) => !PLAN_MODE_DISABLED_TOOLS.has(name)),
			...PLAN_MODE_TOOLS,
		]);
	}

	function getNormalModeTools(activeToolNames: string[]): string[] {
		return uniqueToolNames([
			...NORMAL_MODE_TOOLS,
			...activeToolNames.filter((name) => !PLAN_MANAGED_TOOLS.has(name)),
		]);
	}

	function enablePlanModeTools(): void {
		toolsBeforePlanMode = uniqueToolNames([...(toolsBeforePlanMode ?? []), ...pi.getActiveTools()]);
		pi.setActiveTools(getPlanModeTools(toolsBeforePlanMode));
	}

	function restoreNormalModeTools(): void {
		pi.setActiveTools(toolsBeforePlanMode ?? getNormalModeTools(pi.getActiveTools()));
		toolsBeforePlanMode = undefined;
	}

	function persistState(): void {
		pi.appendEntry("plan-mode", {
			enabled: planModeEnabled,
			todos: todoItems,
			executing: executionMode,
			toolsBeforePlanMode,
		});
	}

	function executePlan(ctx: ExtensionContext): void {
		const state = validatePlanModeState({
			enabled: planModeEnabled,
			todos: todoItems,
			executing: executionMode,
			toolsBeforePlanMode,
		});
		const firstTodoItem = state?.todos?.[0];
		if (!state || derivePlanModeLifecycle(state) !== "planning" || !firstTodoItem) return;

		todoItems = state.todos ?? [];
		toolsBeforePlanMode = state.toolsBeforePlanMode;
		planModeEnabled = false;
		executionMode = true;
		restoreNormalModeTools();
		updateStatus(ctx);
		persistState();

		const todoListText = todoItems.map((todo, index) => `${index + 1}. ☐ ${todo.text}`).join("\n");
		pi.sendMessage(
			{
				customType: "plan-todo-list",
				content: `**Plan Steps (${todoItems.length}):**\n\n${todoListText}`,
				display: true,
			},
			{ deliverAs: "followUp" },
		);

		const remainingList = todoItems.map((todo) => `${todo.step}. ${todo.text}`).join("\n");
		const execMessage = `Execute the plan.

Remaining steps:
${remainingList}

Start with: ${firstTodoItem.text}
After completing a step, include a [DONE:n] tag in your response.`;
		pi.sendMessage(
			{ customType: "plan-mode-execute", content: execMessage, display: true },
			{ triggerTurn: true, deliverAs: "followUp" },
		);
	}

	function togglePlanMode(ctx: ExtensionContext): void {
		planModeEnabled = !planModeEnabled;
		executionMode = false;
		todoItems = [];

		if (planModeEnabled) {
			enablePlanModeTools();
			ctx.ui.notify("Plan mode enabled. Built-in write tools disabled.");
		} else {
			restoreNormalModeTools();
			ctx.ui.notify("Plan mode disabled. Full access restored.");
		}
		updateStatus(ctx);
		persistState();
	}

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only exploration)",
		handler: async (_args, ctx) => togglePlanMode(ctx),
	});

	pi.registerTool({
		name: "enter_plan_mode",
		label: "Enter Plan Mode",
		description: "Enter read-only Plan Mode before non-trivial implementation or when the user asks for a plan.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (!planModeEnabled) togglePlanMode(ctx);
			return {
				content: [{ type: "text" as const, text: PLAN_MODE_PROMPT }],
				details: { enabled: planModeEnabled },
			};
		},
	});

	pi.registerCommand("todos", {
		description: "Show current plan todo list",
		handler: async (_args, ctx) => {
			if (todoItems.length === 0) {
				ctx.ui.notify("No todos. Create a plan first with /plan", "info");
				return;
			}
			const list = todoItems.map((item, i) => `${i + 1}. ${item.completed ? "✓" : "○"} ${item.text}`).join("\n");
			ctx.ui.notify(`Plan Progress:\n${list}`, "info");
		},
	});

	pi.registerShortcut(Key.ctrlAlt("p"), {
		description: "Toggle plan mode",
		handler: async (ctx) => togglePlanMode(ctx),
	});

	// Accept explicit plan approval from chat; all other input remains normal planning conversation.
	pi.on("input", async (event, ctx) => {
		if (
			event.source === "extension" ||
			event.streamingBehavior !== undefined ||
			!planModeEnabled ||
			todoItems.length === 0 ||
			!isPlanApproval(event.text)
		) {
			return { action: "continue" };
		}

		executePlan(ctx);
		return { action: "handled" };
	});

	// Block destructive bash commands in plan mode
	pi.on("tool_call", async (event) => {
		if (!planModeEnabled || event.toolName !== "bash") return;

		const command = event.input.command as string;
		if (!isSafeCommand(command)) {
			return {
				block: true,
				reason: `Plan mode: command blocked (not allowlisted). Use /plan to disable plan mode first.\nCommand: ${command}`,
			};
		}
	});

	// Filter out stale plan mode context when not in plan mode
	pi.on("context", async (event) => {
		if (planModeEnabled) return;

		return {
			messages: event.messages.filter((m) => {
				const msg = m as AgentMessage & { customType?: string };
				if (msg.customType === "plan-mode-context") return false;
				if (msg.role !== "user") return true;

				const content = msg.content;
				if (typeof content === "string") {
					return !content.includes("[PLAN MODE ACTIVE]");
				}
				if (Array.isArray(content)) {
					return !content.some(
						(c) => c.type === "text" && (c as TextContent).text?.includes("[PLAN MODE ACTIVE]"),
					);
				}
				return true;
			}),
		};
	});

	// Inject plan/execution context before agent starts
	pi.on("before_agent_start", async () => {
		if (planModeEnabled) {
			return {
				message: {
					customType: "plan-mode-context",
					content: PLAN_MODE_PROMPT,
					display: false,
				},
			};
		}

		if (executionMode && todoItems.length > 0) {
			const remaining = todoItems.filter((t) => !t.completed);
			const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
			return {
				message: {
					customType: "plan-execution-context",
					content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order.
After completing a step, include a [DONE:n] tag in your response.`,
					display: false,
				},
			};
		}
	});

	// Track progress after each turn
	pi.on("turn_end", async (event, ctx) => {
		if (!executionMode || todoItems.length === 0) return;
		if (!isAssistantMessage(event.message)) return;

		const text = getTextContent(event.message);
		if (markCompletedSteps(text, todoItems) > 0) {
			updateStatus(ctx);
		}
		persistState();
	});

	// Handle plan completion and plan mode UI
	pi.on("agent_end", async (event, ctx) => {
		// Check if execution is complete
		if (executionMode && todoItems.length > 0) {
			const lifecycle = derivePlanModeLifecycle({ enabled: planModeEnabled, executing: executionMode, todos: todoItems });
			if (lifecycle === "completed") {
				const completedList = todoItems.map((t) => `~~${t.text}~~`).join("\n");
				pi.sendMessage(
					{ customType: "plan-complete", content: `**Plan Complete!** ✓\n\n${completedList}`, display: true },
					{ triggerTurn: false },
				);
				executionMode = false;
				todoItems = [];
				updateStatus(ctx);
				persistState(); // Save cleared state so resume doesn't restore old execution mode
			}
			return;
		}

		if (!planModeEnabled) return;

		// Extract todos from last assistant message so chat can approve or refine without blocking on UI.
		const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
		if (lastAssistant) {
			const extracted = extractTodoItems(getTextContent(lastAssistant));
			if (extracted.length > 0) {
				todoItems = extracted;
				persistState();
			}
		}
	});

	// Restore state on session start/resume
	pi.on("session_start", async (_event, ctx) => {
		planModeEnabled = pi.getFlag("plan") === true;
		executionMode = false;
		todoItems = [];
		toolsBeforePlanMode = undefined;

		const entries = ctx.sessionManager.getEntries();

		// The newest persisted plan-mode entry is authoritative.
		// A malformed newest entry fails closed instead of restoring older state.
		let restoredState: PlanModeState | null = null;
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i] as { type: string; customType?: string; data?: unknown };
			if (entry.type !== "custom" || entry.customType !== "plan-mode") continue;
			restoredState = validatePlanModeState(entry.data);
			break;
		}

		if (restoredState) {
			planModeEnabled = restoredState.enabled;
			todoItems = restoredState.todos ?? [];
			executionMode = restoredState.executing ?? false;
			toolsBeforePlanMode = restoredState.toolsBeforePlanMode;
		}

		// On resume: re-scan messages to rebuild completion state
		// Only scan messages AFTER the last "plan-mode-execute" to avoid picking up [DONE:n] from previous plans
		const isResume = restoredState !== null;
		if (isResume && executionMode && todoItems.length > 0) {
			// Find the index of the last plan-mode-execute entry (marks when current execution started)
			let executeIndex = -1;
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i] as { type: string; customType?: string };
				if (entry.customType === "plan-mode-execute") {
					executeIndex = i;
					break;
				}
			}

			if (executeIndex >= 0) {
				// Only scan messages after the execute marker.
				const messages: AssistantMessage[] = [];
				for (let i = executeIndex + 1; i < entries.length; i++) {
					const entry = entries[i];
					if (entry.type === "message" && "message" in entry && isAssistantMessage(entry.message as AgentMessage)) {
						messages.push(entry.message as AssistantMessage);
					}
				}
				const allText = messages.map(getTextContent).join("\n");
				markCompletedSteps(allText, todoItems);
			}

			if (derivePlanModeLifecycle({ enabled: planModeEnabled, executing: executionMode, todos: todoItems }) === "completed") {
				executionMode = false;
				todoItems = [];
				persistState();
			}
		}

		if (planModeEnabled) {
			enablePlanModeTools();
		}
		updateStatus(ctx);
	});
}

import { tddGuardrailHandle, tddHookCliRun } from "#agent-harness/hooks/tdd-guardrail";
import type { TddHookEvent } from "#agent-harness/hooks/tdd-guardrail";

export function codexTddHookHandle(
	payload: Record<string, unknown>,
	stateDirectory?: string,
): Record<string, unknown> | undefined {
	return tddGuardrailHandle(
		"codex",
		{
			eventName: String(payload.hook_event_name ?? ""),
			sessionId: String(payload.session_id ?? ""),
			prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
			toolName: typeof payload.tool_name === "string" ? payload.tool_name : undefined,
			toolId: typeof payload.tool_use_id === "string" ? payload.tool_use_id : undefined,
			toolInput: isRecord(payload.tool_input) ? payload.tool_input : undefined,
			toolResponse: payload.tool_response,
		},
		stateDirectory,
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

tddHookCliRun("codex", import.meta.url);

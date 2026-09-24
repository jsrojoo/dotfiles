import type {
	WorkflowCodeCompletionDecision,
	WorkflowCodePathKind,
	WorkflowCodeState,
	WorkflowCodeWriteDecision,
} from "./coding-contracts.ts";

export type {
	WorkflowCodeCompletionDecision,
	WorkflowCodePathKind,
	WorkflowCodeState,
	WorkflowCodeWriteDecision,
} from "./coding-contracts.ts";

const SOURCE_FILE_PATTERN = /\.(?:c|cc|cpp|cs|go|h|hpp|java|js|jsx|kt|mjs|cjs|php|py|rb|rs|scala|sh|bash|swift|ts|tsx)$/i;
const TEST_DIRECTORY_PATTERN = /(?:^|[\\/])(?:__tests__|tests?)(?:[\\/]|$)/i;
const TEST_FILE_PATTERN = /(?:^|[\\/])(?:test_[^\\/]+|[^\\/]+\.(?:test|spec)\.[a-z0-9]+|[^\\/]+_test\.[a-z0-9]+)$/i;
const TEST_COMMAND_PATTERNS = [
	/\b(?:pytest|py\.test|jest|vitest|mocha|rspec|phpunit)\b/i,
	/\bpython(?:\d+(?:\.\d+)*)?\s+-m\s+(?:pytest|unittest)\b/i,
	/\bnode\s+--test\b/i,
	/\b(?:npm|pnpm|yarn|bun)\s+(?:(?:run)\s+)?test(?::[\w-]+)?\b/i,
	/\bgo\s+test\b/i,
	/\bcargo\s+test\b/i,
	/\bdotnet\s+test\b/i,
	/\b(?:mvn|mvnw)(?:\s+[^;&|]+)?\s+test\b/i,
	/\b(?:gradle|gradlew)\s+test\b/i,
	/\bmix\s+test\b/i,
	/\bswift\s+test\b/i,
	/\bmake\s+test\b/i,
];

export function workflowCodeStateCreate(): WorkflowCodeState {
	return { phase: "locked", reminderSent: false };
}

export function workflowCodeStateSkip(_state: WorkflowCodeState): WorkflowCodeState {
	return { phase: "skipped", reminderSent: false };
}

export function workflowCodePathClassify(path: string): WorkflowCodePathKind {
	if (TEST_DIRECTORY_PATTERN.test(path) || TEST_FILE_PATTERN.test(path)) return "test";
	if (SOURCE_FILE_PATTERN.test(path)) return "source";
	return "other";
}

export function workflowCodeTestCommandIsRecognized(command: string): boolean {
	return TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

export function workflowCodeTestResultApply(
	state: WorkflowCodeState,
	command: string,
	isError: boolean,
): WorkflowCodeState {
	if (!workflowCodeTestCommandIsRecognized(command)) return state;
	if (isError) {
		if (state.phase === "code-changed") return state;
		if (state.phase === "green") return { phase: "code-changed", reminderSent: false };
		if (state.phase === "skipped") return state;
		return { phase: "red", reminderSent: false };
	}
	if (state.phase === "code-changed") return { phase: "green", reminderSent: false };
	return state;
}

export function workflowCodeWriteEvaluate(
	state: WorkflowCodeState,
	path: string,
): WorkflowCodeWriteDecision {
	const pathKind = workflowCodePathClassify(path);
	if (pathKind !== "source") return { block: false, state };

	if (state.phase === "locked") {
		return {
			block: true,
			reason:
				`Blocked production-code write to "${path}": establish a failing test first. ` +
				"Run the focused test to confirm red, or use `/tdd-skip` as a one-request kill switch.",
			state,
		};
	}

	if (state.phase === "skipped") return { block: false, state };
	if (state.phase === "code-changed") return { block: false, state };

	return {
		block: false,
		state: { phase: "code-changed", reminderSent: false },
	};
}

export function workflowCodeCompletionEvaluate(
	state: WorkflowCodeState,
): WorkflowCodeCompletionDecision {
	if (state.phase !== "code-changed" || state.reminderSent) {
		return { remind: false, state };
	}

	return {
		remind: true,
		state: { ...state, reminderSent: true },
	};
}

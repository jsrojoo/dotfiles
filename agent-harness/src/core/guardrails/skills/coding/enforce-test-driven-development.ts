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
	return { phase: "locked", testChanged: false };
}

export function workflowCodeStateSkip(_state: WorkflowCodeState): WorkflowCodeState {
	return { phase: "skipped", testChanged: false };
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
		if (state.phase === "green") return { ...state, phase: "code-changed" };
		if (state.phase === "skipped") return state;
		return { ...state, phase: "red" };
	}
	if (state.phase === "code-changed" && state.testChanged) {
		return { ...state, phase: "green" };
	}
	return state;
}

export function workflowCodeWriteEvaluate(
	state: WorkflowCodeState,
	path: string,
): WorkflowCodeWriteDecision {
	const pathKind = workflowCodePathClassify(path);
	if (pathKind === "test" && state.phase !== "skipped") {
		return { block: false, state: { ...state, testChanged: true } };
	}
	if (pathKind !== "source" || state.phase === "skipped") return { block: false, state };

	return {
		block: false,
		state: { ...state, phase: "code-changed" },
	};
}

export function workflowCodeCompletionEvaluate(
	state: WorkflowCodeState,
): WorkflowCodeCompletionDecision {
	return { remind: state.phase === "code-changed", state };
}

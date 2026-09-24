import { workflowCodePathClassify } from "../enforce-test-driven-development.ts";
import type {
	ObjectiveAlignmentChangeDecision,
	ObjectiveAlignmentState,
	WorkflowCodeChange,
	WorkflowCodeImplementationProgress,
	WorkflowCodeJudgeOutcome,
	WorkflowCodeMilestone,
} from "../workflow-code-contracts.ts";

const IMPLEMENTATION_CHARACTER_MILESTONE = 4_000;
const IMPLEMENTATION_EDIT_MILESTONE = 3;

export function objectiveAlignmentProgressCreate(): WorkflowCodeImplementationProgress {
	return { productionCharacterCount: 0, productionEditCount: 0 };
}

export function objectiveAlignmentProgressRecord(
	progress: WorkflowCodeImplementationProgress,
	change: WorkflowCodeChange,
): WorkflowCodeImplementationProgress {
	if (workflowCodePathClassify(change.path) !== "source") return progress;
	return {
		productionCharacterCount: progress.productionCharacterCount + change.characterCount,
		productionEditCount: progress.productionEditCount + 1,
	};
}

export function objectiveAlignmentProgressDue(
	progress: WorkflowCodeImplementationProgress,
): boolean {
	return (
		progress.productionCharacterCount >= IMPLEMENTATION_CHARACTER_MILESTONE ||
		progress.productionEditCount >= IMPLEMENTATION_EDIT_MILESTONE
	);
}

function objectiveAlignmentProgressReset(): WorkflowCodeImplementationProgress {
	return objectiveAlignmentProgressCreate();
}

export function objectiveAlignmentStateCreate(): ObjectiveAlignmentState {
	return {
		changes: [],
		completed: false,
		implementationProgress: objectiveAlignmentProgressCreate(),
		previousFeedback: [],
		sourceChangedSinceGreen: false,
	};
}

export function objectiveAlignmentChangeEvaluate(
	state: ObjectiveAlignmentState,
	change: WorkflowCodeChange,
): ObjectiveAlignmentChangeDecision {
	if (workflowCodePathClassify(change.path) !== "source") return { block: false };
	if (state.haltedFeedback) {
		return { block: true, reason: state.haltedFeedback };
	}
	return {
		block: false,
		milestone: objectiveAlignmentProgressDue(state.implementationProgress)
			? "implementation"
			: undefined,
	};
}

export function objectiveAlignmentChangeRecord(
	state: ObjectiveAlignmentState,
	change: WorkflowCodeChange,
): ObjectiveAlignmentState {
	const sourceChanged = workflowCodePathClassify(change.path) === "source";
	return {
		...state,
		changes: [...state.changes, change],
		implementationProgress: objectiveAlignmentProgressRecord(
			state.implementationProgress,
			change,
		),
		sourceChangedSinceGreen: state.sourceChangedSinceGreen || sourceChanged,
	};
}

export function objectiveAlignmentTestMilestoneSelect(
	state: ObjectiveAlignmentState,
	isError: boolean,
): "red" | "green" | undefined {
	if (isError) return state.sourceChangedSinceGreen ? undefined : "red";
	return state.sourceChangedSinceGreen ? "green" : undefined;
}

export function objectiveAlignmentOutcomeApply(
	state: ObjectiveAlignmentState,
	milestone: WorkflowCodeMilestone,
	outcome: WorkflowCodeJudgeOutcome,
	feedback: string = outcome.summary,
): ObjectiveAlignmentState {
	if (!outcome.align) {
		return {
			...state,
			haltedFeedback: feedback,
			implementationProgress:
				milestone === "implementation"
					? objectiveAlignmentProgressReset()
					: state.implementationProgress,
			previousFeedback: [...state.previousFeedback, feedback],
		};
	}

	if (milestone === "red") {
		return { ...state, completed: false, haltedFeedback: undefined };
	}
	if (milestone === "implementation") {
		return {
			...state,
			haltedFeedback: undefined,
			implementationProgress: objectiveAlignmentProgressReset(),
		};
	}
	if (milestone === "green") {
		return { ...state, haltedFeedback: undefined, sourceChangedSinceGreen: false };
	}
	return { ...state, completed: true, haltedFeedback: undefined };
}

export function objectiveAlignmentCourseCorrect(
	state: ObjectiveAlignmentState,
): ObjectiveAlignmentState {
	return {
		...state,
		completed: false,
		haltedFeedback: undefined,
		implementationProgress: objectiveAlignmentProgressCreate(),
		previousFeedback: [],
	};
}

export function objectiveAlignmentCompletionDue(state: ObjectiveAlignmentState): boolean {
	return (
		state.changes.some(
			(change) => workflowCodePathClassify(change.path) === "source",
		) && !state.completed && !state.haltedFeedback
	);
}

export type WorkflowCodePathKind = "source" | "test" | "other";
export type WorkflowCodePhase = "locked" | "red" | "code-changed" | "green" | "skipped";
export type WorkflowCodeMilestone = "red" | "implementation" | "green" | "completion";

export interface WorkflowCodeState {
	phase: WorkflowCodePhase;
	testChanged: boolean;
}

export interface WorkflowCodeWriteDecision {
	block: boolean;
	reason?: string;
	state: WorkflowCodeState;
}

export interface WorkflowCodeCompletionDecision {
	remind: boolean;
	state: WorkflowCodeState;
}

export interface WorkflowCodeChange {
	operation: "edit" | "write";
	path: string;
	excerpt: string;
	characterCount: number;
}

export interface WorkflowCodeImplementationProgress {
	productionCharacterCount: number;
	productionEditCount: number;
}

export interface WorkflowCodeTestEvidence {
	command: string;
	status: "failed" | "passed";
	output: string;
}

export interface ObjectiveAlignmentState {
	changes: WorkflowCodeChange[];
	completed: boolean;
	haltedFeedback?: string;
	implementationProgress: WorkflowCodeImplementationProgress;
	previousFeedback: string[];
	sourceChangedSinceGreen: boolean;
}

export interface ObjectiveAlignmentChangeDecision {
	block: boolean;
	milestone?: "implementation";
	reason?: string;
}

export interface WorkflowCodeJudgeRequest {
	milestone: WorkflowCodeMilestone;
	objective: string;
	conversationContext: string[];
	changes: WorkflowCodeChange[];
	test?: WorkflowCodeTestEvidence;
	previousFeedback: string[];
}

export interface WorkflowCodeJudgeEvidence {
	path: string;
	change: string;
	objective_conflict: string;
}

export interface WorkflowCodeJudgeVerdict {
	align: boolean;
	summary: string;
	evidence: WorkflowCodeJudgeEvidence[];
	required_changes: string[];
}

export type WorkflowCodeJudgeOutcome = WorkflowCodeJudgeVerdict;
export type WorkflowCodeJudgeComplete = (prompt: string) => Promise<string>;

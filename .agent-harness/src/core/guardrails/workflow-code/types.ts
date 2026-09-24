export type WorkflowCodePathKind = "source" | "test" | "other";
export type WorkflowCodePhase = "locked" | "red" | "code-changed" | "green" | "skipped";
export type WorkflowCodeMilestone = "red" | "implementation" | "green" | "completion";

export interface WorkflowCodeState {
	phase: WorkflowCodePhase;
	reminderSent: boolean;
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
	verdict: "aligned" | "revise";
	summary: string;
	evidence: WorkflowCodeJudgeEvidence[];
	required_changes: string[];
}

export interface WorkflowCodeJudgeUnavailable {
	verdict: "unavailable";
	summary: string;
	evidence: [];
	required_changes: [];
}

export type WorkflowCodeJudgeOutcome = WorkflowCodeJudgeVerdict | WorkflowCodeJudgeUnavailable;
export type WorkflowCodeJudgeComplete = (prompt: string) => Promise<string>;

import {
	sqlCommandExecutes,
	sqlCommandMutates,
	sqlCommandProvidesProof,
	sqlTextNeedsProof,
} from "./classify-sql.ts";

export interface SqlValidationState {
	correctionRequested: boolean;
	proofRecorded: boolean;
}

export interface SqlValidationCompletionDecision {
	correct: boolean;
	state: SqlValidationState;
}

export function sqlValidationStateCreate(): SqlValidationState {
	return { correctionRequested: false, proofRecorded: false };
}

export function sqlValidationProofRecord(
	state: SqlValidationState,
	command: string,
	output: string,
	isError: boolean,
): SqlValidationState {
	if (isError || !sqlCommandExecutes(command) || sqlCommandMutates(command)) return state;
	if (!sqlCommandProvidesProof(command) || !output.trim()) return state;
	return { ...state, proofRecorded: true };
}

export function sqlValidationCompletionEvaluate(
	state: SqlValidationState,
	text: string,
): SqlValidationCompletionDecision {
	if (!sqlTextNeedsProof(text) || state.proofRecorded || state.correctionRequested) {
		return { correct: false, state };
	}
	return {
		correct: true,
		state: { ...state, correctionRequested: true },
	};
}

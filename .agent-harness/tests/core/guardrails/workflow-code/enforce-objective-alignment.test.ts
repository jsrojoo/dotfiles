import assert from "node:assert/strict";
import test from "node:test";

import {
	objectiveAlignmentChangeEvaluate,
	objectiveAlignmentChangeRecord,
	objectiveAlignmentCourseCorrect,
	objectiveAlignmentCompletionDue,
	objectiveAlignmentOutcomeApply,
	objectiveAlignmentStateCreate,
	objectiveAlignmentTestMilestoneSelect,
} from "#agent-harness/core/guardrails/workflow-code/enforce-objective-alignment";
import type {
	WorkflowCodeChange,
	WorkflowCodeJudgeOutcome,
} from "#agent-harness/core/guardrails/workflow-code/workflow-code-contracts";

const CHANGE: WorkflowCodeChange = {
	operation: "edit",
	path: "src/account.ts",
	excerpt: "return valid;",
	characterCount: 13,
};
const REVISE: WorkflowCodeJudgeOutcome = {
	verdict: "revise",
	summary: "Unrelated behavior was added.",
	evidence: [
		{
			path: "src/account.ts",
			change: "Added unrelated fallback",
			objective_conflict: "Objective only changes validation",
		},
	],
	required_changes: ["Remove fallback"],
};
const ALIGNED: WorkflowCodeJudgeOutcome = {
	verdict: "aligned",
	summary: "Aligned.",
	evidence: [],
	required_changes: [],
};

test("red revision blocks production changes until a red check aligns", () => {
	const revised = objectiveAlignmentOutcomeApply(
		objectiveAlignmentStateCreate(),
		"red",
		REVISE,
	);
	assert.equal(objectiveAlignmentChangeEvaluate(revised, CHANGE).block, true);

	const aligned = objectiveAlignmentOutcomeApply(revised, "red", ALIGNED);
	assert.equal(aligned.completed, false);
	assert.equal(objectiveAlignmentChangeEvaluate(aligned, CHANGE).block, false);
});

test("successful production edits trigger an implementation milestone", () => {
	let state = objectiveAlignmentStateCreate();
	for (let index = 0; index < 3; index += 1) {
		state = objectiveAlignmentChangeRecord(state, CHANGE);
	}

	assert.equal(
		objectiveAlignmentChangeEvaluate(state, { ...CHANGE, path: "src/next.ts" })
			.milestone,
		"implementation",
	);
	assert.equal(
		objectiveAlignmentChangeEvaluate(state, { ...CHANGE, path: "tests/next.test.ts" })
			.milestone,
		undefined,
	);
});

test("one coherent large edit is recorded before any checkpoint blocks", () => {
	const state = objectiveAlignmentChangeRecord(objectiveAlignmentStateCreate(), {
		...CHANGE,
		excerpt: "x".repeat(5_000),
		characterCount: 5_000,
	});

	assert.equal(state.changes.length, 1);
	assert.equal(state.implementationProgress.productionEditCount, 1);
	assert.equal(
		objectiveAlignmentChangeEvaluate(state, { ...CHANGE, path: "src/next.ts" })
			.milestone,
		"implementation",
	);
});

test("test and documentation edits do not consume implementation progress", () => {
	let state = objectiveAlignmentStateCreate();
	for (const path of ["tests/account.test.ts", "README.md"]) {
		state = objectiveAlignmentChangeRecord(state, { ...CHANGE, path });
	}

	assert.equal(state.implementationProgress.productionEditCount, 0);
	assert.equal(state.implementationProgress.productionCharacterCount, 0);
});

test("implementation revision halts until objective correction", () => {
	let state = objectiveAlignmentStateCreate();
	for (let index = 0; index < 3; index += 1) {
		state = objectiveAlignmentChangeRecord(state, CHANGE);
	}
	state = objectiveAlignmentOutcomeApply(state, "implementation", REVISE);
	assert.equal(objectiveAlignmentChangeEvaluate(state, CHANGE).block, true);

	const corrected = objectiveAlignmentCourseCorrect(state);
	const correction = objectiveAlignmentChangeEvaluate(corrected, {
		...CHANGE,
		path: "src/correction.ts",
	});
	assert.equal(correction.block, false);
	assert.equal(correction.milestone, undefined);
});

test("test outcomes select red and green milestones from alignment state", () => {
	const initial = objectiveAlignmentStateCreate();
	const changed = objectiveAlignmentChangeRecord(initial, CHANGE);

	assert.equal(objectiveAlignmentTestMilestoneSelect(initial, true), "red");
	assert.equal(objectiveAlignmentTestMilestoneSelect(changed, false), "green");
	assert.equal(objectiveAlignmentTestMilestoneSelect(changed, true), undefined);
});

test("any revision halts work until the objective is corrected", () => {
	const changed = objectiveAlignmentChangeRecord(objectiveAlignmentStateCreate(), CHANGE);
	const revised = objectiveAlignmentOutcomeApply(changed, "green", REVISE);

	assert.equal(objectiveAlignmentChangeEvaluate(revised, CHANGE).block, true);
	assert.equal(objectiveAlignmentCompletionDue(revised), false);
});

test("aligned completion closes the current objective", () => {
	const changed = objectiveAlignmentChangeRecord(objectiveAlignmentStateCreate(), CHANGE);
	const completed = objectiveAlignmentOutcomeApply(changed, "completion", ALIGNED);

	assert.equal(completed.completed, true);
	assert.equal(objectiveAlignmentCompletionDue(completed), false);
});

test("objective correction preserves changes and clears the halt", () => {
	const changed = objectiveAlignmentChangeRecord(objectiveAlignmentStateCreate(), CHANGE);
	const revised = objectiveAlignmentOutcomeApply(changed, "completion", REVISE);
	const corrected = objectiveAlignmentCourseCorrect(revised);

	assert.deepEqual(corrected.changes, [CHANGE]);
	assert.equal(corrected.completed, false);
	assert.equal(corrected.haltedFeedback, undefined);
	assert.equal(objectiveAlignmentChangeEvaluate(corrected, CHANGE).block, false);
});

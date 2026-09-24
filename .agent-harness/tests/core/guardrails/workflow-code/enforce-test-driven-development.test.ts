import assert from "node:assert/strict";
import test from "node:test";

import {
	workflowCodeCompletionEvaluate,
	workflowCodePathClassify,
	workflowCodeStateCreate,
	workflowCodeStateSkip,
	workflowCodeTestCommandIsRecognized,
	workflowCodeTestResultApply,
	workflowCodeWriteEvaluate,
} from "#agent-harness/core/guardrails/workflow-code/enforce-test-driven-development";

test("classifies source, test, and non-code paths", () => {
	assert.equal(workflowCodePathClassify("src/account.ts"), "source");
	assert.equal(workflowCodePathClassify("tests/account.py"), "test");
	assert.equal(workflowCodePathClassify("src/account.test.ts"), "test");
	assert.equal(workflowCodePathClassify("README.md"), "other");
});

test("recognizes common test commands without treating arbitrary failures as tests", () => {
	for (const command of [
		"pytest tests/test_account.py",
		"python3 -m unittest tests.test_account",
		"node --test tests/account.test.ts",
		"npm run test:unit",
		"pnpm test",
		"go test ./...",
		"cargo test",
	]) {
		assert.equal(workflowCodeTestCommandIsRecognized(command), true, command);
	}
	assert.equal(workflowCodeTestCommandIsRecognized("npm run build"), false);
	assert.equal(workflowCodeTestCommandIsRecognized("python3 scripts/build.py"), false);
});

test("blocks production code before red while allowing tests and non-code files", () => {
	const state = workflowCodeStateCreate();

	assert.equal(workflowCodeWriteEvaluate(state, "src/account.ts").block, true);
	assert.equal(workflowCodeWriteEvaluate(state, "tests/account.test.ts").block, false);
	assert.equal(workflowCodeWriteEvaluate(state, "README.md").block, false);
});

test("failed tests unlock source edits and successful tests do not relock refactoring", () => {
	const locked = workflowCodeStateCreate();
	const red = workflowCodeTestResultApply(locked, "node --test tests/account.test.ts", true);
	const changed = workflowCodeWriteEvaluate(red, "src/account.ts");
	const green = workflowCodeTestResultApply(changed.state, "node --test tests/account.test.ts", false);
	const refactored = workflowCodeWriteEvaluate(green, "src/account.ts");

	assert.equal(red.phase, "red");
	assert.equal(changed.block, false);
	assert.equal(changed.state.phase, "code-changed");
	assert.equal(green.phase, "green");
	assert.equal(refactored.block, false);
	assert.equal(refactored.state.phase, "code-changed");
});

test("successful or unrecognized commands do not unlock an initially locked cycle", () => {
	const locked = workflowCodeStateCreate();
	const passing = workflowCodeTestResultApply(locked, "pytest", false);
	const unrelatedFailure = workflowCodeTestResultApply(locked, "npm run build", true);

	assert.equal(passing.phase, "locked");
	assert.equal(unrelatedFailure.phase, "locked");
});

test("completion asks for green once after code changes", () => {
	const red = workflowCodeTestResultApply(workflowCodeStateCreate(), "pytest", true);
	const changed = workflowCodeWriteEvaluate(red, "src/account.py").state;
	const first = workflowCodeCompletionEvaluate(changed);
	const second = workflowCodeCompletionEvaluate(first.state);

	assert.equal(first.remind, true);
	assert.equal(second.remind, false);
});

test("a failing test after production changes still requires green", () => {
	const red = workflowCodeTestResultApply(workflowCodeStateCreate(), "pytest", true);
	const changed = workflowCodeWriteEvaluate(red, "src/account.py").state;
	const stillFailing = workflowCodeTestResultApply(changed, "pytest", true);

	assert.equal(stillFailing.phase, "code-changed");
	assert.equal(workflowCodeCompletionEvaluate(stillFailing).remind, true);
});

test("green and explicitly skipped cycles can complete", () => {
	const red = workflowCodeTestResultApply(workflowCodeStateCreate(), "pytest", true);
	const changed = workflowCodeWriteEvaluate(red, "src/account.py").state;
	const green = workflowCodeTestResultApply(changed, "pytest", false);
	const skipped = workflowCodeStateSkip(workflowCodeStateCreate());

	assert.equal(workflowCodeCompletionEvaluate(green).remind, false);
	assert.equal(workflowCodeWriteEvaluate(skipped, "src/generated.ts").block, false);
	assert.equal(workflowCodeCompletionEvaluate(skipped).remind, false);
});

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
} from "#agent-harness/core/guardrails/skills/coding/enforce-test-driven-development";

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

test("allows source and test edits in either order", () => {
	const state = workflowCodeStateCreate();
	const sourceFirst = workflowCodeWriteEvaluate(state, "src/account.ts");
	const testFirst = workflowCodeWriteEvaluate(state, "tests/account.test.ts");

	assert.equal(sourceFirst.block, false);
	assert.equal(sourceFirst.state.phase, "code-changed");
	assert.equal(sourceFirst.state.testChanged, false);
	assert.equal(testFirst.block, false);
	assert.equal(testFirst.state.testChanged, true);
	assert.equal(workflowCodeWriteEvaluate(state, "README.md").block, false);
});

test("source and test changes become green after a successful test", () => {
	const sourceChanged = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "src/account.ts").state;
	const testChanged = workflowCodeWriteEvaluate(sourceChanged, "tests/account.test.ts").state;
	const green = workflowCodeTestResultApply(testChanged, "node --test tests/account.test.ts", false);
	const refactored = workflowCodeWriteEvaluate(green, "src/account.ts");

	assert.equal(green.phase, "green");
	assert.equal(refactored.block, false);
	assert.equal(refactored.state.phase, "code-changed");
});

test("passing tests do not complete source-only or test-before-source cycles", () => {
	const sourceOnly = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "src/account.ts").state;
	const testOnly = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "tests/account.test.ts").state;
	const testPassed = workflowCodeTestResultApply(testOnly, "pytest", false);
	const sourceAfterPass = workflowCodeWriteEvaluate(testPassed, "src/account.py").state;

	assert.equal(workflowCodeTestResultApply(sourceOnly, "pytest", false).phase, "code-changed");
	assert.equal(testPassed.phase, "locked");
	assert.equal(sourceAfterPass.phase, "code-changed");
	assert.equal(workflowCodeCompletionEvaluate(sourceAfterPass).remind, true);
});

test("completion keeps requiring test coverage and green after source changes", () => {
	const changed = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "src/account.py").state;
	const first = workflowCodeCompletionEvaluate(changed);
	const second = workflowCodeCompletionEvaluate(first.state);

	assert.equal(first.remind, true);
	assert.equal(second.remind, true);
});

test("a failing test after parallel changes still requires green", () => {
	const sourceChanged = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "src/account.py").state;
	const testChanged = workflowCodeWriteEvaluate(sourceChanged, "tests/test_account.py").state;
	const stillFailing = workflowCodeTestResultApply(testChanged, "pytest", true);

	assert.equal(stillFailing.phase, "code-changed");
	assert.equal(workflowCodeCompletionEvaluate(stillFailing).remind, true);
});

test("green and explicitly skipped cycles can complete", () => {
	const sourceChanged = workflowCodeWriteEvaluate(workflowCodeStateCreate(), "src/account.py").state;
	const testChanged = workflowCodeWriteEvaluate(sourceChanged, "tests/test_account.py").state;
	const green = workflowCodeTestResultApply(testChanged, "pytest", false);
	const skipped = workflowCodeStateSkip(workflowCodeStateCreate());

	assert.equal(workflowCodeCompletionEvaluate(green).remind, false);
	assert.equal(workflowCodeWriteEvaluate(skipped, "src/generated.ts").block, false);
	assert.equal(workflowCodeCompletionEvaluate(skipped).remind, false);
});

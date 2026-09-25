import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { claudeTddHookHandle } from "#agent-harness/claude/tdd-hook";

function harnessCreate() {
	const stateDirectory = mkdtempSync(join(tmpdir(), "agent-harness-claude-tdd-"));
	let sequence = 0;
	return {
		close: () => rmSync(stateDirectory, { recursive: true, force: true }),
		hook: (event: Record<string, unknown>) =>
			claudeTddHookHandle(
				{ session_id: "session-1", ...event },
				stateDirectory,
			),
		nextId: () => `tool-${++sequence}`,
	};
}

test("Claude hook allows parallel source and test edits, then requires green", () => {
	const harness = harnessCreate();
	try {
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "Fix account validation" });
		const implementationId = harness.nextId();
		assert.equal(harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_use_id: implementationId,
			tool_input: { file_path: "src/account.ts" },
		}), undefined);
		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "Write",
			tool_use_id: implementationId,
			tool_input: { file_path: "src/account.ts" },
			tool_response: {},
		});
		const sourceOnlyStop = harness.hook({ hook_event_name: "Stop", stop_hook_active: false });
		assert.equal(sourceOnlyStop?.decision, "block");
		assert.match(sourceOnlyStop?.reason, /Add or update a relevant test/);

		const testId = harness.nextId();
		harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "Write",
			tool_use_id: testId,
			tool_input: { file_path: "tests/account.test.ts" },
		});
		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "Write",
			tool_use_id: testId,
			tool_input: { file_path: "tests/account.test.ts" },
			tool_response: {},
		});

		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "Bash",
			tool_input: { command: "npm test" },
			tool_response: { exit_code: 0 },
		});
		assert.equal(harness.hook({ hook_event_name: "Stop", stop_hook_active: false }), undefined);
	} finally {
		harness.close();
	}
});

test("Claude recognizes nonzero Bash exit code in PostToolUse output", () => {
	const harness = harnessCreate();
	try {
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "Fix account validation" });
		for (const filePath of ["src/account.ts", "tests/account.test.ts"]) {
			const toolId = harness.nextId();
			harness.hook({
				hook_event_name: "PreToolUse",
				tool_name: "Edit",
				tool_use_id: toolId,
				tool_input: { file_path: filePath },
			});
			harness.hook({
				hook_event_name: "PostToolUse",
				tool_name: "Edit",
				tool_use_id: toolId,
				tool_input: { file_path: filePath },
				tool_response: {},
			});
		}
		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "Bash",
			tool_input: { command: "npm test" },
			tool_response: "Exit code 1\nTest failed",
		});
		assert.equal(harness.hook({ hook_event_name: "Stop" })?.decision, "block");
	} finally {
		harness.close();
	}
});

test("Claude hook preserves one-request /tdd-skip behavior", () => {
	const harness = harnessCreate();
	try {
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "/tdd-skip" });
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "Update account validation" });
		const allowed = harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "Edit",
			tool_use_id: harness.nextId(),
			tool_input: { file_path: "src/account.ts" },
		});
		assert.equal(allowed, undefined);
	} finally {
		harness.close();
	}
});

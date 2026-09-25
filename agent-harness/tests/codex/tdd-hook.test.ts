import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { codexTddHookHandle } from "#agent-harness/codex/tdd-hook";

function harnessCreate() {
	const stateDirectory = mkdtempSync(join(tmpdir(), "agent-harness-codex-tdd-"));
	let sequence = 0;
	return {
		close: () => rmSync(stateDirectory, { recursive: true, force: true }),
		hook: (event: Record<string, unknown>) =>
			codexTddHookHandle(
				{ session_id: "session-1", ...event },
				stateDirectory,
			),
			nextId: () => `tool-${++sequence}`,
	};
}

test("Codex hook allows parallel source and test edits, then requires green", () => {
	const harness = harnessCreate();
	try {
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "Fix account validation" });
		const implementationId = harness.nextId();
		assert.equal(harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "apply_patch",
			tool_use_id: implementationId,
			tool_input: { patch: "*** Begin Patch\n*** Update File: src/account.ts\n" },
		}), undefined);
		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "apply_patch",
			tool_use_id: implementationId,
			tool_input: { patch: "*** Begin Patch\n*** Update File: src/account.ts\n" },
			tool_response: {},
		});
		const sourceOnlyStop = harness.hook({ hook_event_name: "Stop", stop_hook_active: false });
		assert.equal(sourceOnlyStop?.decision, "block");
		assert.match(sourceOnlyStop?.reason, /tdd-watch status/);

		const testId = harness.nextId();
		harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "apply_patch",
			tool_use_id: testId,
			tool_input: { patch: "*** Begin Patch\n*** Add File: tests/account.test.ts\n" },
		});
		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "apply_patch",
			tool_use_id: testId,
			tool_input: { patch: "*** Begin Patch\n*** Add File: tests/account.test.ts\n" },
			tool_response: {},
		});

		harness.hook({
			hook_event_name: "PostToolUse",
			tool_name: "exec_command",
			tool_input: { cmd: ["node", "/plugin/src/cli/tdd-watch.ts", "status"] },
			tool_response: { exit_code: 0 },
		});
		assert.equal(harness.hook({ hook_event_name: "Stop", stop_hook_active: false }), undefined);
	} finally {
		harness.close();
	}
});

test("Codex hook preserves one-request /tdd-skip behavior", () => {
	const harness = harnessCreate();
	try {
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "/tdd-skip" });
		harness.hook({ hook_event_name: "UserPromptSubmit", prompt: "Update account validation" });
		const allowed = harness.hook({
			hook_event_name: "PreToolUse",
			tool_name: "apply_patch",
			tool_use_id: harness.nextId(),
			tool_input: { patch: "*** Begin Patch\n*** Update File: src/account.ts\n" },
		});
		assert.equal(allowed, undefined);
	} finally {
		harness.close();
	}
});

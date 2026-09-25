import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { tddGuardrailHandle } from "#agent-harness/hooks/tdd-guardrail";

test("shared hook state stays isolated by host session", () => {
	const stateDirectory = mkdtempSync(join(tmpdir(), "agent-harness-tdd-state-"));
	const event = (sessionId: string, eventName: string, prompt?: string) =>
		tddGuardrailHandle("claude", {
			sessionId,
			eventName,
			prompt,
			toolName: "Write",
			toolInput: { file_path: "src/account.ts" },
		}, stateDirectory);
	try {
		event("session-a", "UserPromptSubmit", "/tdd-skip");
		event("session-b", "UserPromptSubmit", "Change account validation");
		event("session-a", "UserPromptSubmit", "Change account validation");

		assert.equal(
			event("session-a", "PreToolUse"),
			undefined,
		);
		assert.equal(
			(event("session-b", "PreToolUse") as { hookSpecificOutput: { permissionDecision: string } })
				.hookSpecificOutput.permissionDecision,
			"deny",
		);
	} finally {
		rmSync(stateDirectory, { recursive: true, force: true });
	}
});

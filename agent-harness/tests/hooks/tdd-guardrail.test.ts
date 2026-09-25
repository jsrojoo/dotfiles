import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { tddGuardrailHandle } from "#agent-harness/hooks/tdd-guardrail";

test("shared hook state stays isolated by host session", () => {
	const stateDirectory = mkdtempSync(join(tmpdir(), "agent-harness-tdd-state-"));
	const event = (sessionId: string, eventName: string, prompt?: string, toolId?: string) =>
		tddGuardrailHandle("claude", {
			sessionId,
			eventName,
			prompt,
			toolId,
			toolName: "Write",
			toolInput: { file_path: "src/account.ts" },
		}, stateDirectory);
	try {
		event("session-a", "UserPromptSubmit", "/tdd-skip");
		event("session-b", "UserPromptSubmit", "Change account validation");
		event("session-a", "UserPromptSubmit", "Change account validation");

		assert.equal(event("session-a", "PreToolUse", undefined, "a-write"), undefined);
		event("session-a", "PostToolUse", undefined, "a-write");
		assert.equal(event("session-b", "PreToolUse", undefined, "b-write"), undefined);
		event("session-b", "PostToolUse", undefined, "b-write");

		assert.equal(event("session-a", "Stop"), undefined);
		assert.equal((event("session-b", "Stop") as { decision: string }).decision, "block");
	} finally {
		rmSync(stateDirectory, { recursive: true, force: true });
	}
});

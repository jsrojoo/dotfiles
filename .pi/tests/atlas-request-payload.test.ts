import assert from "node:assert/strict";
import test from "node:test";

import { atlasPayloadReasoningStatusRemove } from "../agent/extensions/atlas/request-payload.ts";

test("removes null reasoning status without changing other item fields", () => {
	const payload = {
		input: [{ type: "reasoning", status: null, summary: "considered options" }],
	};

	const sanitizedPayload = atlasPayloadReasoningStatusRemove(payload);

	assert.deepEqual(sanitizedPayload, {
		input: [{ type: "reasoning", summary: "considered options" }],
	});
});

test("removes meaningful reasoning status", () => {
	const payload = {
		input: [{ type: "reasoning", status: "completed", encrypted_content: "signature" }],
	};

	const sanitizedPayload = atlasPayloadReasoningStatusRemove(payload);

	assert.deepEqual(sanitizedPayload, {
		input: [{ type: "reasoning", encrypted_content: "signature" }],
	});
});

test("preserves non-reasoning entries in mixed input arrays", () => {
	const payload = {
		input: [
			{ type: "message", status: "completed", content: "tool result" },
			{ type: "reasoning", status: "completed", summary: "considered options" },
			{ type: "function_call", status: "in_progress", name: "read" },
		],
	};

	const sanitizedPayload = atlasPayloadReasoningStatusRemove(payload);

	assert.deepEqual(sanitizedPayload, {
		input: [
			{ type: "message", status: "completed", content: "tool result" },
			{ type: "reasoning", summary: "considered options" },
			{ type: "function_call", status: "in_progress", name: "read" },
		],
	});
});

test("safely preserves malformed payloads and missing input", () => {
	const malformedPayloads: unknown[] = [null, "payload", {}, { input: null }, { input: {} }, { input: [null, 1] }];

	for (const payload of malformedPayloads) {
		assert.equal(atlasPayloadReasoningStatusRemove(payload), payload);
	}
});

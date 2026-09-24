import assert from "node:assert/strict";
import test from "node:test";

import sqlValidationEnforcementRegister from "#agent-harness/pi/extensions/sql-validation/enforce-read-only-and-proof";

type Handler = (event: any, context: any) => any;

function harnessCreate() {
	const handlers = new Map<string, Handler>();
	const pi = {
		on(name: string, handler: Handler) {
			handlers.set(name, handler);
			return () => undefined;
		},
	};
	const context = {
		mode: "tui",
		sessionManager: { getSessionId: () => "session-1" },
	};
	sqlValidationEnforcementRegister(pi as any);
	return { context, handlers };
}

test("Pi adapter blocks agent-executed mutative SQL", async () => {
	const { context, handlers } = harnessCreate();
	const result = await handlers.get("tool_call")!(
		{
			toolName: "bash",
			input: { command: 'psql -c "UPDATE users SET active = true WHERE id = 1"' },
		},
		context,
	);

	assert.equal(result.block, true);
});

test("Pi adapter requests proof once before presenting unvalidated SQL", async () => {
	const { context, handlers } = harnessCreate();
	const turnEnd = handlers.get("turn_end")!;
	const event = {
		message: {
			role: "assistant",
			stopReason: "stop",
			content: [{ type: "text", text: "```sql\nUPDATE users SET active = true WHERE id = 1\n```" }],
		},
	};

	const first = await turnEnd(event, context);
	const second = await turnEnd(event, context);

	assert.equal(first.continue, true);
	assert.equal(first.entries[0].customType, "require-sql-validation");
	assert.equal(second, undefined);
});

test("Pi adapter accepts SQL after successful proof", async () => {
	const { context, handlers } = harnessCreate();
	await handlers.get("tool_result")!(
		{
			toolName: "bash",
			input: { command: 'psql -c "SELECT id FROM users WHERE id = 1"' },
			isError: false,
			content: [{ type: "text", text: "1" }],
		},
		context,
	);

	const result = await handlers.get("turn_end")!(
		{
			message: {
				role: "assistant",
				stopReason: "stop",
				content: [{ type: "text", text: "UPDATE users SET active = true WHERE id = 1" }],
			},
		},
		context,
	);
	assert.equal(result, undefined);
});

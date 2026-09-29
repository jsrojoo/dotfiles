import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import {
	ChildRunError,
	SUBAGENT_TERMINATION_GRACE_MS,
	runChild,
} from "#agent-harness/pi/extensions/subagent/run-child";

function spawnInline(source: string) {
	return spawn(process.execPath, ["-e", source], { stdio: "ignore" });
}

async function rejectedRun(run: Promise<unknown>): Promise<ChildRunError> {
	try {
		await run;
		assert.fail("Expected child run to reject");
	} catch (error) {
		assert.ok(error instanceof ChildRunError);
		return error;
	}
}

test("exports the production termination grace default", () => {
	assert.equal(SUBAGENT_TERMINATION_GRACE_MS, 5_000);
});

test("does not allocate a heartbeat interval when the callback is omitted", async () => {
	const child = new EventEmitter() as ChildProcess;
	Object.assign(child, { exitCode: null, signalCode: null });
	let timerAllocations = 0;
	const timerHook = createHook({
		init: (_asyncId, type) => {
			if (type === "Timeout") timerAllocations++;
		},
	});

	timerHook.enable();
	const run = runChild(child, {
		heartbeatIntervalMs: 10,
		timeoutMs: 60_000,
	});
	timerHook.disable();

	assert.equal(timerAllocations, 1, "only the timeout timer should be allocated");
	child.emit("close", 0, null);
	await run;
});

test("resolves a normal close and removes listeners and timers", async () => {
	const child = spawnInline("setTimeout(() => process.exit(0), 45)");
	const closeListeners = child.listenerCount("close");
	const errorListeners = child.listenerCount("error");
	let heartbeatCount = 0;
	let timeoutCount = 0;

	const result = await runChild(child, {
		heartbeatIntervalMs: 10,
		timeoutMs: 2_000,
		terminationGraceMs: 20,
		onHeartbeat: () => heartbeatCount++,
		onTimeout: () => timeoutCount++,
	});

	assert.equal(result.exitCode, 0);
	assert.equal(result.signal, null);
	assert.ok(result.elapsedMs >= 0);
	assert.equal(child.listenerCount("close"), closeListeners);
	assert.equal(child.listenerCount("error"), errorListeners);
	const completedHeartbeatCount = heartbeatCount;
	await delay(35);
	assert.equal(heartbeatCount, completedHeartbeatCount);
	assert.equal(timeoutCount, 0);
});

test("settles and cleans up when the heartbeat callback throws", async () => {
	const child = spawn(process.execPath, [
		"-e",
		"process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000)",
	]);
	await once(child.stdout!, "data");
	let nowMs = 0;
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	const originalKill = child.kill.bind(child);
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		nowMs = 1_000;
		return originalKill(signal);
	};
	const closeListeners = child.listenerCount("close");
	const errorListeners = child.listenerCount("error");
	let heartbeatCount = 0;
	let timeoutCount = 0;

	const error = await rejectedRun(
		runChild(child, {
			now: () => nowMs,
			heartbeatIntervalMs: 10,
			timeoutMs: 500,
			terminationGraceMs: 30,
			onHeartbeat: () => {
				heartbeatCount++;
				throw new Error("heartbeat callback failed");
			},
			onTimeout: () => timeoutCount++,
		}),
	);

	assert.equal(error.kind, "callback");
	assert.equal(error.message, "heartbeat callback failed");
	assert.match(String(error.cause), /heartbeat callback failed/);
	assert.equal(error.elapsedMs, 0);
	assert.deepEqual(sentSignals, ["SIGTERM", "SIGKILL"]);
	assert.equal(child.signalCode, "SIGKILL");
	assert.equal(child.listenerCount("close"), closeListeners);
	assert.equal(child.listenerCount("error"), errorListeners);
	const completedHeartbeatCount = heartbeatCount;
	nowMs = 2_000;
	await delay(35);
	assert.equal(error.elapsedMs, 0);
	assert.equal(heartbeatCount, completedHeartbeatCount);
	assert.equal(timeoutCount, 0);
});

test("contains clock failures from timer callbacks and settles", async () => {
	const child = spawnInline("setInterval(() => {}, 1000)");
	let calls = 0;
	const error = await rejectedRun(
		runChild(child, {
			now: () => {
				if (calls++ > 0) throw new Error("clock failed");
				return 10;
			},
			heartbeatIntervalMs: 10,
			timeoutMs: 500,
			terminationGraceMs: 30,
			onHeartbeat: () => {},
		}),
	);

	assert.equal(error.kind, "callback");
	assert.equal(error.message, "clock failed");
	assert.equal(error.elapsedMs, 0);
});

test("settles at the timeout deadline when force-stop does not produce close", async () => {
	const child = new EventEmitter() as ChildProcess;
	Object.assign(child, { exitCode: null, signalCode: null });
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		return true;
	};
	const startedAt = performance.now();

	const error = await Promise.race([
		rejectedRun(
			runChild(child, {
				heartbeatIntervalMs: 10,
				timeoutMs: 30,
				terminationGraceMs: 30,
			}),
		),
		delay(150).then(() => assert.fail("timeout result waited for child close")),
	]);

	assert.equal(error.kind, "timeout");
	assert.equal(error.elapsedMs, 30);
	assert.ok(performance.now() - startedAt < 150);
	assert.deepEqual(sentSignals, ["SIGKILL"]);
	assert.equal(child.listenerCount("close"), 0);
	assert.equal(child.listenerCount("error"), 0);
});

test("settles when process termination throws", async () => {
	const child = spawnInline("setInterval(() => {}, 1000)");
	const originalKill = child.kill.bind(child);
	child.kill = () => {
		throw new Error("kill failed");
	};

	const error = await rejectedRun(
		runChild(child, {
			heartbeatIntervalMs: 10,
			timeoutMs: 30,
			terminationGraceMs: 30,
		}),
	);
	originalKill("SIGKILL");

	assert.equal(error.kind, "timeout");
	assert.equal(error.diagnostic, error.message);
	assert.match(error.message, /Subagent timed out/);
});

test("does not signal a child that exited before close", async () => {
	const child = spawn(process.execPath, [
		"-e",
		`const { spawn } = require("node:child_process");
const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, 150)"], {
	stdio: ["ignore", 1, "ignore"],
});
grandchild.unref();
process.exit(0);`,
	]);
	const controller = new AbortController();
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	const originalKill = child.kill.bind(child);
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		return originalKill(signal);
	};
	let closed = false;
	const closePromise = once(child, "close");
	child.once("close", () => {
		closed = true;
	});
	child.once("exit", () => controller.abort("abort after exit"));

	await rejectedRun(
		runChild(child, {
			signal: controller.signal,
			heartbeatIntervalMs: 10,
			timeoutMs: 500,
			terminationGraceMs: 30,
		}),
	);

	assert.equal(child.exitCode, 0);
	assert.equal(closed, false);
	assert.deepEqual(sentSignals, []);
	await closePromise;
});

test("times out an exited child when inherited stdio withholds close", async () => {
	const child = spawn(process.execPath, [
		"-e",
		`const { spawn } = require("node:child_process");
const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, 250)"], {
	stdio: ["ignore", 1, "ignore"],
});
grandchild.unref();
process.stdout.write("ready");
setTimeout(() => process.exit(0), 10);`,
	]);
	await once(child.stdout!, "data");
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	const originalKill = child.kill.bind(child);
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		return originalKill(signal);
	};
	let timeoutCount = 0;
	let closed = false;
	const closePromise = once(child, "close");
	child.once("close", () => {
		closed = true;
	});

	const error = await rejectedRun(
		runChild(child, {
			heartbeatIntervalMs: 10,
			timeoutMs: 50,
			terminationGraceMs: 30,
			onTimeout: () => timeoutCount++,
		}),
	);

	assert.equal(error.kind, "timeout");
	assert.equal(error.elapsedMs, 50);
	assert.equal(child.exitCode, 0);
	assert.equal(closed, false);
	assert.equal(timeoutCount, 1);
	assert.deepEqual(sentSignals, []);
	await closePromise;
});

test("force-stops a timed-out child without waiting for close", async () => {
	const child = spawn(process.execPath, [
		"-e",
		`const { spawn } = require("node:child_process");
const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => {}, 150)"], {
	stdio: ["ignore", 1, "ignore"],
});
grandchild.unref();
process.on("SIGTERM", () => {});
process.stdout.write("ready");
setInterval(() => {}, 1000);`,
	]);
	await once(child.stdout!, "data");
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	const originalKill = child.kill.bind(child);
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		return originalKill(signal);
	};

	const error = await rejectedRun(
		runChild(child, {
			heartbeatIntervalMs: 10,
			timeoutMs: 30,
			terminationGraceMs: 50,
		}),
	);

	assert.equal(error.kind, "timeout");
	assert.equal(error.elapsedMs, 30);
	assert.deepEqual(sentSignals, ["SIGKILL"]);
});

test("freezes elapsed time and cleans up after a process error", async () => {
	const child = spawn("/definitely/not/a/real/executable", [], { stdio: "ignore" });
	const closeListeners = child.listenerCount("close");
	const errorListeners = child.listenerCount("error");
	let nowMs = 10;
	let heartbeatCount = 0;
	let timeoutCount = 0;
	const run = runChild(child, {
		now: () => nowMs,
		heartbeatIntervalMs: 10,
		timeoutMs: 30,
		onHeartbeat: () => heartbeatCount++,
		onTimeout: () => timeoutCount++,
	});
	nowMs = 25;

	const error = await rejectedRun(run);
	assert.equal(error.kind, "process");
	assert.equal(error.elapsedMs, 15);
	assert.equal(child.listenerCount("close"), closeListeners);
	assert.equal(child.listenerCount("error"), errorListeners);
	nowMs = 1_000;
	await delay(40);
	assert.equal(error.elapsedMs, 15);
	assert.equal(heartbeatCount, 0);
	assert.equal(timeoutCount, 0);
});

test("enforces a wall-clock timeout and reports its timing-policy diagnostic", async () => {
	const child = spawnInline("setInterval(() => {}, 1000)");
	let diagnostic: string | undefined;
	let timeoutElapsedMs: number | undefined;
	const error = await rejectedRun(
		runChild(child, {
			heartbeatIntervalMs: 10,
			timeoutMs: 60,
			terminationGraceMs: 100,
			onTimeout: (message, elapsedMs) => {
				diagnostic = message;
				timeoutElapsedMs = elapsedMs;
			},
		}),
	);

	assert.equal(error.kind, "timeout");
	assert.equal(error.diagnostic, diagnostic);
	assert.equal(error.elapsedMs, timeoutElapsedMs);
	assert.match(error.message, /Subagent timed out after .*\(limit <0\.1s\)/);
	assert.ok(error.elapsedMs >= 35, `timeout fired unexpectedly early at ${error.elapsedMs}ms`);
});

test("distinguishes caller abort from timeout", async () => {
	const child = spawnInline("setInterval(() => {}, 1000)");
	const controller = new AbortController();
	let timeoutCount = 0;
	const run = runChild(child, {
		signal: controller.signal,
		heartbeatIntervalMs: 10,
		timeoutMs: 500,
		terminationGraceMs: 50,
		onTimeout: () => timeoutCount++,
	});
	setTimeout(() => controller.abort("test abort"), 35);

	const error = await rejectedRun(run);
	assert.equal(error.kind, "aborted");
	assert.equal(error.cause, "test abort");
	assert.equal(timeoutCount, 0);
});

test("contains timeout callback errors, force-stops, cleans up, and freezes elapsed time", async () => {
	const child = spawn(process.execPath, [
		"-e",
		"process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000)",
	]);
	await once(child.stdout!, "data");
	const sentSignals: (NodeJS.Signals | number | undefined)[] = [];
	const originalKill = child.kill.bind(child);
	child.kill = (signal?: NodeJS.Signals | number) => {
		sentSignals.push(signal);
		return originalKill(signal);
	};
	const closeListeners = child.listenerCount("close");
	const errorListeners = child.listenerCount("error");
	let heartbeatCount = 0;
	let timeoutCount = 0;
	const error = await rejectedRun(
		runChild(child, {
			heartbeatIntervalMs: 10,
			timeoutMs: 100,
			terminationGraceMs: 50,
			onHeartbeat: () => heartbeatCount++,
			onTimeout: () => {
				timeoutCount++;
				throw new Error("timeout callback failed");
			},
		}),
	);

	assert.equal(error.kind, "timeout");
	assert.equal(error.diagnostic, error.message);
	assert.deepEqual(sentSignals, ["SIGKILL"]);
	assert.equal(child.listenerCount("close"), closeListeners);
	assert.equal(child.listenerCount("error"), errorListeners);
	const frozenElapsedMs = error.elapsedMs;
	const completedHeartbeatCount = heartbeatCount;
	await delay(80);
	assert.equal(error.elapsedMs, frozenElapsedMs);
	assert.equal(heartbeatCount, completedHeartbeatCount);
	assert.equal(timeoutCount, 1);
});

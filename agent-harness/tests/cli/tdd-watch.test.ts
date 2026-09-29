import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
	changedFileLatestMs,
	tddWatchLockAcquire,
	tddWatchLockPath,
	tddWatchLockRelease,
	tddWatchStatusEvaluate,
	tddWatchStatusPath,
	tddWatchRun,
	tddWatchWatchexecArguments,
} from "#agent-harness/cli/tdd-watch";

function temporaryWorkspace(t: test.TestContext): string {
	const workspace = mkdtempSync(join(tmpdir(), "tdd-watch-test-"));
	t.after(() => rmSync(workspace, { recursive: true, force: true }));
	return workspace;
}

test("watch status is green only for a fresh completed pass", () => {
	const passed = { command: ["npm", "test"], state: "passed" as const, startedAtMs: 20 };

	assert.equal(tddWatchStatusEvaluate(passed, 10).green, true);
	assert.equal(tddWatchStatusEvaluate(passed, 21).green, false);
	assert.equal(tddWatchStatusEvaluate({ ...passed, state: "running" }, 10).green, false);
	assert.equal(tddWatchStatusEvaluate({ ...passed, state: "failed" }, 10).green, false);
	assert.equal(tddWatchStatusEvaluate(undefined, 10).green, false);
});

test("watch status compares the exact command token vector", () => {
	const status = {
		command: ["node", "--test", "test file.ts"],
		state: "passed" as const,
		startedAtMs: 20,
	};

	assert.equal(tddWatchStatusEvaluate(status, 10, [...status.command]).green, true);
	assert.match(
		tddWatchStatusEvaluate(status, 10, ["node --test", "test file.ts"]).reason,
		/does not match/,
	);
	assert.equal(tddWatchStatusEvaluate(status, 10).green, true);
});

test("watch status rejects malformed recorded state", () => {
	assert.match(tddWatchStatusEvaluate({ state: "passed", startedAtMs: 20 }, 10).reason, /malformed/);
	assert.match(
		tddWatchStatusEvaluate({ command: ["test"], state: "unknown", startedAtMs: 20 }, 10).reason,
		/malformed/,
	);
	assert.match(
		tddWatchStatusEvaluate({ command: [1], state: "passed", startedAtMs: 20 }, 10).reason,
		/malformed/,
	);
});

test("watchexec arguments use native debounce, ignores, and exact command tokens", () => {
	const command = ["node", "--test", "test file.ts", "value with spaces"];
	const args = tddWatchWatchexecArguments("/tmp/tdd-watch.ts", command);

	assert.deepEqual(args.slice(0, 4), ["--restart", "--shell=none", "--debounce", "100ms"]);
	for (const pattern of ["node_modules/**", ".git/**", "coverage/**", "dist/**", "build/**"]) {
		const index = args.indexOf(pattern);
		assert.ok(index > 0);
		assert.equal(args[index - 1], "--ignore");
	}
	assert.deepEqual(args.slice(-command.length), command);
});

test("outer watcher lock rejects a live duplicate and cleans up its owner", (t) => {
	const workspace = temporaryWorkspace(t);
	const lock = tddWatchLockAcquire(workspace, ["node", "--test"]);

	assert.throws(
		() => tddWatchLockAcquire(workspace, ["node", "--test"]),
		/already running/,
	);
	tddWatchLockRelease(lock);
	assert.equal(existsSync(lock.path), false);
});

test("outer watcher lock recovers stale metadata", (t) => {
	const workspace = temporaryWorkspace(t);
	const path = tddWatchLockPath(workspace);
	writeFileSync(path, JSON.stringify({
		pid: 2_147_483_647,
		workspace: resolve(workspace),
		command: ["old"],
		startedAtMs: 1,
	}));

	const lock = tddWatchLockAcquire(workspace, ["new", "two tokens"]);
	assert.equal(lock.path, path);
	tddWatchLockRelease(lock);
	assert.equal(existsSync(path), false);
});

test("outer watcher lock rejects malformed metadata with a live pid", (t) => {
	const workspace = temporaryWorkspace(t);
	const path = tddWatchLockPath(workspace);
	writeFileSync(path, JSON.stringify({ pid: process.pid }));

	const lock = tddWatchLockAcquire(workspace, ["new"]);
	tddWatchLockRelease(lock);
	assert.equal(existsSync(path), false);
});

test("watch releases its lock when spawn throws synchronously", async (t) => {
	const workspace = temporaryWorkspace(t);
	const path = tddWatchLockPath(workspace);
	const spawnFailure = (() => {
		throw new Error("spawn failed");
	}) as typeof spawn;

	await assert.rejects(tddWatchRun(workspace, ["node", "--test"], spawnFailure), /spawn failed/);
	assert.equal(existsSync(path), false);
});

test("watch retains its lock until a signaled child exits", async (t) => {
	const workspace = temporaryWorkspace(t);
	const path = tddWatchLockPath(workspace);
	const previousExitCode = process.exitCode;
	const child = new EventEmitter() as EventEmitter & {
		kill: (signal?: NodeJS.Signals | number) => boolean;
	};
	child.kill = (signal) => {
		assert.equal(signal, "SIGTERM");
		assert.equal(existsSync(path), true);
		queueMicrotask(() => child.emit("exit", null, signal));
		return true;
	};
	const spawnChild = (() => child) as unknown as typeof spawn;

	try {
		const run = tddWatchRun(workspace, ["node", "--test"], spawnChild);
		assert.equal(existsSync(path), true);
		process.emit("SIGTERM", "SIGTERM");
		await run;
		assert.equal(existsSync(path), false);
	} finally {
		process.exitCode = previousExitCode;
	}
});

test("watch status checks dirty files outside a repository subdirectory", (t) => {
	const repository = temporaryWorkspace(t);
	const workspace = join(repository, "packages", "app");
	const dirtyPath = join(repository, "outside", "dirty.txt");
	mkdirSync(workspace, { recursive: true });
	mkdirSync(join(repository, "outside"));
	assert.equal(spawnSync("git", ["init"], { cwd: repository }).status, 0);
	writeFileSync(dirtyPath, "dirty");

	assert.equal(changedFileLatestMs(workspace), statSync(dirtyPath).mtimeMs);
});

test("watch status path is stable per workspace", () => {
	assert.equal(tddWatchStatusPath("/tmp/project"), tddWatchStatusPath("/tmp/project"));
	assert.notEqual(tddWatchStatusPath("/tmp/project"), tddWatchStatusPath("/tmp/other"));
});

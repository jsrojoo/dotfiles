#!/usr/bin/env -S node --experimental-strip-types

import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
	closeSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface TddWatchStatus {
	command: string[];
	state: "running" | "passed" | "failed";
	startedAtMs: number;
}

export interface TddWatchDecision {
	green: boolean;
	reason: string;
}

export interface TddWatchLockMetadata {
	pid: number;
	workspace: string;
	command: string[];
	startedAtMs: number;
}

export interface TddWatchLock {
	path: string;
	contents: string;
}

export function tddWatchStatusPath(workspace: string): string {
	const workspaceHash = createHash("sha256").update(resolve(workspace)).digest("hex");
	return join(tmpdir(), "agent-harness-tdd-watch", `${workspaceHash}.json`);
}

export function tddWatchStatusEvaluate(
	status: unknown,
	latestChangeMs: number,
	expectedCommand?: string[],
): TddWatchDecision {
	if (status === undefined) return { green: false, reason: "No watcher result found." };
	if (!tddWatchStatusIsValid(status)) {
		return { green: false, reason: "Watcher result is malformed." };
	}
	if (expectedCommand && !commandEqual(status.command, expectedCommand)) {
		return { green: false, reason: "Watcher command does not match expected command." };
	}
	if (status.state !== "passed") {
		return { green: false, reason: `Latest watcher run is ${status.state}.` };
	}
	if (status.startedAtMs < latestChangeMs) {
		return { green: false, reason: "Latest passing watcher run predates changed files." };
	}
	return { green: true, reason: "Latest watcher run passed after changed files." };
}

function commandEqual(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((token, index) => token === right[index]);
}

function tddWatchStatusIsValid(value: unknown): value is TddWatchStatus {
	if (!value || typeof value !== "object") return false;
	const status = value as Partial<TddWatchStatus>;
	return Array.isArray(status.command)
		&& status.command.every((token) => typeof token === "string")
		&& (status.state === "running" || status.state === "passed" || status.state === "failed")
		&& typeof status.startedAtMs === "number"
		&& Number.isFinite(status.startedAtMs);
}

function statusWrite(path: string, status: TddWatchStatus): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(status), { mode: 0o600 });
	renameSync(temporaryPath, path);
}

function statusRead(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		if ((error as { code?: string }).code === "ENOENT") return undefined;
		if (error instanceof SyntaxError) return null;
		throw error;
	}
}

export function tddWatchLockPath(workspace: string): string {
	return `${tddWatchStatusPath(workspace)}.lock`;
}

function tddWatchLockMetadataIsValid(
	value: unknown,
	workspace: string,
): value is TddWatchLockMetadata {
	if (!value || typeof value !== "object") return false;
	const metadata = value as Partial<TddWatchLockMetadata>;
	return Number.isInteger(metadata.pid)
		&& (metadata.pid ?? 0) > 0
		&& metadata.workspace === workspace
		&& Array.isArray(metadata.command)
		&& metadata.command.every((token) => typeof token === "string")
		&& typeof metadata.startedAtMs === "number"
		&& Number.isFinite(metadata.startedAtMs);
}

function processIsLive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as { code?: string }).code !== "ESRCH";
	}
}

export function tddWatchLockAcquire(workspace: string, command: string[]): TddWatchLock {
	const resolvedWorkspace = resolve(workspace);
	const path = tddWatchLockPath(resolvedWorkspace);
	const contents = JSON.stringify({
		pid: process.pid,
		workspace: resolvedWorkspace,
		command: [...command],
		startedAtMs: Date.now(),
	} satisfies TddWatchLockMetadata);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

	for (;;) {
		try {
			const descriptor = openSync(path, "wx", 0o600);
			try {
				writeFileSync(descriptor, contents);
			} finally {
				closeSync(descriptor);
			}
			return { path, contents };
		} catch (error) {
			if ((error as { code?: string }).code !== "EEXIST") throw error;
			let existing: unknown;
			try {
				existing = JSON.parse(readFileSync(path, "utf8"));
			} catch (readError) {
				if ((readError as { code?: string }).code === "ENOENT") continue;
			}
			if (tddWatchLockMetadataIsValid(existing, resolvedWorkspace) && processIsLive(existing.pid)) {
				throw new Error(`A tdd-watch watcher is already running for ${resolvedWorkspace} (pid ${existing.pid}).`);
			}
			try {
				unlinkSync(path);
			} catch (unlinkError) {
				if ((unlinkError as { code?: string }).code !== "ENOENT") throw unlinkError;
			}
		}
	}
}

export function tddWatchLockRelease(lock: TddWatchLock): void {
	try {
		if (readFileSync(lock.path, "utf8") === lock.contents) unlinkSync(lock.path);
	} catch (error) {
		if ((error as { code?: string }).code !== "ENOENT") throw error;
	}
}

export function changedFileLatestMs(workspace: string): number {
	const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd: workspace,
		encoding: "utf8",
	});
	if (rootResult.status !== 0) throw new Error("tdd-watch status requires a Git workspace.");
	const repositoryRoot = rootResult.stdout.trim();
	const result = spawnSync(
		"git",
		["status", "--porcelain=v1", "-z", "--untracked-files=all"],
		{ cwd: workspace, encoding: "utf8" },
	);
	if (result.status !== 0) throw new Error("tdd-watch status requires a Git workspace.");

	let latest = 0;
	const entries = result.stdout.split("\0").filter(Boolean);
	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		const status = entry.slice(0, 2);
		const path = entry.slice(3);
		if (status.includes("R") || status.includes("C")) index += 1;
		const changedPath = join(repositoryRoot, path);
		try {
			latest = Math.max(latest, statSync(changedPath).mtimeMs);
		} catch {
			latest = Math.max(latest, statSync(dirname(changedPath)).mtimeMs);
		}
	}
	return latest;
}

function commandArguments(args: string[]): string[] {
	const separator = args.indexOf("--");
	return [...(separator === -1 ? args : args.slice(separator + 1))];
}

export function tddWatchWatchexecArguments(modulePath: string, command: string[]): string[] {
	return [
		"--restart",
		"--shell=none",
		"--debounce",
		"100ms",
		...[
			"node_modules/**",
			".git/**",
			"coverage/**",
			"dist/**",
			"build/**",
		].flatMap((pattern) => ["--ignore", pattern]),
		"--",
		process.execPath,
		"--experimental-strip-types",
		modulePath,
		"run",
		"--",
		...command,
	];
}

export async function tddWatchRun(
	workspace: string,
	command: string[],
	spawnChild: typeof spawn = spawn,
): Promise<void> {
	if (command.length === 0) throw new Error("Usage: tdd-watch watch -- <test command>");
	const lock = tddWatchLockAcquire(workspace, command);
	const signalHandlers: Array<readonly [NodeJS.Signals, () => void]> = [];
	try {
		const child = spawnChild(
			"watchexec",
			tddWatchWatchexecArguments(fileURLToPath(import.meta.url), command),
			{ cwd: workspace, stdio: "inherit" },
		);
		const handledSignals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
		for (const signal of handledSignals) {
			const handler = (): void => {
				child.kill(signal);
			};
			process.once(signal, handler);
			signalHandlers.push([signal, handler]);
		}
		process.exitCode = await new Promise<number>((resolveExit, reject) => {
			child.on("error", reject);
			child.on("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
		});
	} finally {
		for (const [signal, handler] of signalHandlers) process.off(signal, handler);
		tddWatchLockRelease(lock);
	}
}

async function testRun(workspace: string, command: string[]): Promise<void> {
	if (command.length === 0) throw new Error("Missing test command.");
	const path = tddWatchStatusPath(workspace);
	const startedAtMs = Date.now();
	statusWrite(path, { command, state: "running", startedAtMs });
	const child = spawn(command[0], command.slice(1), { cwd: workspace, stdio: "inherit" });
	const code = await new Promise<number>((resolveExit, reject) => {
		child.on("error", reject);
		child.on("exit", (exitCode) => resolveExit(exitCode ?? 1));
	});
	statusWrite(path, { command, state: code === 0 ? "passed" : "failed", startedAtMs });
	process.exitCode = code;
}

async function main(): Promise<void> {
	const [action, ...args] = process.argv.slice(2);
	const workspace = process.cwd();
	if (action === "watch") return tddWatchRun(workspace, commandArguments(args));
	if (action === "run") return testRun(workspace, commandArguments(args));
	if (action === "status") {
		const expectedCommand = commandArguments(args);
		const decision = tddWatchStatusEvaluate(
			statusRead(tddWatchStatusPath(workspace)),
			changedFileLatestMs(workspace),
			expectedCommand.length === 0 ? undefined : expectedCommand,
		);
		process.stdout.write(`${decision.reason}\n`);
		process.exitCode = decision.green ? 0 : 1;
		return;
	}
	throw new Error("Usage: tdd-watch <watch|status> [-- <test command>]");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	main().catch((error) => {
		process.stderr.write(`${String(error)}\n`);
		process.exitCode = 1;
	});
}

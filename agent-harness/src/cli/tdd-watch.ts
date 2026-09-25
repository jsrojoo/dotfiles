#!/usr/bin/env -S node --experimental-strip-types

import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	statSync,
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

export function tddWatchStatusPath(workspace: string): string {
	const workspaceHash = createHash("sha256").update(resolve(workspace)).digest("hex");
	return join(tmpdir(), "agent-harness-tdd-watch", `${workspaceHash}.json`);
}

export function tddWatchStatusEvaluate(
	status: TddWatchStatus | undefined,
	latestChangeMs: number,
): TddWatchDecision {
	if (!status) return { green: false, reason: "No watcher result found." };
	if (status.state !== "passed") {
		return { green: false, reason: `Latest watcher run is ${status.state}.` };
	}
	if (status.startedAtMs < latestChangeMs) {
		return { green: false, reason: "Latest passing watcher run predates changed files." };
	}
	return { green: true, reason: "Latest watcher run passed after changed files." };
}

function statusWrite(path: string, status: TddWatchStatus): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(status), { mode: 0o600 });
	renameSync(temporaryPath, path);
}

function statusRead(path: string): TddWatchStatus | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as TddWatchStatus;
	} catch (error) {
		if ((error as { code?: string }).code === "ENOENT" || error instanceof SyntaxError) return undefined;
		throw error;
	}
}

function changedFileLatestMs(workspace: string): number {
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
		try {
			latest = Math.max(latest, statSync(join(workspace, path)).mtimeMs);
		} catch {
			latest = Math.max(latest, statSync(dirname(join(workspace, path))).mtimeMs);
		}
	}
	return latest;
}

function commandArguments(args: string[]): string[] {
	const separator = args.indexOf("--");
	return separator === -1 ? args : args.slice(separator + 1);
}

async function watchRun(workspace: string, command: string[]): Promise<void> {
	if (command.length === 0) throw new Error("Usage: tdd-watch watch -- <test command>");
	const modulePath = fileURLToPath(import.meta.url);
	const child = spawn(
		"watchexec",
		[
			"--restart",
			"--shell=none",
			"--",
			process.execPath,
			"--experimental-strip-types",
			modulePath,
			"run",
			"--",
			...command,
		],
		{ cwd: workspace, stdio: "inherit" },
	);
	process.exitCode = await new Promise<number>((resolveExit, reject) => {
		child.on("error", reject);
		child.on("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
	});
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
	if (action === "watch") return watchRun(workspace, commandArguments(args));
	if (action === "run") return testRun(workspace, commandArguments(args));
	if (action === "status") {
		const decision = tddWatchStatusEvaluate(
			statusRead(tddWatchStatusPath(workspace)),
			changedFileLatestMs(workspace),
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

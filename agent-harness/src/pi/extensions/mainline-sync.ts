import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type MainlineSyncCommandResult = {
	exitCode: number;
	stderr: string;
	stdout: string;
};

export type MainlineSyncDependencies = {
	gitRun: (cwd: string, args: string[]) => Promise<MainlineSyncCommandResult>;
	lockRun: <T>(lockPath: string, action: () => Promise<T>) => Promise<T>;
	stateRead: (statePath: string) => Promise<number>;
	stateWrite: (statePath: string, count: number) => Promise<void>;
};

const mainlineSyncGitRun = (cwd: string, args: string[]): Promise<MainlineSyncCommandResult> => new Promise((resolve) => {
	const child = spawn("git", args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => { stdout += String(chunk); });
	child.stderr.on("data", (chunk) => { stderr += String(chunk); });
	child.on("error", (error) => resolve({ exitCode: -1, stderr: error.message, stdout }));
	child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stderr, stdout }));
});

export const mainlineSyncLockRun = async <T>(lockPath: string, action: () => Promise<T>): Promise<T> => {
	while (true) {
		try {
			await fs.promises.mkdir(lockPath);
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
	}
	try {
		return await action();
	} finally {
		await fs.promises.rmdir(lockPath);
	}
};

export const mainlineSyncStateRead = async (statePath: string): Promise<number> => {
	try {
		const count = Number.parseInt(await fs.promises.readFile(statePath, "utf8"), 10);
		return Number.isSafeInteger(count) && count >= 0 ? count : 0;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
		throw error;
	}
};

export const mainlineSyncStateWrite = async (statePath: string, count: number): Promise<void> => {
	const temporaryPath = `${statePath}.${process.pid}.tmp`;
	await fs.promises.writeFile(temporaryPath, String(count), "utf8");
	await fs.promises.rename(temporaryPath, statePath);
};

const mainlineSyncDependencies: MainlineSyncDependencies = {
	gitRun: mainlineSyncGitRun,
	lockRun: mainlineSyncLockRun,
	stateRead: mainlineSyncStateRead,
	stateWrite: mainlineSyncStateWrite,
};

export async function mainlineSyncBeforeTool(
	toolName: string,
	cwd: string,
	dependencies: MainlineSyncDependencies = mainlineSyncDependencies,
): Promise<{ block: true; reason: string } | undefined> {
	if (toolName !== "read" && toolName !== "edit") return;

	const gitDirectory = await dependencies.gitRun(cwd, ["rev-parse", "--git-dir"]);
	if (gitDirectory.exitCode !== 0) {
		return { block: true, reason: `Mainline synchronization failed: ${gitDirectory.stderr.trim() || "unable to locate the worktree Git directory"}` };
	}
	const resolvedGitDirectory = path.resolve(cwd, gitDirectory.stdout.trim());
	const gitCommonDirectory = await dependencies.gitRun(cwd, ["rev-parse", "--git-common-dir"]);
	if (gitCommonDirectory.exitCode !== 0) {
		return { block: true, reason: `Mainline synchronization failed: ${gitCommonDirectory.stderr.trim() || "unable to locate the common Git directory"}` };
	}
	const resolvedGitCommonDirectory = path.resolve(cwd, gitCommonDirectory.stdout.trim());
	if (resolvedGitDirectory === resolvedGitCommonDirectory) return;

	const coordinationDirectory = resolvedGitDirectory;
	const statePath = path.join(coordinationDirectory, "pi-mainline-sync-count");
	const lockPath = path.join(coordinationDirectory, "pi-mainline-sync.lock");

	try {
		return await dependencies.lockRun(lockPath, async () => {
			const count = await dependencies.stateRead(statePath);
			if (count % 20 === 0) {
				const upstream = await dependencies.gitRun(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
				if (upstream.exitCode !== 0) {
					return { block: true as const, reason: `Mainline synchronization failed: ${upstream.stderr.trim() || "the current branch has no configured upstream"}` };
				}
				const pull = await dependencies.gitRun(cwd, ["pull", "--rebase", "--autostash"]);
				if (pull.exitCode !== 0) {
					return { block: true as const, reason: `Mainline synchronization failed: ${pull.stderr.trim() || "git pull failed"}` };
				}
			}
			await dependencies.stateWrite(statePath, count + 1);
		});
	} catch (error) {
		return { block: true, reason: `Mainline synchronization failed: ${error instanceof Error ? error.message : String(error)}` };
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => mainlineSyncBeforeTool(event.toolName, ctx.cwd));
}

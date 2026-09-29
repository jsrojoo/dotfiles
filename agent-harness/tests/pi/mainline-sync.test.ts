import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import {
	mainlineSyncBeforeTool,
	mainlineSyncLockRun,
	mainlineSyncStateRead,
	mainlineSyncStateWrite,
	type MainlineSyncCommandResult,
	type MainlineSyncDependencies,
} from "#agent-harness/pi/extensions/mainline-sync";

const extensionPath = "agent-harness/src/pi/extensions/mainline-sync.ts";
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

function configuredExtensions(relativePath: string): string[] {
	const source = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
	const yaml = source.match(/^extensions:\s*(.+)$/m)?.[1];
	const toml = source.match(/^extensions\s*=\s*"([^"]*)"$/m)?.[1];
	return (yaml ?? toml ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

test("only the intended agent configurations enable mainline synchronization", () => {
	for (const configPath of [
		".pi/agent/agents/editor.md",
		".pi/agent/agents/editor-worker.md",
		"agent-harness/agents/context.toml",
		"agent-harness/agents/context-retriever.toml",
	]) {
		assert.ok(configuredExtensions(configPath).includes(extensionPath), configPath);
	}
	assert.ok(!configuredExtensions("agent-harness/agents/git.toml").includes(extensionPath));
});

function commandResult(overrides: Partial<MainlineSyncCommandResult> = {}): MainlineSyncCommandResult {
	return { exitCode: 0, stderr: "", stdout: "", ...overrides };
}

async function withTemporaryDirectory(action: (directory: string) => Promise<void>): Promise<void> {
	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mainline-sync-test-"));
	try {
		await action(directory);
	} finally {
		await fs.promises.rm(directory, { recursive: true, force: true });
	}
}

function realCoordinationDependencies(
	gitRun: MainlineSyncDependencies["gitRun"],
): MainlineSyncDependencies {
	return {
		gitRun,
		lockRun: mainlineSyncLockRun,
		pathExists: () => false,
		stateRead: mainlineSyncStateRead,
		stateWrite: mainlineSyncStateWrite,
	};
}

test("primary checkout skips synchronization before counters and pull", async () => {
	await withTemporaryDirectory(async (directory) => {
		const calls: string[][] = [];
		const dependencies: MainlineSyncDependencies = {
			gitRun: async (_cwd, args) => {
				calls.push(args);
				return commandResult({ stdout: `.git\n${path.join(directory, ".git")}\n` });
			},
			lockRun: async () => { throw new Error("lock must not run"); },
			pathExists: () => false,
			stateRead: async () => { throw new Error("counter must not be read"); },
			stateWrite: async () => { throw new Error("counter must not be written"); },
		};

		assert.equal(await mainlineSyncBeforeTool("read", directory, dependencies), undefined);
		assert.deepEqual(calls, [
			["rev-parse", "--git-dir", "--git-common-dir"],
		]);
	});
});

test("malformed Git directory output blocks synchronization", async () => {
	const calls: string[][] = [];
	const dependencies: MainlineSyncDependencies = {
		gitRun: async (_cwd, args) => {
			calls.push(args);
			return commandResult({ stdout: ".git\n" });
		},
		lockRun: async () => { throw new Error("lock must not run"); },
		pathExists: () => false,
		stateRead: async () => { throw new Error("counter must not be read"); },
		stateWrite: async () => { throw new Error("counter must not be written"); },
	};

	assert.deepEqual(await mainlineSyncBeforeTool("read", "/repo", dependencies), {
		block: true,
		reason: "Mainline synchronization failed: invalid Git directory output",
	});
	assert.deepEqual(calls, [["rev-parse", "--git-dir", "--git-common-dir"]]);
});

test("linked worktree enables synchronization when Git and common directories differ", async () => {
	await withTemporaryDirectory(async (directory) => {
		const calls: string[][] = [];
		let writtenCount: number | undefined;
		const dependencies: MainlineSyncDependencies = {
			gitRun: async (_cwd, args) => {
				calls.push(args);
				if (args[1] === "--git-dir") return commandResult({ stdout: ".git/worktrees/topic\n.git\n" });
				if (args.includes("@{u}")) return commandResult({ stdout: "origin/topic\n" });
				return commandResult();
			},
			lockRun: async (_lockPath, action) => action(),
			pathExists: () => false,
			stateRead: async () => 0,
			stateWrite: async (_statePath, count) => { writtenCount = count; },
		};

		assert.equal(await mainlineSyncBeforeTool("edit", directory, dependencies), undefined);
		assert.equal(writtenCount, 1);
		assert.deepEqual(calls, [
			["rev-parse", "--git-dir", "--git-common-dir"],
			["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
			["pull", "--rebase", "--autostash"],
		]);
	});
});

test("active Git operations skip synchronization and allow recovery edits", async () => {
	for (const activeMarker of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
		await withTemporaryDirectory(async (directory) => {
			const gitDirectory = path.join(directory, "git");
			const calls: string[][] = [];
			const dependencies: MainlineSyncDependencies = {
				gitRun: async (_cwd, args) => {
					calls.push(args);
					return commandResult({ stdout: `${gitDirectory}\n${path.join(directory, "common-git")}` });
				},
				lockRun: async () => { throw new Error("lock must not run"); },
				pathExists: (candidatePath) => candidatePath === path.join(gitDirectory, activeMarker),
				stateRead: async () => { throw new Error("counter must not be read"); },
				stateWrite: async () => { throw new Error("counter must not be written"); },
			};

			assert.equal(await mainlineSyncBeforeTool("edit", directory, dependencies), undefined);
			assert.deepEqual(calls, [
				["rev-parse", "--git-dir", "--git-common-dir"],
			]);
		});
	}
});

test("read and edit share a counter, pull on calls 1, 21, and 41, and ignored tools do not increment", async () => {
	await withTemporaryDirectory(async (directory) => {
		const gitDirectory = path.join(directory, "git");
		await fs.promises.mkdir(gitDirectory);
		const calls: string[][] = [];
		const pullCalls: number[] = [];
		let currentCall = 0;
		const dependencies = realCoordinationDependencies(async (_cwd, args) => {
			calls.push(args);
			if (args[0] === "pull") pullCalls.push(currentCall);
			if (args[0] === "rev-parse" && args[1] === "--git-dir") {
				return commandResult({ stdout: `${gitDirectory}\n${path.join(directory, "common-git")}\n` });
			}
			if (args.includes("@{u}")) return commandResult({ stdout: "origin/topic\n" });
			return commandResult();
		});

		await mainlineSyncBeforeTool("bash", directory, dependencies);
		assert.equal(calls.length, 0);
		for (let call = 1; call <= 41; call++) {
			currentCall = call;
			await mainlineSyncBeforeTool(call % 2 ? "read" : "edit", directory, dependencies);
		}

		assert.equal(await mainlineSyncStateRead(path.join(gitDirectory, "pi-mainline-sync-count")), 41);
		assert.deepEqual(pullCalls, [1, 21, 41]);
		assert.equal(calls.filter((args) => args[0] === "pull").length, 3);
		assert.deepEqual(calls.filter((args) => args[0] === "pull"), [
			["pull", "--rebase", "--autostash"],
			["pull", "--rebase", "--autostash"],
			["pull", "--rebase", "--autostash"],
		]);
	});
});

test("requires the current branch upstream and exposes a missing-upstream failure", async () => {
	await withTemporaryDirectory(async (directory) => {
		const gitDirectory = path.join(directory, "git");
		await fs.promises.mkdir(gitDirectory);
		const calls: string[][] = [];
		const dependencies = realCoordinationDependencies(async (_cwd, args) => {
			calls.push(args);
			if (args[1] === "--git-dir") return commandResult({ stdout: `${gitDirectory}\n${path.join(directory, "common-git")}` });
			return commandResult({ exitCode: 128, stderr: "fatal: no upstream configured" });
		});

		const result = await mainlineSyncBeforeTool("read", directory, dependencies);

		assert.match(result?.reason ?? "", /fatal: no upstream configured/);
		assert.deepEqual(calls, [
			["rev-parse", "--git-dir", "--git-common-dir"],
			["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
		]);
		assert.equal(await mainlineSyncStateRead(path.join(gitDirectory, "pi-mainline-sync-count")), 0);
	});
});

test("a pull failure blocks the tool and does not record a successful call", async () => {
	await withTemporaryDirectory(async (directory) => {
		const gitDirectory = path.join(directory, "git");
		await fs.promises.mkdir(gitDirectory);
		const dependencies = realCoordinationDependencies(async (_cwd, args) => {
			if (args[1] === "--git-dir") return commandResult({ stdout: `${gitDirectory}\n${path.join(directory, "common-git")}` });
			if (args[0] === "pull") return commandResult({ exitCode: 1, stderr: "rebase conflict" });
			return commandResult({ stdout: "origin/topic" });
		});

		const result = await mainlineSyncBeforeTool("edit", directory, dependencies);

		assert.deepEqual(result, { block: true, reason: "Mainline synchronization failed: rebase conflict" });
		assert.equal(await mainlineSyncStateRead(path.join(gitDirectory, "pi-mainline-sync-count")), 0);
	});
});

test("concurrent due calls in one worktree serialize and pull only once", async () => {
	await withTemporaryDirectory(async (directory) => {
		const gitDirectory = path.join(directory, "git");
		await fs.promises.mkdir(gitDirectory);
		let activePulls = 0;
		let maximumActivePulls = 0;
		let pullCount = 0;
		const dependencies = realCoordinationDependencies(async (_cwd, args) => {
			if (args[1] === "--git-dir") return commandResult({ stdout: `${gitDirectory}\n${path.join(directory, "common-git")}` });
			if (args[0] === "pull") {
				pullCount++;
				activePulls++;
				maximumActivePulls = Math.max(maximumActivePulls, activePulls);
				await new Promise((resolve) => setTimeout(resolve, 40));
				activePulls--;
			}
			return commandResult({ stdout: "origin/topic" });
		});

		await Promise.all([
			mainlineSyncBeforeTool("read", directory, dependencies),
			mainlineSyncBeforeTool("edit", directory, dependencies),
		]);

		assert.equal(pullCount, 1);
		assert.equal(maximumActivePulls, 1);
		assert.equal(await mainlineSyncStateRead(path.join(gitDirectory, "pi-mainline-sync-count")), 2);
	});
});

test("distinct worktrees use distinct identities and can pull independently", async () => {
	await withTemporaryDirectory(async (directory) => {
		const gitDirectories = new Map([
			[path.join(directory, "worktree-a"), path.join(directory, "git-a")],
			[path.join(directory, "worktree-b"), path.join(directory, "git-b")],
		]);
		await Promise.all([...gitDirectories.values()].map((gitDirectory) => fs.promises.mkdir(gitDirectory)));
		let activePulls = 0;
		let maximumActivePulls = 0;
		const dependencies = realCoordinationDependencies(async (cwd, args) => {
			if (args[1] === "--git-dir") {
				return commandResult({ stdout: `${gitDirectories.get(cwd)}\n${path.join(directory, "common-git")}` });
			}
			if (args[0] === "pull") {
				activePulls++;
				maximumActivePulls = Math.max(maximumActivePulls, activePulls);
				await new Promise((resolve) => setTimeout(resolve, 40));
				activePulls--;
			}
			return commandResult({ stdout: "origin/topic" });
		});

		await Promise.all([...gitDirectories.keys()].map((cwd) => mainlineSyncBeforeTool("read", cwd, dependencies)));

		assert.equal(maximumActivePulls, 2);
		for (const gitDirectory of gitDirectories.values()) {
			assert.equal(await mainlineSyncStateRead(path.join(gitDirectory, "pi-mainline-sync-count")), 1);
		}
	});
});

test("lock cleanup happens after success and failure", async () => {
	await withTemporaryDirectory(async (directory) => {
		const lockPath = path.join(directory, "sync.lock");
		await mainlineSyncLockRun(lockPath, async () => undefined);
		assert.equal(fs.existsSync(lockPath), false);

		await assert.rejects(mainlineSyncLockRun(lockPath, async () => {
			throw new Error("action failed");
		}), /action failed/);
		assert.equal(fs.existsSync(lockPath), false);
	});
});

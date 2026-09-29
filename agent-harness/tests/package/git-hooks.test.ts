import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const validatorPath = join(repositoryRoot, "scripts/git-commit-msg");
const hookPath = join(repositoryRoot, ".githooks/commit-msg");

function temporaryDirectoryCreate(t: TestContext): string {
	const directory = mkdtempSync(join(tmpdir(), "git-hooks-test-"));
	t.after(() => rmSync(directory, { force: true, recursive: true }));
	return directory;
}

function validatorRun(message: string, args: string[] = []): SpawnSyncReturns<string> {
	return spawnSync("bash", [validatorPath, ...args], {
		encoding: "utf8",
		input: message,
	});
}

function hookFixtureCreate(t: TestContext): { hook: string; record: string; foreignCwd: string } {
	const fixtureRoot = temporaryDirectoryCreate(t);
	const hookDirectory = join(fixtureRoot, ".githooks");
	const scriptsDirectory = join(fixtureRoot, "scripts");
	const foreignCwd = join(fixtureRoot, "elsewhere");
	const fixtureHook = join(hookDirectory, "commit-msg");
	const delegate = join(scriptsDirectory, "git-commit-msg");
	const record = join(fixtureRoot, "delegate-record");

	mkdirSync(hookDirectory, { recursive: true });
	mkdirSync(scriptsDirectory, { recursive: true });
	mkdirSync(foreignCwd, { recursive: true });
	copyFileSync(hookPath, fixtureHook);
	writeFileSync(
		delegate,
		`#!/usr/bin/env bash\nprintf '%s' "$*" > "$DELEGATE_RECORD"\nexit "\${DELEGATE_STATUS:-0}"\n`,
	);
	chmodSync(delegate, 0o755);

	return { hook: fixtureHook, record, foreignCwd };
}

test("git-commit-msg accepts strict Conventional Commit headers", () => {
	for (const message of ["feat: add validator\n", "fix(parser): reject empty subjects\n", "chore(release)!: drop legacy format\n"]) {
		const result = validatorRun(message);
		assert.equal(result.status, 0, `${JSON.stringify(message.trim())}: ${result.stderr}`);
	}
});

test("git-commit-msg rejects missing or unknown types and malformed subjects", () => {
	for (const message of [
		"add validator\n",
		"unknown: add validator\n",
		"fix:\n",
		"fix:    \n",
		"fix(scope) add validator\n",
	]) {
		const result = validatorRun(message);
		assert.notEqual(result.status, 0, JSON.stringify(message.trim()));
	}
});

test("git-commit-msg rejects non-conventional merge and revert headers", () => {
	for (const message of ["Merge branch 'topic'\n", "Revert \"feat: add validator\"\n"]) {
		assert.notEqual(validatorRun(message).status, 0, JSON.stringify(message.trim()));
	}
});

test("git-commit-msg accepts a commit-message file or stdin", (t) => {
	const directory = temporaryDirectoryCreate(t);
	const messagePath = join(directory, "COMMIT_EDITMSG");
	writeFileSync(messagePath, "docs: explain commit validation\n");

	const fileResult = validatorRun("", [messagePath]);
	assert.equal(fileResult.status, 0, fileResult.stderr);

	const stdinResult = validatorRun("test: cover stdin validation\n");
	assert.equal(stdinResult.status, 0, stdinResult.stderr);
});

test("git-commit-msg accepts an optional body", () => {
	const result = validatorRun("refactor!: simplify validation\n\nDescribe the migration path.\n");
	assert.equal(result.status, 0, result.stderr);
});

test("git-commit-msg rejects a body without a blank separator", () => {
	const result = validatorRun("feat: add validator\nBody without separator.\n");
	assert.notEqual(result.status, 0, result.stderr);
});

test("commit-msg hook delegates from its own repository root, independent of cwd", (t) => {
	const fixture = hookFixtureCreate(t);
	const messagePath = join(dirname(fixture.record), "COMMIT_EDITMSG");
	writeFileSync(messagePath, "feat: delegated message\n");

	const result = spawnSync("bash", [fixture.hook, messagePath], {
		cwd: fixture.foreignCwd,
		encoding: "utf8",
		env: { ...process.env, DELEGATE_RECORD: fixture.record },
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(fixture.record, "utf8"), messagePath);
});

test("commit-msg hook propagates validator failure status", (t) => {
	const fixture = hookFixtureCreate(t);
	const messagePath = join(dirname(fixture.record), "COMMIT_EDITMSG");
	writeFileSync(messagePath, "invalid message\n");

	const result = spawnSync("bash", [fixture.hook, messagePath], {
		cwd: fixture.foreignCwd,
		encoding: "utf8",
		env: { ...process.env, DELEGATE_RECORD: fixture.record, DELEGATE_STATUS: "23" },
	});

	assert.equal(result.status, 23, result.stderr);
});

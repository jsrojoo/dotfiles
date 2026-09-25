import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const { gitReadOnlyToolCreate } = await import(new URL("../../../.pi/agent/extensions/git-read-only.ts", import.meta.url).href);

const type = {
	Array: () => ({}),
	Boolean: () => ({}),
	Literal: () => ({}),
	Object: () => ({}),
	Optional: () => ({}),
	String: () => ({}),
	Union: () => ({}),
} as never;

test("creates a dedicated git tool", () => {
	assert.equal(gitReadOnlyToolCreate(type).name, "git");
});

test("runs only fixed read-only Git arguments", async () => {
	const calls: Array<{ file: string; args: string[]; options: Record<string, unknown> }> = [];
	const tool = gitReadOnlyToolCreate(type, async (file, args, options) => {
		calls.push({ file, args, options });
		return { stdout: "diff output", stderr: "" };
	});
	const context = { cwd: "/repo" } as ExtensionContext;

	const result = await tool.execute(
		"call-1",
		{ operation: "diff", staged: true, paths: ["src/file.ts"] },
		undefined,
		undefined,
		context,
	);

	assert.deepEqual(calls[0]?.file, "git");
	assert.deepEqual(calls[0]?.args, [
		"--no-pager",
		"--no-optional-locks",
		"diff",
		"--no-ext-diff",
		"--no-textconv",
		"--no-color",
		"--cached",
		"--",
		"src/file.ts",
	]);
	assert.equal(calls[0]?.options.cwd, "/repo");
	assert.equal((calls[0]?.options.env as NodeJS.ProcessEnv).GIT_CONFIG_GLOBAL, "/dev/null");
	assert.equal(result.content[0]?.type, "text");
	assert.equal(result.content[0]?.text, "diff output");
});

test("rejects unsafe revisions and paths before invoking Git", async () => {
	let calls = 0;
	const tool = gitReadOnlyToolCreate(type, async () => {
		calls += 1;
		return { stdout: "", stderr: "" };
	});
	const context = { cwd: "/repo" } as ExtensionContext;

	await assert.rejects(
		tool.execute("call-1", { operation: "show", revision: "--help" }, undefined, undefined, context),
		/Git revision/,
	);
	await assert.rejects(
		tool.execute("call-2", { operation: "diff", paths: ["bad\0path"] }, undefined, undefined, context),
		/Git paths/,
	);
	assert.equal(calls, 0);
});

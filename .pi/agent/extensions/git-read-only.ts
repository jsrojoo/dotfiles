import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 50_000;
const REVISION = /^(?:HEAD(?:[~^][0-9]*)*|[0-9a-fA-F]{4,64})$/;

export type GitReadOnlyExecutor = (
	file: string,
	args: string[],
	options: {
		cwd: string;
		env: NodeJS.ProcessEnv;
		encoding: "utf8";
		maxBuffer: number;
		signal?: AbortSignal;
	},
) => Promise<{ stdout: string; stderr: string }>;

const executeGit: GitReadOnlyExecutor = async (file, args, options) =>
	(await execFileAsync(file, args, options)) as { stdout: string; stderr: string };

function outputLimit(text: string): string {
	return text.length <= OUTPUT_LIMIT ? text : `${text.slice(0, OUTPUT_LIMIT)}\n[output truncated; narrow the request with paths]`;
}

function argumentsBuild(params: {
	operation: "status" | "diff" | "log" | "show";
	staged?: boolean;
	revision?: string;
	paths?: string[];
}): string[] {
	const prefix = ["--no-pager", "--no-optional-locks"];
	const paths = params.paths ?? [];
	if (paths.some((path) => !path || path.includes("\0"))) throw new Error("Git paths must be non-empty and contain no NUL bytes.");

	switch (params.operation) {
		case "status":
			return [...prefix, "status", "--porcelain=v1", "--branch", "--untracked-files=all"];
		case "diff":
			return [
				...prefix,
				"diff",
				"--no-ext-diff",
				"--no-textconv",
				"--no-color",
				...(params.staged ? ["--cached"] : []),
				"--",
				...paths,
			];
		case "log":
			return [...prefix, "log", "--no-color", "--oneline", "--decorate=short", "-n", "20", "--", ...paths];
		case "show": {
			const revision = params.revision ?? "HEAD";
			if (!REVISION.test(revision)) throw new Error("Git revision must be HEAD-relative or a hexadecimal object ID.");
			return [
				...prefix,
				"show",
				"--no-ext-diff",
				"--no-textconv",
				"--no-color",
				revision,
				"--",
				...paths,
			];
		}
	}
}

export function gitReadOnlyToolCreate(type: typeof Type, executor: GitReadOnlyExecutor = executeGit) {
	return {
		name: "git",
		label: "Git (read-only)",
		description: "Read repository status, diffs, recent history, or a commit without changing repository state.",
		parameters: type.Object({
			operation: type.Union([type.Literal("status"), type.Literal("diff"), type.Literal("log"), type.Literal("show")]),
			staged: type.Optional(type.Boolean({ description: "For diff, inspect staged changes instead of unstaged changes." })),
			revision: type.Optional(type.String({ description: "For show, use HEAD-relative syntax or a hexadecimal object ID." })),
			paths: type.Optional(type.Array(type.String(), { description: "Optional repository-relative paths for diff, log, or show." })),
		}),
		async execute(
			_toolCallId: string,
			params: Parameters<typeof argumentsBuild>[0],
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext,
		) {
			const { stdout, stderr } = await executor("git", argumentsBuild(params), {
				cwd: ctx.cwd,
				env: {
					PATH: process.env.PATH,
					LANG: process.env.LANG,
					LC_ALL: process.env.LC_ALL,
					GIT_CONFIG_NOSYSTEM: "1",
					GIT_CONFIG_GLOBAL: "/dev/null",
					GIT_OPTIONAL_LOCKS: "0",
					GIT_PAGER: "cat",
					GIT_TERMINAL_PROMPT: "0",
				},
				encoding: "utf8",
				maxBuffer: 1_000_000,
				signal,
			});
			const text = outputLimit(stdout || stderr || "(no output)");
			return { content: [{ type: "text" as const, text }], details: { operation: params.operation } };
		},
	};
}

export default async function register(pi: ExtensionAPI): Promise<void> {
	const { Type } = await import("@earendil-works/pi-ai");
	pi.registerTool(gitReadOnlyToolCreate(Type));
}

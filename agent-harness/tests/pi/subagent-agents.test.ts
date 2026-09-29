import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { agentConfigsMerge, type AgentConfig } from "#agent-harness/pi/extensions/subagent/agent-configs";
import { discoverAgents } from "#agent-harness/pi/extensions/subagent/agents";
import {
	subagentModelCandidatesBuild,
	subagentModelFallbackRun,
	sharedAgentModelSelectorBuild,
} from "#agent-harness/pi/extensions/subagent/model-selector";

function agentConfigBuild(name: string, model: string, source: "user" | "project"): AgentConfig {
	return {
		name,
		description: `${name} description`,
		model,
		systemPrompt: `${name} prompt`,
		source,
		filePath: `/${name}.md`,
	};
}

function repositoryAgentFind(name: string): AgentConfig | undefined {
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
	process.env.PI_CODING_AGENT_DIR = `${repositoryRoot}/.pi/agent`;
	try {
		return discoverAgents(repositoryRoot, "user", undefined).agents.find((agent) => agent.name === name);
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
	}
}

test("uses the Azure main provider for an Azure shared child", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "azure", "azure"), "azure/gpt-5.6-luna");
});

test("uses the Atlas main provider for an Atlas shared child", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "atlas", "atlas"), "atlas/gpt-5.6-luna");
});

test("shared TOML provider overrides the active main provider", () => {
	assert.equal(sharedAgentModelSelectorBuild("claude-sonnet-5", "atlas-bedrock", "atlas"), "atlas-bedrock/claude-sonnet-5");
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai", "azure"), "openai/gpt-5.6-luna");
});

test("unsupported or missing main providers preserve the shared TOML provider", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai", "anthropic"), "openai/gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "atlas"), "atlas/gpt-5.6-luna");
});

test("uses the active main provider only when shared provider is missing", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", undefined, "azure"), "azure/gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", undefined, "unsupported"), "gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild(undefined, "atlas", "azure"), undefined);
});

test("Pi-native and project agent model selectors remain authoritative", () => {
	const sharedAgent = agentConfigBuild("specialist", "azure/shared-model", "user");
	const userAgent = agentConfigBuild("specialist", "openai/user-model", "user");
	const projectAgent = agentConfigBuild("specialist", "atlas/project-model", "project");

	assert.equal(agentConfigsMerge("user", [sharedAgent], [userAgent], [projectAgent])[0].model, "openai/user-model");
	assert.equal(agentConfigsMerge("both", [sharedAgent], [userAgent], [projectAgent])[0].model, "atlas/project-model");
});

test("builds a bounded, ordered fallback list for read-only agents", () => {
	assert.deepEqual(
		subagentModelCandidatesBuild(
			{
				model: "azure/primary",
				fallbackModels: ["atlas/first", "azure/primary", "atlas/second", "atlas/ignored"],
				tools: ["read", "grep", "find", "ls", "git"],
			},
			"azure/inherited",
		),
		["azure/primary", "atlas/first", "atlas/second"],
	);
});

test("uses inherited model when an agent has no primary model", () => {
	assert.deepEqual(subagentModelCandidatesBuild({ tools: ["read"] }, "azure/inherited"), ["azure/inherited"]);
});

test("stops model fallback after first successful attempt", async () => {
	const attempted: Array<string | undefined> = [];
	const result = await subagentModelFallbackRun(
		["primary", "fallback", "unused"],
		async (model) => {
			attempted.push(model);
			return { failed: model === "primary", model };
		},
		(candidate) => candidate.failed,
	);

	assert.deepEqual(attempted, ["primary", "fallback"]);
	assert.deepEqual(result, { failed: false, model: "fallback" });
});

test("rejects fallback models for agents with mutation-capable tools", () => {
	assert.throws(
		() => subagentModelCandidatesBuild({ fallbackModels: ["atlas/fallback"], tools: ["read", "bash"] }, "azure/primary"),
		/fallback models require explicitly read-only tools/,
	);
});

test("allows fallback models with explicit mutation-tool exception", () => {
	assert.deepEqual(
		subagentModelCandidatesBuild(
			{
				fallbackModels: ["atlas/fallback"],
				tools: ["read", "bash"],
				allowFallbackModelsWithMutationTools: true,
			},
			"azure/primary",
		),
		["azure/primary", "atlas/fallback"],
	);
});

test("context coordinator is bundled and delegates scoped retrieval", () => {
	const agent = readFileSync(new URL("../../agents/context.toml", import.meta.url), "utf8");
	const prompt = readFileSync(new URL("../../agents/context.md", import.meta.url), "utf8");
	const implementation = readFileSync(
		new URL("../../src/pi/extensions/subagent/index.ts", import.meta.url),
		"utf8",
	);

	assert.match(agent, /^name = "context"$/m);
	assert.match(agent, /^model_provider = "azure"$/m);
	assert.match(agent, /^model = "gpt-5\.6-luna"$/m);
	assert.match(agent, /^fallback_models = "atlas\/gpt-6-luna,atlas-bedrock\/claude-sonnet-4-6"$/m);
	assert.match(agent, /^allow_fallback_models_with_mutation_tools = true$/m);
	assert.match(agent, /^sandbox_mode = "read-only-with-bash"$/m);
	assert.match(agent, /^tools = "git,subagent,defuddle"$/m);
	assert.match(prompt, /one parallel `subagent` call that fans out to 2-4 `context-retriever` leaves/);
	assert.match(prompt, /never invoke `context` or another coordinator recursively/);
	assert.match(prompt, /Synthesize the leaf results into one compact integrated handoff/);
	assert.match(implementation, /name === "subagent"/);
	assert.match(implementation, /path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/);
});

test("context coordinator receives the nested subagent extension", () => {
	const agent = discoverAgents(process.cwd(), "user", undefined).agents.find((item) => item.name === "context");

	assert.deepEqual(agent?.tools, ["read", "grep", "find", "ls", "bash", "git", "subagent", "defuddle"]);
	assert.deepEqual(agent?.skills, ["graphify"]);
	assert.deepEqual(agent?.extensions, ["rtk", "git-read-only", "subagent"]);
	assert.deepEqual(agent?.fallbackModels, ["atlas/gpt-6-luna", "atlas-bedrock/claude-sonnet-4-6"]);
	assert.equal(agent?.allowFallbackModelsWithMutationTools, true);
});

test("context retriever is read-only and cannot nest", () => {
	const prompt = readFileSync(new URL("../../agents/context-retriever.md", import.meta.url), "utf8");
	const agent = discoverAgents(process.cwd(), "user", undefined).agents.find(
		(item) => item.name === "context-retriever",
	);

	assert.deepEqual(agent?.tools, ["read", "grep", "find", "ls", "git"]);
	assert.deepEqual(agent?.skills, ["graphify"]);
	assert.deepEqual(agent?.extensions, ["rtk", "git-read-only"]);
	assert.deepEqual(agent?.fallbackModels, ["atlas/gpt-6-luna", "atlas-bedrock/claude-sonnet-4-6"]);
	assert.equal(agent?.allowFallbackModelsWithMutationTools ?? false, false);
	assert.match(prompt, /Do not use shell commands or delegate to nested subagents/);
});

test("git agent is bundled and keeps Git workflow separate from implementation", () => {
	const agent = readFileSync(new URL("../../agents/git.toml", import.meta.url), "utf8");
	const prompt = readFileSync(new URL("../../agents/git.md", import.meta.url), "utf8");

	assert.match(agent, /^name = "git"$/m);
	assert.match(
		agent,
		/^description = "Git-only worker for repository status, diff review, surgical staging, commits, and merge-request hygiene\."$/m,
	);
	assert.match(agent, /^model_provider = "azure"$/m);
	assert.match(agent, /^model = "gpt-5\.6-luna"$/m);
	assert.match(agent, /^skills = "git"$/m);
	assert.match(agent, /^sandbox_mode = "read-only-with-bash"$/m);
	assert.match(agent, /^extensions = "rtk"$/m);
	assert.match(prompt, /Handle Git workflow only; do not implement source or configuration changes/);
	assert.match(prompt, /Inspect `git --no-pager status` and relevant diffs/);
	assert.match(prompt, /Require explicit user approval before staging, committing, rebasing, pushing/);
	assert.match(prompt, /Never stage secrets, `\.env` files, credentials/);
	assert.match(prompt, /Use surgical staging when mixed changes need separation/);
	assert.match(
		prompt,
		/(?:must|required to|always)[^\n]*`bash scripts\/git-commit-msg`[^\n]*exact final commit message/i,
		"Git agent must require the Bash validator to run on the exact final message",
	);
	assert.match(prompt, /hard-stop[^\n]*validator failure/i, "Git agent must hard-stop on validator failure");
	assert.match(prompt, /(?:never|do not)[^\n]*`--no-verify`/i, "Git agent must explicitly prohibit --no-verify");
	assert.match(prompt, /Do not use `edit` or `write` for implementation work/);
	assert.match(prompt, /Exact commands run and their outcomes/);
	assert.match(prompt, /Never reset, restore, checkout, clean, overwrite, or discard/);
	assert.match(prompt, /Do not delegate to nested subagents/);
});

test("git agent activates Git skill and RTK", () => {
	const agent = discoverAgents(process.cwd(), "user", undefined).agents.find((item) => item.name === "git");

	assert.deepEqual(agent?.skills, ["git"]);
	assert.deepEqual(agent?.extensions, ["rtk"]);
});

test("editor coordinator is discoverable with nested subagent orchestration", () => {
	const prompt = readFileSync(new URL("../../../.pi/agent/agents/editor.md", import.meta.url), "utf8");
	const agent = repositoryAgentFind("editor");

	assert.deepEqual(agent?.tools, ["read", "bash", "edit", "subagent", "implementation_done"]);
	assert.deepEqual(agent?.extensions, ["coding-tdd", "rtk", "subagent"]);
	assert.match(prompt, /one main `context` coordinator invocation/);
	assert.match(prompt, /explicit, non-overlapping path ownership/);
	assert.match(prompt, /implementation paths, corresponding scoped test paths, a focused test command, and observable success criteria/);
	assert.match(prompt, /parent remains responsible for integration review, final verification, and calling `implementation_done`/);
});

test("editor worker is discoverable, scoped, and non-recursive", () => {
	const prompt = readFileSync(new URL("../../../.pi/agent/agents/editor-worker.md", import.meta.url), "utf8");
	const agent = repositoryAgentFind("editor-worker");

	assert.deepEqual(agent?.tools, ["read", "bash", "edit", "write", "implementation_done"]);
	assert.deepEqual(agent?.extensions, [
		"coding-tdd",
		"rtk",
		"agent-harness/src/pi/extensions/mainline-sync.ts",
	]);
	assert.match(prompt, /Edit only the paths explicitly assigned to you/);
	assert.match(prompt, /`write` only for explicitly assigned new files/);
	assert.match(prompt, /explicit ownership of the implementation and test paths plus a focused test command/);
	assert.match(prompt, /ownership is missing, ambiguous, or overlaps another worker, stop and report the conflict without editing/);
	assert.match(prompt, /Before implementation, run the focused test command and confirm it fails for the expected behavior/);
	assert.match(prompt, /After reaching green, run fresh scoped verification before calling `implementation_done`/);
	assert.match(prompt, /After assigned-scope verification passes, call `implementation_done`/);
	assert.match(prompt, /parent editor owns integration, final verification, and final completion, and must call `implementation_done` again after they pass/);
	assert.match(prompt, /Do not invoke subagents or delegate work/);
	assert.ok(!agent?.tools.includes("subagent"));
});

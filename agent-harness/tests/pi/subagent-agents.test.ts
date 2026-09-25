import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { agentConfigsMerge, type AgentConfig } from "#agent-harness/pi/extensions/subagent/agent-configs";
import { defaultContextTasks } from "#agent-harness/pi/extensions/subagent/context-tasks";
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
				tools: ["read", "grep", "find", "ls"],
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

test("context defaults to three parallel investigations", () => {
	const tasks = defaultContextTasks("Inspect harness migration");
	assert.equal(tasks.length, 3);
	assert.deepEqual(tasks.map((task) => task.agent), ["context", "context", "context"]);
	assert.match(tasks[0].task, /structure/);
	assert.match(tasks[1].task, /behavior/);
	assert.match(tasks[2].task, /tests/);
});

test("context agent is bundled, isolated, and concise", () => {
	const agent = readFileSync(new URL("../../agents/context.toml", import.meta.url), "utf8");
	const prompt = readFileSync(new URL("../../agents/context.md", import.meta.url), "utf8");

	assert.match(agent, /^name = "context"$/m);
	assert.match(agent, /^model_provider = "azure"$/m);
	assert.match(agent, /^model = "gpt-5\.6-luna"$/m);
	assert.match(agent, /^fallback_models = "atlas\/gpt-5\.6-luna,atlas-bedrock\/claude-sonnet-4-6"$/m);
	assert.match(agent, /^sandbox_mode = "read-only"$/m);
	assert.match(prompt, /Never modify files, repository state, dependencies, or external systems/);
	assert.match(prompt, /Return only compact findings/);
});

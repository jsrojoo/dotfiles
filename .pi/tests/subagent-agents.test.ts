import assert from "node:assert/strict";
import test from "node:test";

import { agentConfigsMerge, type AgentConfig } from "../agent/extensions/subagent/agent-configs.ts";
import { sharedAgentModelSelectorBuild } from "../agent/extensions/subagent/model-selector.ts";

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

test("active Azure or Atlas overrides the shared TOML provider", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai", "azure"), "azure/gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai", "atlas"), "atlas/gpt-5.6-luna");
});

test("unsupported or missing main providers preserve the shared TOML provider", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai", "anthropic"), "openai/gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "atlas"), "atlas/gpt-5.6-luna");
});

test("preserves bare model selectors and missing models", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", undefined, "azure"), "azure/gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild(undefined, "atlas", "azure"), undefined);
});

test("Pi-native and project agent model selectors remain authoritative", () => {
	const sharedAgent = agentConfigBuild("specialist", "azure/shared-model", "user");
	const userAgent = agentConfigBuild("specialist", "openai/user-model", "user");
	const projectAgent = agentConfigBuild("specialist", "atlas/project-model", "project");

	assert.equal(agentConfigsMerge("user", [sharedAgent], [userAgent], [projectAgent])[0].model, "openai/user-model");
	assert.equal(agentConfigsMerge("both", [sharedAgent], [userAgent], [projectAgent])[0].model, "atlas/project-model");
});

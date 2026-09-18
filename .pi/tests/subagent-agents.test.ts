import assert from "node:assert/strict";
import test from "node:test";

import { sharedAgentModelSelectorBuild } from "../agent/extensions/subagent/model-selector.ts";

test("maps shared Atlas agents to Azure for Pi", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "atlas"), "azure/gpt-5.6-luna");
});

test("preserves providers without a Pi override", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", "openai"), "openai/gpt-5.6-luna");
});

test("preserves bare model selectors and missing models", () => {
	assert.equal(sharedAgentModelSelectorBuild("gpt-5.6-luna", undefined), "gpt-5.6-luna");
	assert.equal(sharedAgentModelSelectorBuild(undefined, "atlas"), undefined);
});

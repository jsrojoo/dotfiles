import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settingsPath = resolve(repositoryRoot, ".pi/agent/settings.json");

type Settings = {
	extensions?: string[];
	defaultTools?: string[];
	packages?: string[];
	subagents?: {
		agentOverrides?: Record<string, { disabled?: boolean; tools?: string[] }>;
	};
};

const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Settings;
const externalCliAgents = [
	"claude-code",
	"claude-code-writer",
	"codex-exec",
	"codex-exec-writer",
	"cursor-agent",
	"cursor-agent-writer",
];

test("enables Codemode without replacing inherited default tools", () => {
	assert.deepEqual(settings.defaultTools, ["+codemode"]);
});

test("keeps the npm Pi subagent extension as the configured dispatcher", () => {
	assert.ok(settings.packages?.includes("npm:pi-subagents"));
	assert.ok(!settings.extensions?.includes("~/dotfiles/agent-harness/src/pi/extensions/subagent"));
});

test("disables external CLI profiles and retains Pi-native builtins", () => {
	const overrides = settings.subagents?.agentOverrides ?? {};

	for (const agent of externalCliAgents) {
		assert.equal(overrides[agent]?.disabled, true, `${agent} must be disabled`);
	}

	assert.equal(overrides.delegate?.disabled, undefined);
	assert.equal(overrides.scout?.disabled, undefined);
	assert.deepEqual(overrides.delegate?.tools, [
		"read",
		"grep",
		"find",
		"ls",
		"bash",
		"edit",
		"write",
		"contact_supervisor",
	]);
});

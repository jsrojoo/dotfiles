import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function jsonRead(path: string): any {
	return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

test("Claude and Codex package only the dedicated TDD skill", () => {
	const claude = jsonRead(".claude-plugin/plugin.json");
	const codex = jsonRead(".codex-plugin/plugin.json");

	assert.deepEqual(claude.skills, ["./src/skills/tdd"]);
	assert.equal(codex.skills, "./src/skills/tdd");
});

test("dedicated TDD skill excludes unrelated coding workflows", () => {
	const skill = readFileSync(new URL("src/skills/tdd/SKILL.md", root), "utf8");

	assert.match(skill, /^---\nname: tdd\n/m);
	assert.match(skill, /test and implementation in either order or in parallel/i);
	assert.match(skill, /Source-only changes do not satisfy this workflow/i);
	assert.doesNotMatch(skill, /End-to-end handoff|\.local\.artifacts|SQL|responsive frontend/i);
});

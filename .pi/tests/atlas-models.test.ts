import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const atlasSource = await readFile(new URL("../agent/extensions/atlas.ts", import.meta.url), "utf8");

test("registers available Atlas GPT-6 models", () => {
	assert.match(atlasSource, /"gpt-6-sol"/);
	assert.match(atlasSource, /"gpt-6-luna"/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const atlasSource = await readFile(new URL("../agent/extensions/atlas.ts", import.meta.url), "utf8");
const settings = JSON.parse(await readFile(new URL("../settings.json", import.meta.url), "utf8"));
const azureModels = JSON.parse(await readFile(new URL("../agent/models.json", import.meta.url), "utf8"));
const miseSource = await readFile(new URL("../../mise.toml", import.meta.url), "utf8");

test("uses only supported GPT-6 model", () => {
	assert.doesNotMatch(atlasSource, /"gpt-6-sol"/);
	assert.match(atlasSource, /"gpt-6-luna"/);
	assert.equal(settings.defaultProvider, "azure");
	assert.equal(settings.defaultModel, "gpt-6-luna");
	assert.equal(azureModels.providers.azure.models.find((model: { id: string }) => model.id === "gpt-6-luna").samplingParams.service_tier, "fast");
	assert.match(miseSource, /run = "pi --provider azure --model gpt-6-luna"/);
});

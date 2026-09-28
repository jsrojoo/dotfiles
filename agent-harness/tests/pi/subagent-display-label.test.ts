import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { subagentDisplayLabelBuild } from "#agent-harness/pi/extensions/subagent/display-label";

const source = readFileSync(new URL("../../src/pi/extensions/subagent/index.ts", import.meta.url), "utf8");

test("builds purpose labels without changing bare agent names", () => {
	assert.equal(subagentDisplayLabelBuild("context"), "context");
	assert.equal(subagentDisplayLabelBuild("context", "   "), "context");
	assert.equal(subagentDisplayLabelBuild("context", " GitLab API\n investigation "), "context: GitLab API investigation");
	assert.equal(subagentDisplayLabelBuild("context", " caller\tflow "), "context: caller flow");
	assert.equal(subagentDisplayLabelBuild("context", "tests / risks"), "context: tests / risks");
});

test("accepts purpose for single, parallel, and chain invocations", () => {
	assert.match(source, /const TaskItem = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
	assert.match(source, /const ChainItem = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
	assert.match(source, /const SubagentParams = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
});

test("threads purpose through execution without replacing agent identity", () => {
	assert.match(source, /agent: agent\.name,\s+displayLabel: subagentDisplayLabelBuild\(agent\.name, purpose\)/);
	assert.match(source, /agent: agentName,\s+displayLabel: subagentDisplayLabelBuild\(agentName, purpose\)/);
	assert.match(source, /displayLabel: subagentDisplayLabelBuild\(parallelTasks\[i\]\.agent, parallelTasks\[i\]\.purpose\)/);
	assert.match(source, /step\.agent,\s+taskWithContext,\s+step\.purpose/);
	assert.match(source, /t\.agent,\s+t\.task,\s+t\.purpose/);
	assert.match(source, /params\.agent,\s+params\.task,\s+params\.purpose/);
});

test("uses purpose labels for call and result rendering", () => {
	assert.match(source, /subagentDisplayLabelBuild\(step\.agent, step\.purpose\)/);
	assert.match(source, /subagentDisplayLabelBuild\(t\.agent, t\.purpose\)/);
	assert.match(source, /subagentDisplayLabelBuild\(agentName, args\.purpose\)/);
	assert.equal(source.match(/theme\.fg\("accent", r\.displayLabel\)/g)?.length, 4);
	assert.equal(source.match(/theme\.bold\(r\.displayLabel\)/g)?.length, 2);
	assert.match(source, /`### \[\$\{r\.displayLabel\}\] \$\{status\}/);
});

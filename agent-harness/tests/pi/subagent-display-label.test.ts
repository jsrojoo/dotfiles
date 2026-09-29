import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { subagentDisplayLabelBuild } from "#agent-harness/pi/extensions/subagent/display-label";

const dispatcherSource = readFileSync(new URL("../../src/pi/extensions/subagent/index.ts", import.meta.url), "utf8");

test("builds purpose labels without changing bare agent names", () => {
	assert.equal(subagentDisplayLabelBuild("context"), "context");
	assert.equal(subagentDisplayLabelBuild("context", "   "), "context");
	assert.equal(subagentDisplayLabelBuild("context", " GitLab API\n investigation "), "context: GitLab API investigation");
	assert.equal(subagentDisplayLabelBuild("context", " caller\tflow "), "context: caller flow");
	assert.equal(subagentDisplayLabelBuild("context", "tests / risks"), "context: tests / risks");
});

test("accepts purpose for single, parallel, and chain invocations", () => {
	assert.match(dispatcherSource, /const TaskItem = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
	assert.match(dispatcherSource, /const ChainItem = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
	assert.match(dispatcherSource, /const SubagentParams = Type\.Object\([\s\S]*?purpose: Type\.Optional/);
});

test("threads purpose through execution without replacing agent identity", () => {
	assert.match(dispatcherSource, /agent: agent\.name,\s+displayLabel: subagentDisplayLabelBuild\(agent\.name, purpose\)/);
	assert.match(dispatcherSource, /agent: agentName,\s+displayLabel: subagentDisplayLabelBuild\(agentName, purpose\)/);
	assert.match(dispatcherSource, /displayLabel: subagentDisplayLabelBuild\(parallelTasks\[i\]\.agent, parallelTasks\[i\]\.purpose\)/);
	assert.match(dispatcherSource, /step\.agent,\s+taskWithContext,\s+step\.purpose/);
	assert.match(dispatcherSource, /t\.agent,\s+t\.task,\s+t\.purpose/);
	assert.match(dispatcherSource, /params\.agent,\s+params\.task,\s+params\.purpose/);
});

test("uses purpose labels for call and result rendering", () => {
	assert.match(dispatcherSource, /subagentDisplayLabelBuild\(step\.agent, step\.purpose\)/);
	assert.match(dispatcherSource, /subagentDisplayLabelBuild\(t\.agent, t\.purpose\)/);
	assert.match(dispatcherSource, /subagentDisplayLabelBuild\(agentName, args\.purpose\)/);
	assert.equal(dispatcherSource.match(/theme\.fg\("accent", r\.displayLabel\)/g)?.length, 4);
	assert.equal(dispatcherSource.match(/theme\.bold\(r\.displayLabel\)/g)?.length, 2);
	assert.match(dispatcherSource, /`### \[\$\{r\.displayLabel\}\] \$\{status\}/);
});

test("keeps the subagent dispatcher specific to subagent dispatch", () => {
	assert.match(dispatcherSource, /pi\.registerTool\(\{/);
	assert.doesNotMatch(dispatcherSource, /mainlineSync|pi-mainline-sync|pi\.on\("tool_call"/);
});

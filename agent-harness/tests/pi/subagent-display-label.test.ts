import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { subagentDisplayLabelBuild } from "#agent-harness/pi/extensions/subagent/display-label";

const subagentSource = readFileSync(new URL("../../src/pi/extensions/subagent/index.ts", import.meta.url), "utf8");

function sourceSlice(startMarker: string, endMarker: string): string {
	const start = subagentSource.indexOf(startMarker);
	assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
	const end = subagentSource.indexOf(endMarker, start + startMarker.length);
	assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
	return subagentSource.slice(start, end);
}

test("builds purpose labels without changing bare agent names", () => {
	assert.equal(subagentDisplayLabelBuild("context"), "context");
	assert.equal(subagentDisplayLabelBuild("context", "   "), "context");
	assert.equal(subagentDisplayLabelBuild("context", " GitLab API\n investigation "), "context: GitLab API investigation");
	assert.equal(subagentDisplayLabelBuild("context", " caller\tflow "), "context: caller flow");
	assert.equal(subagentDisplayLabelBuild("context", "tests / risks"), "context: tests / risks");
});

test("formats elapsed response durations at pi-stamp boundaries", () => {
	const source = sourceSlice("function formatResponseDuration", "function formatTokens");
	const executableSource = source.replace("milliseconds: number", "milliseconds").replace("): string", ")");
	const formatResponseDuration = Function(`"use strict"; return (${executableSource});`)() as (ms: number) => string;

	assert.equal(formatResponseDuration(0), "0.0s");
	assert.equal(formatResponseDuration(Number.MIN_VALUE), "<0.1s");
	assert.equal(formatResponseDuration(99.999), "<0.1s");
	assert.equal(formatResponseDuration(100), "0.1s");
	assert.equal(formatResponseDuration(1_250), "1.3s");
	for (const milliseconds of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
		assert.throws(() => formatResponseDuration(milliseconds), RangeError);
	}
});

test("accepts purpose for single, parallel, and chain invocations", () => {
	const taskItem = sourceSlice("const TaskItem = Type.Object(", "const ChainItem = Type.Object(");
	const chainItem = sourceSlice("const ChainItem = Type.Object(", "const SubagentParams = Type.Object(");
	const params = sourceSlice("const SubagentParams = Type.Object(", "export default function");
	assert.match(taskItem, /purpose\s*:\s*Type\.Optional/);
	assert.match(chainItem, /purpose\s*:\s*Type\.Optional/);
	assert.match(params, /purpose\s*:\s*Type\.Optional/);
});

test("threads purpose through execution without replacing agent identity", () => {
	assert.match(subagentSource, /agent\s*:\s*agent\.name,\s+displayLabel\s*:\s*subagentDisplayLabelBuild\(agent\.name,\s*purpose\)/);
	assert.match(subagentSource, /agent\s*:\s*agentName,\s+displayLabel\s*:\s*subagentDisplayLabelBuild\(agentName,\s*purpose\)/);
	assert.match(subagentSource, /displayLabel\s*:\s*subagentDisplayLabelBuild\(parallelTasks\[i\]\.agent,\s*parallelTasks\[i\]\.purpose\)/);
	assert.match(subagentSource, /step\.agent,\s+taskWithContext,\s+step\.purpose/);
	assert.match(subagentSource, /t\.agent,\s+t\.task,\s+t\.purpose/);
	assert.match(subagentSource, /params\.agent,\s+params\.task,\s+params\.purpose/);
});

test("uses purpose labels for call and result rendering", () => {
	assert.match(subagentSource, /subagentDisplayLabelBuild\(step\.agent,\s*step\.purpose\)/);
	assert.match(subagentSource, /subagentDisplayLabelBuild\(t\.agent,\s*t\.purpose\)/);
	assert.match(subagentSource, /subagentDisplayLabelBuild\(agentName,\s*args\.purpose\)/);
	assert.equal(subagentSource.match(/theme\.fg\("accent",\s*r\.displayLabel\)/g)?.length, 4);
	assert.equal(subagentSource.match(/theme\.bold\(r\.displayLabel\)/g)?.length, 2);
	assert.match(subagentSource, /`### \[\$\{r\.displayLabel\}\] \$\{status\}/);
});

test("tracks elapsed time from spawn and freezes it at process completion", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	assert.match(attempt, /elapsedMs: 0/);
	assert.match(attempt, /startedAt = performance\.now\(\);\n\s*const proc = spawn\(/);
	assert.match(attempt, /setInterval\([\s\S]*?onUpdate\(makeUpdate\(\)\)[\s\S]*?, 1000\)/);
	assert.match(attempt, /currentResult\.elapsedMs = \(completedAt \?\? performance\.now\(\)\) - startedAt/);
	assert.match(attempt, /if \(startedAt !== undefined && completedAt === undefined\) completedAt = performance\.now\(\)/);
	assert.match(attempt, /proc\.on\("close", \(code\) => \{\n\s*freezeElapsed\(\);/);
	assert.match(attempt, /proc\.on\("error", \(\) => \{\n\s*freezeElapsed\(\);/);
	assert.match(attempt, /finally \{\n\s*if \(elapsedUpdateInterval\) clearInterval\(elapsedUpdateInterval\);[\s\S]*?freezeElapsed\(\);/);
});

test("preserves elapsed time and removes the abort listener when an attempt aborts", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	assert.match(attempt, /error\.elapsedMs = currentResult\.elapsedMs;\n\s*throw error;/);
	assert.match(attempt, /signal\.addEventListener\("abort", abortHandler, \{ once: true \}\)/);
	assert.match(attempt, /if \(signal && abortHandler\) signal\.removeEventListener\("abort", abortHandler\)/);
	assert.ok(
		attempt.indexOf('signal.removeEventListener("abort", abortHandler)') < attempt.lastIndexOf("freezeElapsed();"),
		"abort listener cleanup should happen before the final frozen elapsed update",
	);
});

test("renders elapsed time for single, chain, and parallel details", () => {
	assert.match(subagentSource, /interface SingleResult \{[\s\S]*?elapsedMs: number;/);
	assert.match(subagentSource, /\[elapsedText\(r\.elapsedMs\), formatUsageStats\(r\.usage, r\.model\)\]/);
	assert.match(subagentSource, /results\.reduce\(\(total, r\) => total \+ r\.elapsedMs, 0\)/);
	assert.match(subagentSource, /Step \$\{r\.step\}:[\s\S]*?elapsedText\(r\.elapsedMs\)/);
	assert.match(subagentSource, /r\.displayLabel\)[\s\S]*?elapsedText\(r\.elapsedMs\)/);
});

test("measures parallel aggregate elapsed across the whole scheduled batch", () => {
	const parallelExecution = sourceSlice(
		"const parallelStartedAt = performance.now();",
		"const successCount = results.filter",
	);
	assert.match(parallelExecution, /parallelElapsedMs: \(parallelCompletedAt \?\? performance\.now\(\)\) - parallelStartedAt/);
	assert.ok(
		parallelExecution.indexOf("parallelStartedAt") < parallelExecution.indexOf("mapWithConcurrencyLimit"),
		"batch timing should start before concurrency-limited scheduling",
	);
	assert.ok(
		parallelExecution.indexOf("parallelCompletedAt = performance.now()") >
			parallelExecution.indexOf("mapWithConcurrencyLimit"),
		"batch timing should freeze after all queued waves complete",
	);
	assert.match(subagentSource, /details\.parallelElapsedMs \?\? 0/);
	assert.doesNotMatch(subagentSource, /Math\.max\(0, \.\.\.results\.map\(\(r\) => r\.elapsedMs\)\)/);
});

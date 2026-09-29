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

test("wires child lifecycle policy into each spawned attempt", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	assert.match(attempt, /const proc = spawn\(/);
	assert.match(attempt, /const outcome = await runChild\(proc, \{/);
	assert.match(attempt, /signal: watchdogAbortController\.signal,\s+onHeartbeat: emitUpdate,/);
	assert.match(attempt, /currentResult\.elapsedMs = outcome\.elapsedMs/);
	assert.doesNotMatch(attempt, /setInterval|clearInterval/);
	assert.doesNotMatch(attempt, /proc\.(?:on|once)\("(?:close|error)"/);
	assert.doesNotMatch(attempt, /proc\.kill|SIGTERM|SIGKILL/);
});

test("preserves partial assistant and tool output alongside failure diagnostics", () => {
	const outputHelpers = sourceSlice("function getPartialOutput", "function truncateParallelOutput");
	assert.match(outputHelpers, /msg\.role !== "assistant" && msg\.role !== "toolResult"/);
	assert.match(outputHelpers, /getPartialOutput\(result\.messages\)/);
	assert.match(outputHelpers, /result\.errorMessage \|\| result\.stderr/);
	assert.match(outputHelpers, /\.filter\(Boolean\)\.join\("\\n\\n"\)/);
	assert.doesNotMatch(outputHelpers, /return result\.errorMessage \|\|/);
});

test("marks a parallel invocation as an error when any task fails", () => {
	const parallelResult = sourceSlice("const successCount = results.filter", "if (params.agent && params.task)");
	assert.match(parallelResult, /const hasFailures = results\.some\(isFailedResult\)/);
	assert.match(parallelResult, /isError: hasFailures/);
});

test("renders timeout diagnostics immediately and bypasses model fallback", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	const dispatch = sourceSlice("async function runSingleAgent(", "const TaskItem = Type.Object(");
	assert.match(attempt, /onTimeout\(diagnostic, elapsedMs\) \{[\s\S]*?stopReason = "timeout";[\s\S]*?errorMessage = diagnostic;[\s\S]*?emitUpdate\(elapsedMs\)/);
	assert.match(attempt, /error\.kind === "timeout"[\s\S]*?error\.diagnostic \?\? error\.message/);
	assert.match(dispatch, /isFailedResult\(result\) && result\.stopReason !== "timeout" && result\.stopReason !== "aborted"/);
});

test("preserves process and callback errors as result diagnostics for model fallback", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	assert.match(attempt, /else \{\s+currentResult\.stopReason = "error";\s+currentResult\.errorMessage \|\|= error\.diagnostic \?\? error\.message/);
});

test("maps an external watchdog abort to a structured result with elapsed time", () => {
	const attempt = sourceSlice("async function runSingleAgentAttempt", "async function runSingleAgent(");
	assert.match(attempt, /error\.kind === "aborted" && wasAborted/);
	assert.match(attempt, /currentResult\.elapsedMs = error\.elapsedMs/);
	assert.match(attempt, /currentResult\.stopReason = "aborted"/);
	assert.match(attempt, /currentResult\.errorMessage = "Subagent was aborted"/);
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

test("keeps the subagent dispatcher specific to subagent dispatch", () => {
	assert.match(subagentSource, /pi\.registerTool\(\{/);
	assert.doesNotMatch(subagentSource, /mainlineSync|pi-mainline-sync|pi\.on\("tool_call"/);
});

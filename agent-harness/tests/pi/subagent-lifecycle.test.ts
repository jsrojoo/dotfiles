import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../src/pi/extensions/subagent/index.ts", import.meta.url), "utf8");

test("subagent child lifecycle uses RPC through settlement and preserves structured failures", () => {
	assert.match(source, /"--mode",\s*"rpc",\s*"--no-session"/);
	assert.doesNotMatch(source, /"--mode",\s*"json"/);
	assert.doesNotMatch(source, /args\.push\(`Task: \$\{task\}`\)/);
	assert.match(source, /stdio: \["pipe", "pipe", "pipe"\]/);

	const stdoutHandlerIndex = source.indexOf('proc.stdout.on("data"');
	const promptWriteIndex = source.indexOf("writeRpcCommand(promptCommand)");
	assert.ok(stdoutHandlerIndex >= 0 && promptWriteIndex > stdoutHandlerIndex);
	assert.match(source, /type: "prompt", message: `Task: \$\{task\}`/);
	assert.match(source, /JSON\.stringify\(command\)\}\\n/);
	assert.match(source, /event\.type === "agent_settled"/);
	assert.doesNotMatch(source, /event\.type === "agent_end"[^}]*resolveOnce/s);

	assert.match(source, /event\.type === "response" && event\.success === false/);
	assert.match(source, /failRpc\(event\.error \|\|/);
	assert.match(source, /type: "abort"/);
	assert.match(source, /wasAborted = true;[\s\S]*?writeRpcCommand\(\{ id: "abort", type: "abort" \}\)/);
	assert.match(source, /setTimeout\(\(\) => watchdogAbortController\.abort\(signal\?\.reason\), 5000\)/);
	assert.match(source, /currentResult\.stopReason = "aborted"/);
	assert.match(source, /currentResult\.errorMessage = "Subagent was aborted"/);
	assert.doesNotMatch(source, /if \(wasAborted\) throw new Error/);

	assert.match(source, /Subagent exited before agent_settled/);
	assert.match(source, /const outcome = await runChild\(proc/);
	assert.match(source, /signal: watchdogAbortController\.signal/);
	assert.doesNotMatch(source, /proc\.(?:on|once)\("(?:close|error)"/);
	assert.match(source, /signal\.removeEventListener\("abort", abortProc\)/);
	assert.match(source, /const handleStdinError = \(error: unknown\) => failRpc\(error\)/);
	assert.match(source, /proc\.stdin\.on\("error", handleStdinError\)/);
	assert.match(source, /proc\.stdin\.removeListener\("error", handleStdinError\)/);
	assert.match(source, /if \(runChildSettled \|\| watchdogAbortController\.signal\.aborted\) return/);
	assert.match(source, /runChildSettled = true/);
	assert.match(source, /import \{ StringDecoder \} from "node:string_decoder"/);
	assert.match(source, /new StringDecoder\("utf8"\)/);
	assert.match(source, /decoder\.write\(data\)/);
	assert.match(source, /decoder\.end\(\)/);
	assert.match(source, /Malformed RPC JSONL/);
});

test("model fallback does not retry an aborted attempt or start after a stop in the callback gap", () => {
	assert.match(source, /isFailedResult\(result\) && result\.stopReason !== "timeout" && result\.stopReason !== "aborted"/);
	assert.match(source, /let stopRequested = signal\?\.aborted \?\? false/);
	assert.match(source, /stopRequested = true/);
	assert.match(source, /if \(stopRequested \|\| signal\?\.aborted\) return createAbortedResult\(model\)/);
	assert.match(source, /stopReason: "aborted"/);
	assert.match(source, /errorMessage: "Subagent was aborted"/);
});

test("tracks subagent invocations in a bounded session-local lifecycle registry", () => {
	assert.match(source, /const lifecycleEntries = new Map<string, LifecycleEntry>\(\)/);
	assert.match(source, /id: randomUUID\(\)/);
	assert.match(source, /state: "running"/);
	assert.match(source, /startedAt:/);
	assert.match(source, /updatedAt:/);
	assert.match(source, /latestActivity:/);
	assert.match(source, /messages: \[\]/);
	assert.match(source, /entry\.messages\.slice\(-MAX_LIFECYCLE_MESSAGES\)/);
	assert.match(source, /entry\.result = result/);
	assert.match(source, /entry\.send = undefined/);
	assert.match(source, /entry\.abort = undefined/);
});

test("updates lifecycle activity from authoritative RPC events and renders only in TUI mode", () => {
	assert.match(source, /event\.type === "message_end" && event\.message/);
	assert.match(source, /event\.type === "tool_execution_start"/);
	assert.match(source, /event\.type === "tool_execution_end"/);
	assert.match(source, /lifecycle\?\.onActivity/);
	assert.match(source, /if \(ctx\.mode !== "tui"\) return/);
	assert.match(source, /ctx\.ui\.setWidget\(\s*"subagent-lifecycle"/);
	assert.match(source, /\.slice\(0, MAX_WIDGET_ENTRIES\)/);
});

test("registers a native /agents registry viewer with lifecycle actions", () => {
	assert.match(source, /pi\.registerCommand\("agents"/);
	assert.match(source, /ctx\.ui\.select\("Subagents"/);
	assert.match(source, /const option = `\$\{truncateToWidth\([\s\S]*?\}\s+\(\$\{entry\.id\}\)`/);
	assert.match(source, /ctx\.ui\.notify\(renderLifecycleTranscript\(entry\)/);
	assert.match(source, /entry\.state === "running" \? \["Steer", "Stop", "Close"\] : \["Close"\]/);
	assert.match(source, /ctx\.ui\.input\("Steer subagent"/);
	assert.match(source, /entry\.send\(message\.trim\(\)\)/);
	assert.match(source, /entry\.abort\(\)/);
	assert.match(source, /Continuation unavailable/);
	assert.match(source, /\/agents is available only in TUI mode/);
});

test("renders compact conversation details and retains only the latest 50 settled entries", () => {
	assert.match(source, /const MAX_SETTLED_LIFECYCLE_ENTRIES = 50/);
	assert.match(source, /function pruneLifecycleEntries/);
	assert.match(source, /filter\(\(entry\) => entry\.state !== "running"\)/);
	assert.match(source, /\.slice\(MAX_SETTLED_LIFECYCLE_ENTRIES\)/);
	assert.match(source, /compactTranscriptLine\("Agent ID"/);
	assert.match(source, /compactTranscriptLine\("Task"/);
	assert.match(source, /compactTranscriptLine\("Latest activity"/);
	assert.match(source, /compactTranscriptLine\("Assistant"/);
	assert.match(source, /compactTranscriptLine\("Thinking"/);
	assert.match(source, /compactTranscriptLine\("Tool call"/);
	assert.match(source, /compactTranscriptLine\(\s*"Tool result"/);
	assert.match(source, /compactTranscriptLine\("Error\/abort detail"/);
	assert.match(source, /truncateToWidth/);
});

test("registers callable lifecycle status and stop tools", () => {
	assert.match(source, /const SubagentStatusParams = Type\.Object\(\{/);
	assert.match(source, /agentId: Type\.Optional\(Type\.String/);
	assert.match(source, /const SubagentStopParams = Type\.Object\(\{/);
	assert.match(source, /agentId: Type\.String/);
	assert.match(source, /name: "subagent_status"/);
	assert.match(source, /name: "subagent_stop"/);
});

test("status exposes stable IDs and reports full, unknown, and recent settled lifecycle entries", () => {
	assert.match(source, /renderLifecycleStatusSummary/);
	assert.match(source, /entry\.id/);
	assert.match(source, /renderLifecycleTranscript\(entry\)/);
	assert.match(source, /Unknown subagent ID/);
	assert.match(source, /isError: true/);
	assert.match(source, /lifecycleEntriesSort\(lifecycleEntries\.values\(\)\)/);
	assert.match(source, /compactTranscriptLine\("Started"/);
	assert.match(source, /compactTranscriptLine\("Settled"/);
});

test("stop uses the running RPC abort callback and rejects unknown or settled entries without mutation", () => {
	assert.match(source, /function requestLifecycleStop/);
	assert.match(source, /if \(entry\.state !== "running"\)/);
	assert.match(source, /if \(!entry\.abort\)/);
	assert.match(source, /entry\.abort\(\)/);
	assert.match(source, /requestLifecycleStop\(entry\)/);
	assert.match(source, /Subagent .* is already/);
	assert.match(source, /Stop requested for subagent/);
});

test("aborts running entries before clearing the lifecycle registry and widget on session shutdown", () => {
	const shutdownStart = source.indexOf('pi.on("session_shutdown"');
	const shutdownEnd = source.indexOf("});", shutdownStart);
	const shutdownHandler = source.slice(shutdownStart, shutdownEnd);
	assert.match(shutdownHandler, /for \(const entry of lifecycleEntries\.values\(\)\)/);
	assert.match(shutdownHandler, /if \(entry\.state === "running"\) entry\.abort\?\.\(\)/);
	assert.ok(shutdownHandler.indexOf("entry.abort?.()") < shutdownHandler.indexOf("lifecycleEntries.clear()"));
	assert.match(shutdownHandler, /lifecycleEntries\.clear\(\)/);
	assert.match(shutdownHandler, /ctx\.ui\.setWidget\("subagent-lifecycle", undefined\)/);
});

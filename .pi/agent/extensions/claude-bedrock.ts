import {
	type Api,
	type AssistantMessage,
	type AssistantMessageEventStream,
	calculateCost,
	collapseSystemMessages,
	createAssistantMessageEventStream,
	getCurrentSystemPrompt,
	getCurrentTools,
	type Message,
	type Model,
	type SimpleStreamOptions,
	type StopReason,
	type Tool,
	type TranscriptContext,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ANTHROPIC_VERSION = "bedrock-2023-05-31";
const DEFAULT_MAX_TOKENS = 64000;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_THINKING_BUDGET = 8192;
const CLAUDE_CONTEXT_WINDOW = 200000;
const CLAUDE_MAX_TOKENS = 64000;
const EVENT_STREAM_CONTENT_TYPE = "application/vnd.amazon.eventstream";
const EMPTY_TEXT_PLACEHOLDER = "<empty>";
const EVENT_STREAM_PRELUDE_LENGTH = 12;
const EVENT_STREAM_MESSAGE_CRC_LENGTH = 4;
const EVENT_STREAM_MINIMUM_MESSAGE_LENGTH = EVENT_STREAM_PRELUDE_LENGTH + EVENT_STREAM_MESSAGE_CRC_LENGTH;
const CRC32_POLYNOMIAL = 0xedb88320;

const claudeBedrockProviders = [
	{
		id: "atlas-bedrock",
		name: "Atlas Bedrock Claude",
		baseUrl: "https://apis.aitrium.app.atlas.gfs-emea-ai-platform.aws.fisv.cloud/v1/claude/chat/completions",
		apiKey: "$AITRIUM_LLM_PASSTHROUGH",
	},
] as const;

const claudeBedrockModelPhysicalIdByLogicalId = Object.freeze({
	"claude-sonnet-4-6": "eu.anthropic.claude-sonnet-4-6",
	"claude-sonnet-5": "eu.anthropic.claude-sonnet-5",
});
const claudeBedrockModels = Object.freeze(Object.keys(claudeBedrockModelPhysicalIdByLogicalId));

type ClaudeBedrockModelId = keyof typeof claudeBedrockModelPhysicalIdByLogicalId;

type ClaudeContent =
	| { type: "text"; text: string }
	| { type: "image"; source: { type: "base64"; media_type: string; data: string } }
	| { type: "tool_use"; id: string; name: string; input: unknown }
	| { type: "tool_result"; tool_use_id: string; content: ClaudeContent[]; is_error: boolean };

type ClaudeMessage = { role: "user" | "assistant"; content: ClaudeContent[] };
type ClaudeEvent = Record<string, unknown>;

const claudeGatewayUrlCreate = (baseUrl: string, physicalModelId: string) =>
	`${baseUrl}/model/${encodeURIComponent(physicalModelId)}/invoke-with-response-stream`;

const claudeBedrockModelPhysicalIdGet = (logicalModelId: string) => {
	const physicalModelId = claudeBedrockModelPhysicalIdByLogicalId[logicalModelId as ClaudeBedrockModelId];
	if (!physicalModelId) throw new Error(`Unsupported Claude Bedrock logical model ID: ${logicalModelId}`);
	return physicalModelId;
};

const claudeStopReasonMap = (reason: unknown): StopReason => {
	switch (reason) {
		case "end_turn":
		case "stop_sequence":
			return "stop";
		case "max_tokens":
			return "length";
		case "tool_use":
			return "toolUse";
		default:
			throw new Error(`Unsupported Claude stop reason: ${String(reason)}`);
	}
};

const claudeTextContentCreate = (text: string): ClaudeContent => ({
	type: "text",
	text: text.trim() === "" ? EMPTY_TEXT_PLACEHOLDER : text,
});

const claudeMessagesCreate = (messages: Message[]): ClaudeMessage[] => {
	const claudeMessages: ClaudeMessage[] = [];

	for (let index = 0; index < messages.length; index += 1) {
		const message = messages[index];
		if (message.role === "user") {
			const content = typeof message.content === "string"
				? [claudeTextContentCreate(message.content)]
				: message.content.map((block) =>
					block.type === "text"
						? claudeTextContentCreate(block.text)
						: { type: "image" as const, source: { type: "base64" as const, media_type: block.mimeType, data: block.data } },
				);
			claudeMessages.push({ role: "user", content });
			continue;
		}

		if (message.role === "assistant") {
			const content: ClaudeContent[] = message.content.flatMap((block) => {
				if (block.type === "text") return [claudeTextContentCreate(block.text)];
				if (block.type === "toolCall") return [{ type: "tool_use", id: block.id, name: block.name, input: block.arguments }];
				return [];
			});
			if (content.length > 0) claudeMessages.push({ role: "assistant", content });
			continue;
		}

		if (message.role !== "toolResult") continue;
		const content: ClaudeContent[] = [{
			type: "tool_result",
			tool_use_id: message.toolCallId,
			content: message.content.map((block) =>
				block.type === "text"
					? claudeTextContentCreate(block.text)
					: { type: "image" as const, source: { type: "base64" as const, media_type: block.mimeType, data: block.data } },
			),
			is_error: message.isError,
		}];
		while (index + 1 < messages.length && messages[index + 1].role === "toolResult") {
			index += 1;
			const toolResult = messages[index];
			if (toolResult.role !== "toolResult") continue;
			content.push({
				type: "tool_result",
				tool_use_id: toolResult.toolCallId,
				content: toolResult.content.map((block) =>
					block.type === "text"
						? claudeTextContentCreate(block.text)
						: { type: "image" as const, source: { type: "base64" as const, media_type: block.mimeType, data: block.data } },
				),
				is_error: toolResult.isError,
			});
		}
		claudeMessages.push({ role: "user", content });
	}

	return claudeMessages;
};

const claudeToolsCreate = (tools: Tool[]) =>
	tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: tool.parameters,
	}));

const claudePayloadCreate = (context: TranscriptContext, model: Model<Api>, options?: SimpleStreamOptions) => {
	const transcript = collapseSystemMessages(context);
	const systemPrompt = getCurrentSystemPrompt(transcript.messages);
	const tools = getCurrentTools(transcript.messages);
	const payload: Record<string, unknown> = {
		anthropic_version: ANTHROPIC_VERSION,
		messages: claudeMessagesCreate(transcript.messages),
		max_tokens: options?.maxTokens ?? Math.min(model.maxTokens, DEFAULT_MAX_TOKENS),
		temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
	};

	if (systemPrompt) payload.system = systemPrompt;
	if (tools.length > 0) payload.tools = claudeToolsCreate(tools);
	if (options?.reasoning && model.reasoning) {
		payload.thinking = {
			type: "enabled",
			budget_tokens: options.thinkingBudgets?.[options.reasoning] ?? DEFAULT_THINKING_BUDGET,
		};
	}

	return payload;
};

const crc32Calculate = (bytes: Uint8Array): number => {
	let checksum = 0xffffffff;
	for (const byte of bytes) {
		checksum ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			checksum = (checksum >>> 1) ^ (-(checksum & 1) & CRC32_POLYNOMIAL);
		}
	}
	return (checksum ^ 0xffffffff) >>> 0;
};

const uint32Read = (bytes: Uint8Array, offset: number) =>
	new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);

const bytesJoin = (left: Uint8Array, right: Uint8Array) => {
	const bytes = new Uint8Array(left.length + right.length);
	bytes.set(left);
	bytes.set(right, left.length);
	return bytes;
};

const claudeEventPayloadsExtract = (pendingBytes: Uint8Array, chunk: Uint8Array) => {
	let bytes = bytesJoin(pendingBytes, chunk);
	const payloads: Uint8Array[] = [];

	while (bytes.length >= EVENT_STREAM_PRELUDE_LENGTH) {
		const messageLength = uint32Read(bytes, 0);
		const headersLength = uint32Read(bytes, 4);
		if (messageLength < EVENT_STREAM_MINIMUM_MESSAGE_LENGTH) throw new Error("Invalid Bedrock event-stream message length");
		if (headersLength > messageLength - EVENT_STREAM_MINIMUM_MESSAGE_LENGTH) throw new Error("Invalid Bedrock event-stream headers length");
		if (bytes.length < messageLength) break;

		const preludeCrc = uint32Read(bytes, 8);
		if (crc32Calculate(bytes.subarray(0, 8)) !== preludeCrc) throw new Error("Invalid Bedrock event-stream prelude checksum");
		const messageCrc = uint32Read(bytes, messageLength - EVENT_STREAM_MESSAGE_CRC_LENGTH);
		if (crc32Calculate(bytes.subarray(0, messageLength - EVENT_STREAM_MESSAGE_CRC_LENGTH)) !== messageCrc) {
			throw new Error("Invalid Bedrock event-stream message checksum");
		}

		const payloadStart = EVENT_STREAM_PRELUDE_LENGTH + headersLength;
		payloads.push(bytes.subarray(payloadStart, messageLength - EVENT_STREAM_MESSAGE_CRC_LENGTH));
		bytes = bytes.subarray(messageLength);
	}

	return { payloads, pendingBytes: bytes };
};

const claudeEventParse = (payload: Uint8Array) => {
	const payloadText = new TextDecoder().decode(payload);
	const payloadEvent = JSON.parse(payloadText) as ClaudeEvent;
	const encodedEvent = payloadEvent.bytes;
	if (typeof encodedEvent !== "string") return { event: payloadEvent, eventText: payloadText };

	const eventBytes = Uint8Array.from(atob(encodedEvent), (character) => character.charCodeAt(0));
	const eventText = new TextDecoder().decode(eventBytes);
	return { event: JSON.parse(eventText) as ClaudeEvent, eventText };
};

function claudeBedrockStream(
	model: Model<Api>,
	context: TranscriptContext,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	void (async () => {
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "pending",
			timestamp: Date.now(),
		};

		try {
			const physicalModelId = claudeBedrockModelPhysicalIdGet(model.id);
			const response = await fetch(claudeGatewayUrlCreate(model.baseUrl, physicalModelId), {
				method: "POST",
				headers: { Authorization: `Bearer ${options?.apiKey ?? ""}`, "Content-Type": "application/json", Accept: EVENT_STREAM_CONTENT_TYPE },
				body: JSON.stringify(claudePayloadCreate(context, model, options)),
				signal: options?.signal,
			});
			if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
			if (!response.body) throw new Error("Claude gateway returned no response body");

			stream.push({ type: "start", partial: output });
			let pendingBytes = new Uint8Array();
			const blocks = new Map<number, number>();

			for await (const chunk of response.body) {
				const decoded = claudeEventPayloadsExtract(pendingBytes, chunk);
				pendingBytes = decoded.pendingBytes;
				for (const payload of decoded.payloads) {
					const { event, eventText } = claudeEventParse(payload);
					if (typeof event.type !== "string") throw new Error((event.message as string | undefined) ?? eventText);
					const eventType = event.type;
					if (eventType === "message_start") {
						const usage = (event.message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
						output.usage.input = usage?.input_tokens ?? 0;
						output.usage.output = usage?.output_tokens ?? 0;
					} else if (eventType === "content_block_start") {
						const blockIndex = event.index as number;
						const block = event.content_block as { type: string; id?: string; name?: string };
						if (block.type === "text") output.content.push({ type: "text", text: "" });
						else if (block.type === "thinking") output.content.push({ type: "thinking", thinking: "", thinkingSignature: "" });
						else if (block.type === "tool_use") output.content.push({ type: "toolCall", id: block.id ?? "", name: block.name ?? "", arguments: {} });
						else continue;
						const contentIndex = output.content.length - 1;
						blocks.set(blockIndex, contentIndex);
						const type = block.type === "text" ? "text_start" : block.type === "thinking" ? "thinking_start" : "toolcall_start";
						stream.push({ type, contentIndex, partial: output } as never);
					} else if (eventType === "content_block_delta") {
						const contentIndex = blocks.get(event.index as number);
						if (contentIndex === undefined) continue;
						const block = output.content[contentIndex];
						const delta = event.delta as { type: string; text?: string; thinking?: string; partial_json?: string; signature?: string };
						if (block.type === "text" && delta.type === "text_delta") {
							block.text += delta.text ?? "";
							stream.push({ type: "text_delta", contentIndex, delta: delta.text ?? "", partial: output });
						} else if (block.type === "thinking" && delta.type === "thinking_delta") {
							block.thinking += delta.thinking ?? "";
							stream.push({ type: "thinking_delta", contentIndex, delta: delta.thinking ?? "", partial: output });
						} else if (block.type === "thinking" && delta.type === "signature_delta") {
							block.thinkingSignature = (block.thinkingSignature ?? "") + (delta.signature ?? "");
						} else if (block.type === "toolCall" && delta.type === "input_json_delta") {
							const partialJson = ((block as { partialJson?: string }).partialJson ?? "") + (delta.partial_json ?? "");
							(block as { partialJson?: string }).partialJson = partialJson;
							try { block.arguments = JSON.parse(partialJson); } catch { /* Partial JSON is expected while streaming. */ }
							stream.push({ type: "toolcall_delta", contentIndex, delta: delta.partial_json ?? "", partial: output });
						}
					} else if (eventType === "content_block_stop") {
						const contentIndex = blocks.get(event.index as number);
						if (contentIndex === undefined) continue;
						const block = output.content[contentIndex];
						if (block.type === "text") stream.push({ type: "text_end", contentIndex, content: block.text, partial: output });
						else if (block.type === "thinking") stream.push({ type: "thinking_end", contentIndex, content: block.thinking, partial: output });
						else if (block.type === "toolCall") {
							const partialJson = (block as { partialJson?: string }).partialJson;
							if (partialJson) block.arguments = JSON.parse(partialJson);
							delete (block as { partialJson?: string }).partialJson;
							stream.push({ type: "toolcall_end", contentIndex, toolCall: block, partial: output });
						}
					} else if (eventType === "message_delta") {
						const delta = event.delta as { stop_reason?: unknown };
						output.stopReason = claudeStopReasonMap(delta.stop_reason);
						const usage = event.usage as { output_tokens?: number } | undefined;
						output.usage.output = usage?.output_tokens ?? output.usage.output;
					} else if (eventType === "message_stop" && output.stopReason === "pending") {
						output.stopReason = "stop";
					}
				}
			}

			if (pendingBytes.length > 0) throw new Error("Claude Bedrock stream ended with an incomplete event-stream message");
			if (output.stopReason === "pending" && output.content.length > 0) output.stopReason = "stop";
			if (output.stopReason === "pending") {
				throw new Error("Claude Bedrock stream ended without a stop reason");
			}
			output.usage.totalTokens = output.usage.input + output.usage.output;
			calculateCost(model, output.usage);
			stream.push({ type: "done", reason: output.stopReason, message: output });
			stream.end();
		} catch (error) {
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : String(error);
			stream.push({ type: "error", reason: output.stopReason, error: output });
			stream.end();
		}
	})();

	return stream;
}

export default function claudeBedrockProvidersRegister(pi: ExtensionAPI) {
	for (const provider of claudeBedrockProviders) {
		pi.registerProvider(provider.id, {
			...provider,
			api: "bedrock-converse-stream",
			models: claudeBedrockModels.map((id) => ({
				id,
				name: `${id} (${provider.name})`,
				reasoning: id === "claude-sonnet-4-6",
				input: ["text", "image"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: CLAUDE_CONTEXT_WINDOW,
				maxTokens: CLAUDE_MAX_TOKENS,
				thinkingLevelMap: { medium: "medium" },
			})),
			streamSimple: claudeBedrockStream,
		});
	}
}

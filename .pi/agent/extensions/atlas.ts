import {
	openAIResponsesApi,
	type Api,
	type FetchFunction,
	type Model,
	type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { atlasPayloadReasoningStatusRemove } from "./atlas/request-payload.ts";

const ATLAS_API_VERSION = "2025-04-01-preview";
const ATLAS_BASE_URL = "https://apis.aitrium.app.atlas.gfs-emea-ai-platform.aws.fisv.cloud/v1/codex";

const atlasFetch: FetchFunction = (input, init) => {
	const inputUrl = input instanceof Request ? input.url : input.toString();
	const url = new URL(inputUrl);
	url.searchParams.set("api-version", ATLAS_API_VERSION);

	if (input instanceof Request) {
		return fetch(new Request(url, input), init);
	}
	return fetch(url, init);
};

const responsesApi = openAIResponsesApi();
const atlasModels = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-6-luna"] as const;

export default function atlasProviderRegister(pi: ExtensionAPI) {
	pi.on("before_provider_request", (event, ctx) => {
		if (ctx.model?.provider !== "atlas") return;
		return atlasPayloadReasoningStatusRemove(event.payload);
	});

	pi.registerProvider("atlas", {
		name: "Atlas",
		baseUrl: ATLAS_BASE_URL,
		api: "openai-responses",
		apiKey: "$AITRIUM_LLM_PASSTHROUGH",
		models: atlasModels.map((id) => ({
			id,
			name: `${id} (Atlas)`,
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 300000,
			maxTokens: 128000,
			thinkingLevelMap: { off: "none", minimal: null, xhigh: "xhigh", max: "max" },
		})),
		streamSimple: (model: Model<Api>, context, options?: SimpleStreamOptions) =>
			responsesApi.streamSimple(model, context, { ...options, fetch: atlasFetch }),
	});
}

const MAIN_PROVIDER_CHILD_SUPPORTED = new Set(["atlas", "azure", "atlas-bedrock"]);
const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls"]);
const MAX_MODEL_ATTEMPTS = 3;

function sharedAgentProviderChildCompute(
	mainProvider: string | undefined,
	sharedProvider: string | undefined,
): string | undefined {
	return sharedProvider ?? (mainProvider && MAIN_PROVIDER_CHILD_SUPPORTED.has(mainProvider) ? mainProvider : undefined);
}

export function sharedAgentModelSelectorBuild(
	model: string | undefined,
	sharedProvider: string | undefined,
	mainProvider: string | undefined,
): string | undefined {
	if (!model) return undefined;
	const childProvider = sharedAgentProviderChildCompute(mainProvider, sharedProvider);
	return childProvider ? `${childProvider}/${model}` : model;
}

export function subagentModelCandidatesBuild(
	agent: { model?: string; fallbackModels?: string[]; tools?: string[] },
	inheritedModel: string | undefined,
): Array<string | undefined> {
	if (agent.fallbackModels?.length && (!agent.tools || agent.tools.some((tool) => !READ_ONLY_TOOLS.has(tool)))) {
		throw new Error("Subagent fallback models require explicitly read-only tools.");
	}

	const candidates = [agent.model ?? inheritedModel, ...(agent.fallbackModels ?? [])];
	return [...new Set(candidates)].slice(0, MAX_MODEL_ATTEMPTS);
}

export async function subagentModelFallbackRun<T>(
	models: Array<string | undefined>,
	run: (model: string | undefined) => Promise<T>,
	isFailed: (result: T) => boolean,
): Promise<T> {
	let result: T | undefined;
	for (const model of models) {
		result = await run(model);
		if (!isFailed(result)) return result;
	}
	return result!;
}

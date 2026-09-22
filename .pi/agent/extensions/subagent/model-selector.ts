const MAIN_PROVIDER_CHILD_SUPPORTED = new Set(["atlas", "azure", "atlas-bedrock"]);

function sharedAgentProviderChildCompute(
	mainProvider: string | undefined,
	sharedProvider: string | undefined,
): string | undefined {
	return mainProvider && MAIN_PROVIDER_CHILD_SUPPORTED.has(mainProvider) ? mainProvider : sharedProvider;
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

const SHARED_PROVIDER_OVERRIDES: Readonly<Record<string, string>> = {
	atlas: "azure",
};

export function sharedAgentModelSelectorBuild(
	model: string | undefined,
	provider: string | undefined,
): string | undefined {
	if (!model) return undefined;
	if (!provider) return model;
	const providerResolved = SHARED_PROVIDER_OVERRIDES[provider] ?? provider;
	return `${providerResolved}/${model}`;
}

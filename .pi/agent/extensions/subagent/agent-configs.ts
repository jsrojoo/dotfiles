export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	model?: string;
	/** Max output tokens per generation, enforced by code-size-guardrail via PI_CODE_TOKEN_BUDGET. */
	maxOutputTokens?: number;
	systemPrompt: string;
	source: "user" | "project";
	filePath: string;
}

export function agentConfigsMerge(
	scope: AgentScope,
	sharedAgents: AgentConfig[],
	userAgents: AgentConfig[],
	projectAgents: AgentConfig[],
): AgentConfig[] {
	const agentMap = new Map<string, AgentConfig>();
	const agentGroups =
		scope === "both"
			? [sharedAgents, userAgents, projectAgents]
			: scope === "user"
				? [sharedAgents, userAgents]
				: [projectAgents];

	for (const agents of agentGroups) {
		for (const agent of agents) agentMap.set(agent.name, agent);
	}

	return Array.from(agentMap.values());
}

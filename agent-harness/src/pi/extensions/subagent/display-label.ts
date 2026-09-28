export function subagentDisplayLabelBuild(agent: string, purpose?: string): string {
	const normalizedPurpose = purpose?.replace(/\s+/g, " ").trim();
	return normalizedPurpose ? `${agent}: ${normalizedPurpose}` : agent;
}

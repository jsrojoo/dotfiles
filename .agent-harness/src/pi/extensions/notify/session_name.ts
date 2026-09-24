export function piSessionNameResolve(
	sessionNameCandidate: unknown,
	sessionId: string,
): string {
	if (typeof sessionNameCandidate !== "string") return sessionId;

	const sessionName = sessionNameCandidate.trim();
	return sessionName || sessionId;
}

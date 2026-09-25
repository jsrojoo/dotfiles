export function defaultContextTasks(task: string): Array<{ agent: string; task: string }> {
	return [
		{ agent: "context", task: `${task}\n\nFocus: map relevant files, repository structure, and configuration boundaries.` },
		{ agent: "context", task: `${task}\n\nFocus: trace relevant behavior, callers, and implementation flow.` },
		{ agent: "context", task: `${task}\n\nFocus: inspect relevant tests, conventions, and verification risks.` },
	];
}

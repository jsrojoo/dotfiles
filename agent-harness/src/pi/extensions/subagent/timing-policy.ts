export const SUBAGENT_HEARTBEAT_INTERVAL_MS = 60_000;
export const SUBAGENT_TIMEOUT_MS = 300_000;

export function validatePositiveFiniteDuration(durationMs: number): number {
	if (!Number.isFinite(durationMs) || durationMs <= 0) {
		throw new RangeError("Duration must be positive finite milliseconds");
	}
	return durationMs;
}

function validateTime(timeMs: number, name: string): void {
	if (!Number.isFinite(timeMs) || timeMs < 0) {
		throw new RangeError(`${name} must be finite non-negative milliseconds`);
	}
}

export function hasDurationExpired(startTimeMs: number, currentTimeMs: number, limitMs: number): boolean {
	validateTime(startTimeMs, "Start time");
	validateTime(currentTimeMs, "Current time");
	validatePositiveFiniteDuration(limitMs);
	if (currentTimeMs < startTimeMs) {
		throw new RangeError("Current time must not precede start time");
	}
	return currentTimeMs - startTimeMs >= limitMs;
}

function formatCompactSeconds(durationMs: number): string {
	if (durationMs > 0 && durationMs < 100) return "<0.1s";
	return `${(durationMs / 1000).toFixed(1)}s`;
}

export function buildTimeoutDiagnostic(elapsedMs: number, limitMs: number): string {
	validateTime(elapsedMs, "Elapsed time");
	validatePositiveFiniteDuration(limitMs);
	return `Subagent timed out after ${formatCompactSeconds(elapsedMs)} (limit ${formatCompactSeconds(limitMs)}). Parent: inspect partial output/logs and re-scope to a smaller actionable task.`;
}

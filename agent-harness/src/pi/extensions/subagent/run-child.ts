import type { ChildProcess } from "node:child_process";
import {
	SUBAGENT_HEARTBEAT_INTERVAL_MS,
	SUBAGENT_TIMEOUT_MS,
	buildTimeoutDiagnostic,
	validatePositiveFiniteDuration,
} from "./timing-policy.ts";

export const SUBAGENT_TERMINATION_GRACE_MS = 5_000;

export type ChildRunErrorKind = "aborted" | "callback" | "process" | "timeout";

export interface ChildRunResult {
	exitCode: number | null;
	signal: NodeJS.Signals | null;
	elapsedMs: number;
}

export class ChildRunError extends Error {
	readonly kind: ChildRunErrorKind;
	readonly elapsedMs: number;
	readonly diagnostic?: string;

	constructor(kind: ChildRunErrorKind, message: string, elapsedMs: number, options?: ErrorOptions & { diagnostic?: string }) {
		super(message, options);
		this.name = "ChildRunError";
		this.kind = kind;
		this.elapsedMs = elapsedMs;
		this.diagnostic = options?.diagnostic;
	}
}

export interface RunChildOptions {
	signal?: AbortSignal;
	now?: () => number;
	heartbeatIntervalMs?: number;
	timeoutMs?: number;
	terminationGraceMs?: number;
	onHeartbeat?: (elapsedMs: number) => void;
	onTimeout?: (diagnostic: string, elapsedMs: number) => void;
}

/** Monitor an already-spawned child without consuming any of its output streams. */
export function runChild(child: ChildProcess, options: RunChildOptions = {}): Promise<ChildRunResult> {
	const now = options.now ?? (() => performance.now());
	const heartbeatIntervalMs = validatePositiveFiniteDuration(
		options.heartbeatIntervalMs ?? SUBAGENT_HEARTBEAT_INTERVAL_MS,
	);
	const timeoutMs = validatePositiveFiniteDuration(options.timeoutMs ?? SUBAGENT_TIMEOUT_MS);
	const terminationGraceMs = validatePositiveFiniteDuration(
		options.terminationGraceMs ?? SUBAGENT_TERMINATION_GRACE_MS,
	);
	let startTimeMs: number;
	try {
		startTimeMs = now();
	} catch (error) {
		const callbackError = error instanceof Error ? error : new Error(String(error));
		return Promise.reject(new ChildRunError("callback", callbackError.message, 0, { cause: callbackError }));
	}
	if (!Number.isFinite(startTimeMs) || startTimeMs < 0) {
		throw new RangeError("Monotonic time must be finite non-negative milliseconds");
	}

	return new Promise((resolve, reject) => {
		let closed = false;
		let settled = false;
		let lastElapsedMs = 0;
		let stoppedAtMs: number | undefined;
		let pendingError: ChildRunError | undefined;
		let escalationTimer: NodeJS.Timeout | undefined;

		const elapsed = (): number => {
			if (stoppedAtMs !== undefined) return stoppedAtMs;
			const currentTimeMs = now();
			if (!Number.isFinite(currentTimeMs) || currentTimeMs < startTimeMs) {
				throw new RangeError("Monotonic time must be finite and not precede the start time");
			}
			lastElapsedMs = currentTimeMs - startTimeMs;
			return lastElapsedMs;
		};

		const freezeElapsed = (): number => {
			stoppedAtMs ??= elapsed();
			return stoppedAtMs;
		};

		let heartbeatTimer: NodeJS.Timeout | undefined;
		let timeoutTimer: NodeJS.Timeout;

		const cleanup = (): void => {
			if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
			clearTimeout(timeoutTimer);
			if (escalationTimer !== undefined) clearTimeout(escalationTimer);
			child.removeListener("close", onClose);
			child.removeListener("error", onError);
			options.signal?.removeEventListener("abort", onAbort);
		};

		const finish = (result?: ChildRunResult, error?: ChildRunError): void => {
			if (settled) return;
			settled = true;
			cleanup();
			if (error !== undefined) reject(error);
			else resolve(result!);
		};

		const isChildOpen = (): boolean => !closed && child.exitCode === null && child.signalCode === null;

		const setCallbackError = (error: unknown): void => {
			if (pendingError !== undefined || settled) return;
			const callbackError = error instanceof Error ? error : new Error(String(error));
			stoppedAtMs ??= lastElapsedMs;
			pendingError = new ChildRunError("callback", callbackError.message, stoppedAtMs, { cause: callbackError });
			if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
			clearTimeout(timeoutTimer);
			terminate();
		};

		function terminate(): void {
			if (!isChildOpen()) {
				finish(undefined, pendingError);
				return;
			}
			try {
				if (!child.kill("SIGTERM")) {
					finish(undefined, pendingError);
					return;
				}
			} catch {
				finish(undefined, pendingError);
				return;
			}
			escalationTimer = setTimeout(() => {
				if (!isChildOpen()) return;
				try {
					if (!child.kill("SIGKILL")) finish(undefined, pendingError);
				} catch {
					finish(undefined, pendingError);
				}
			}, terminationGraceMs);
		}

		function onClose(exitCode: number | null, signal: NodeJS.Signals | null): void {
			closed = true;
			try {
				const elapsedMs = freezeElapsed();
				if (pendingError !== undefined) finish(undefined, pendingError);
				else finish({ exitCode, signal, elapsedMs });
			} catch (error) {
				setCallbackError(error);
			}
		}

		function onError(error: Error): void {
			try {
				const elapsedMs = freezeElapsed();
				finish(undefined, pendingError ?? new ChildRunError("process", error.message, elapsedMs, { cause: error }));
			} catch (callbackError) {
				setCallbackError(callbackError);
			}
		}

		function onAbort(): void {
			if (pendingError !== undefined || settled) return;
			try {
				const elapsedMs = freezeElapsed();
				pendingError = new ChildRunError("aborted", "Subagent was aborted by the caller", elapsedMs, {
					cause: options.signal?.reason,
				});
				if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
				clearTimeout(timeoutTimer);
				terminate();
			} catch (error) {
				setCallbackError(error);
			}
		}

		if (options.onHeartbeat !== undefined) {
			heartbeatTimer = setInterval(() => {
				if (pendingError !== undefined || options.onHeartbeat === undefined) return;
				try {
					options.onHeartbeat(elapsed());
				} catch (error) {
					setCallbackError(error);
				}
			}, heartbeatIntervalMs);
		}
		timeoutTimer = setTimeout(() => {
			if (settled) return;
			const elapsedMs = timeoutMs;
			stoppedAtMs = elapsedMs;
			lastElapsedMs = elapsedMs;
			const diagnostic = buildTimeoutDiagnostic(elapsedMs, timeoutMs);
			pendingError = new ChildRunError("timeout", diagnostic, elapsedMs, { diagnostic });
			if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
			try {
				options.onTimeout?.(diagnostic, elapsedMs);
			} catch {
				// The typed timeout remains authoritative over callback failures.
			}
			if (isChildOpen()) {
				try {
					child.kill("SIGKILL");
				} catch {
					// Kill failures must not delay or replace the timeout diagnostic.
				}
			}
			finish(undefined, pendingError);
		}, timeoutMs);

		child.once("close", onClose);
		child.once("error", onError);
		options.signal?.addEventListener("abort", onAbort, { once: true });

		if (child.exitCode !== null || child.signalCode !== null) {
			onClose(child.exitCode, child.signalCode);
		} else if (options.signal?.aborted) {
			onAbort();
		}
	});
}

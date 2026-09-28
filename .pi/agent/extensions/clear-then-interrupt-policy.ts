export type EditorInput = "ctrl+c" | "escape" | "other";
export type EditorInputAction = "abort" | "clear" | "consume" | "delegate";

const DOUBLE_PRESS_MS = 500;

export function createEditorInputPolicy(
	now: () => number = Date.now,
): (input: EditorInput, isIdle: boolean) => EditorInputAction {
	let lastCtrlC: number | undefined;

	return (input, isIdle) => {
		if (input !== "ctrl+c") {
			lastCtrlC = undefined;
			return input === "escape" && !isIdle ? "consume" : "delegate";
		}

		const pressedAt = now();
		const elapsed = lastCtrlC === undefined ? undefined : pressedAt - lastCtrlC;
		if (elapsed !== undefined && elapsed >= 0 && elapsed <= DOUBLE_PRESS_MS) {
			lastCtrlC = undefined;
			return isIdle ? "consume" : "abort";
		}

		lastCtrlC = pressedAt;
		return "clear";
	};
}

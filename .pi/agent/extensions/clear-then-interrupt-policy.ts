export type EditorInput = "ctrl+c" | "escape" | "other";
export type EditorInputAction = "abort" | "clear" | "consume" | "delegate";

const DOUBLE_PRESS_MS = 500;
const VIEWPORT_INPUT_BRIDGE_STATE = Symbol.for(
	"dotfiles.custom-keybinds.viewport-input-bridge",
);

export type ViewportInputHandler = (data: string) => unknown;
export type ViewportInputBridgeTarget = {
	getFocusedComponent?: () => { constructor?: { name?: string } } | null;
	handleViewportInput?: ViewportInputHandler;
};

type ViewportInputBridgeState = {
	ownerToken: symbol;
	baseOriginalHandler: ViewportInputHandler;
	bridgeHandler: ViewportInputHandler;
};
type StatefulViewportInputBridgeTarget = ViewportInputBridgeTarget & {
	[VIEWPORT_INPUT_BRIDGE_STATE]?: ViewportInputBridgeState;
};

export function shouldDeferCtrlUToTree(
	isCtrlU: boolean,
	focusedComponentName: string | undefined,
): boolean {
	return isCtrlU && focusedComponentName === "TreeSelectorComponent";
}

export function installViewportInputBridge(
	target: ViewportInputBridgeTarget,
	isCtrlU: (data: string) => boolean,
): () => void {
	const viewportTarget = target as StatefulViewportInputBridgeTarget;
	const existingState = viewportTarget[VIEWPORT_INPUT_BRIDGE_STATE];
	if (existingState) {
		if (viewportTarget.handleViewportInput === existingState.bridgeHandler) {
			viewportTarget.handleViewportInput = existingState.baseOriginalHandler;
		}
		delete viewportTarget[VIEWPORT_INPUT_BRIDGE_STATE];
	}

	const baseOriginalHandler = viewportTarget.handleViewportInput;
	if (
		typeof baseOriginalHandler !== "function" ||
		typeof viewportTarget.getFocusedComponent !== "function"
	) {
		return () => {};
	}

	const ownerToken = Symbol("viewport-input-bridge-installation");
	const bridgeHandler: ViewportInputHandler = (data) => {
		const focusedComponentName = viewportTarget.getFocusedComponent?.call(
			viewportTarget,
		)?.constructor?.name;
		if (shouldDeferCtrlUToTree(isCtrlU(data), focusedComponentName)) {
			return undefined;
		}

		return baseOriginalHandler.call(viewportTarget, data);
	};

	viewportTarget[VIEWPORT_INPUT_BRIDGE_STATE] = {
		ownerToken,
		baseOriginalHandler,
		bridgeHandler,
	};
	viewportTarget.handleViewportInput = bridgeHandler;

	return () => {
		const currentState = viewportTarget[VIEWPORT_INPUT_BRIDGE_STATE];
		if (currentState?.ownerToken !== ownerToken) return;

		if (viewportTarget.handleViewportInput === currentState.bridgeHandler) {
			viewportTarget.handleViewportInput = currentState.baseOriginalHandler;
		}
		delete viewportTarget[VIEWPORT_INPUT_BRIDGE_STATE];
	};
}

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

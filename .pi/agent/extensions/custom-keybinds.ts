import {
	CustomEditor,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { matchesKey, type TUI } from "@earendil-works/pi-tui";

import {
	createEditorInputPolicy,
	shouldDeferCtrlUToTree,
	type EditorInput,
} from "./clear-then-interrupt-policy.ts";

const VIEWPORT_INPUT_BRIDGE_STATE = Symbol.for(
	"dotfiles.custom-keybinds.viewport-input-bridge",
);
const VIEWPORT_INPUT_BRIDGE_OWNER = Symbol("custom-keybinds");

type ViewportInputResult = { consume?: boolean; data?: string } | undefined;
type ViewportInputHandler = (data: string) => ViewportInputResult;
type ViewportInputBridgeState = {
	ownerToken: symbol;
	baseOriginalHandler: ViewportInputHandler;
	bridgeHandler: ViewportInputHandler;
};
type PrivateViewportTui = TUI & {
	getFocusedComponent?: () => { constructor?: { name?: string } } | null;
	handleViewportInput?: ViewportInputHandler;
	[VIEWPORT_INPUT_BRIDGE_STATE]?: ViewportInputBridgeState;
};

function installViewportInputBridge(tui: TUI): () => void {
	const viewportTui = tui as PrivateViewportTui;
	const existingState = viewportTui[VIEWPORT_INPUT_BRIDGE_STATE];
	if (existingState) {
		viewportTui.handleViewportInput = existingState.baseOriginalHandler;
		delete viewportTui[VIEWPORT_INPUT_BRIDGE_STATE];
	}

	const baseOriginalHandler = viewportTui.handleViewportInput;
	if (
		typeof baseOriginalHandler !== "function" ||
		typeof viewportTui.getFocusedComponent !== "function"
	) {
		return () => {};
	}

	const bridgeHandler: ViewportInputHandler = (data) => {
		const focusedComponentName = viewportTui.getFocusedComponent?.call(viewportTui)
			?.constructor?.name;
		if (
			shouldDeferCtrlUToTree(
				matchesKey(data, "ctrl+u"),
				focusedComponentName,
			)
		) {
			return undefined;
		}

		return baseOriginalHandler.call(viewportTui, data);
	};

	viewportTui[VIEWPORT_INPUT_BRIDGE_STATE] = {
		ownerToken: VIEWPORT_INPUT_BRIDGE_OWNER,
		baseOriginalHandler,
		bridgeHandler,
	};
	viewportTui.handleViewportInput = bridgeHandler;

	return () => {
		const currentState = viewportTui[VIEWPORT_INPUT_BRIDGE_STATE];
		if (currentState?.ownerToken !== VIEWPORT_INPUT_BRIDGE_OWNER) return;

		if (viewportTui.handleViewportInput === currentState.bridgeHandler) {
			viewportTui.handleViewportInput = currentState.baseOriginalHandler;
		}
		delete viewportTui[VIEWPORT_INPUT_BRIDGE_STATE];
	};
}

export default function customKeybinds(pi: ExtensionAPI): void {
	let cleanupViewportInputBridge: (() => void) | undefined;

	pi.on("session_start", (_event, ctx) => {
		cleanupViewportInputBridge?.();
		cleanupViewportInputBridge = undefined;

		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			cleanupViewportInputBridge?.();
			cleanupViewportInputBridge = installViewportInputBridge(tui);
			const handleInput = createEditorInputPolicy();

			return new class extends CustomEditor {
				override handleInput(data: string): void {
					const input: EditorInput = matchesKey(data, "ctrl+c")
						? "ctrl+c"
						: matchesKey(data, "escape")
							? "escape"
							: "other";

					switch (handleInput(input, ctx.isIdle())) {
						case "abort":
							ctx.abort();
							return;
						case "clear":
							ctx.ui.setEditorText("");
							return;
						case "consume":
							return;
						case "delegate":
							super.handleInput(data);
					}
				}
			}(tui, theme, keybindings);
		});
	});

	pi.on("session_shutdown", () => {
		cleanupViewportInputBridge?.();
		cleanupViewportInputBridge = undefined;
	});
}

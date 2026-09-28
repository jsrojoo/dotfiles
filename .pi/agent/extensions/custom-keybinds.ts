import {
	CustomEditor,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

import {
	createEditorInputPolicy,
	type EditorInput,
	installViewportInputBridge,
	type ViewportInputBridgeTarget,
} from "./clear-then-interrupt-policy.ts";

export default function customKeybinds(pi: ExtensionAPI): void {
	let cleanupViewportInputBridge: (() => void) | undefined;

	pi.on("session_start", (_event, ctx) => {
		cleanupViewportInputBridge?.();
		cleanupViewportInputBridge = undefined;

		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			cleanupViewportInputBridge?.();
			cleanupViewportInputBridge = installViewportInputBridge(
				tui as unknown as ViewportInputBridgeTarget,
				(data) => matchesKey(data, "ctrl+u"),
			);

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

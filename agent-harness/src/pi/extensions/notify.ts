import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { piSessionNameResolve } from "#agent-harness/pi/extensions/notify/session_name";

export function notificationScriptPathResolve(
	moduleUrl: string = import.meta.url,
): string {
	return fileURLToPath(new URL("../../hooks/notification.py", moduleUrl));
}

const NOTIFIER_PATH = notificationScriptPathResolve();
const notifierExecute = promisify(execFile);

export default function notifyRegister(pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		const sessionId = ctx.sessionManager.getSessionId();
		const sessionName = piSessionNameResolve(pi.getSessionName(), sessionId);
		const notificationPayload = JSON.stringify({
			type: "agent-turn-complete",
			client: "pi",
			session_id: sessionId,
			session_name: sessionName,
		});

		try {
			await notifierExecute("python3", [NOTIFIER_PATH, notificationPayload], {
				env: { ...process.env, NOTIFY_APP_NAME: "Pi" },
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Pi notification failed: ${errorMessage}`, "warning");
		}
	});
}

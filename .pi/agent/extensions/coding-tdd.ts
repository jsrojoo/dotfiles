import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function register(pi: ExtensionAPI): Promise<void> {
	const { default: registerShared } = await import(
		join(homedir(), "dotfiles/agent-harness/src/pi/extensions/coding/register-test-driven-development.ts")
	);
	registerShared(pi);
}

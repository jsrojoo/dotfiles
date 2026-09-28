import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function register(pi: ExtensionAPI): Promise<void> {
	const { default: sqlGuardrailRegister } = await import(
		join(homedir(), "dotfiles/agent-harness/src/pi/extensions/sql/register-sql-guardrail.ts")
	);
	sqlGuardrailRegister(pi);
}

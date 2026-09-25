import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function register(pi: ExtensionAPI): Promise<void> {
	const [{ testDrivenDevelopmentEnforcementCreate }, { Type }] = await Promise.all([
		import(join(homedir(), "dotfiles/agent-harness/src/pi/extensions/coding/register-test-driven-development.ts")),
		import("typebox"),
	]);
	testDrivenDevelopmentEnforcementCreate(Type.Object({}))(pi);
}

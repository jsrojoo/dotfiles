/**
 * Agent discovery and configuration
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { agentConfigsMerge, type AgentConfig, type AgentScope } from "./agent-configs.ts";
import { sharedAgentModelSelectorBuild } from "./model-selector.ts";

export { type AgentConfig, type AgentScope } from "./agent-configs.ts";

const SHARED_AGENTS_DIR = path.join(os.homedir(), ".agents", "agents");
const BUNDLED_AGENTS_DIR = path.resolve(import.meta.dirname, "../../../../agents");

export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
}

/**
 * Raw agent frontmatter. Values are `unknown` because `parseFrontmatter` runs a
 * real YAML parser, so any scalar or collection can appear here.
 *
 * A type alias rather than an interface: `parseFrontmatter` constrains its
 * parameter to `Record<string, unknown>`, and only an alias picks up the
 * implicit index signature that satisfies it.
 */
type AgentFrontmatter = {
	name?: unknown;
	description?: unknown;
	tools?: unknown;
	skills?: unknown;
	extensions?: unknown;
	model?: unknown;
	fallbackModels?: unknown;
};

/**
 * Normalize a frontmatter `tools` value to a list of tool names.
 *
 * Both spellings are valid YAML and both are in use:
 *
 *     tools: read, bash        # string
 *     tools: [read, bash]      # array
 *
 * so accept either. Anything else (a number, a map, a nested list) yields no
 * tools rather than throwing: this runs inside agent discovery, where a single
 * bad file must not take down every other agent in the same directory.
 */
function parseResourceList(value: unknown): string[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) && typeof value !== "string") return undefined;

	const raw = Array.isArray(value) ? value : value.split(",");
	return raw
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseToolList(value: unknown): string[] | undefined {
	const tools = parseResourceList(value);
	return tools?.length ? tools : undefined;
}

function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[] {
	const agents: AgentConfig[] = [];

	if (!fs.existsSync(dir)) {
		return agents;
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return agents;
	}

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content);

		if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
			continue;
		}

		agents.push({
			name: frontmatter.name,
			description: frontmatter.description,
			tools: parseToolList(frontmatter.tools),
			skills: parseResourceList(frontmatter.skills),
			extensions: parseResourceList(frontmatter.extensions),
			model: typeof frontmatter.model === "string" ? frontmatter.model : undefined,
			fallbackModels: parseResourceList(frontmatter.fallbackModels),
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return agents;
}

function parseSharedAgentString(content: string, key: string): string | undefined {
	const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = content.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*"((?:\\\\.|[^"\\\\])*)"\\s*$`, "m"));
	if (!match) return undefined;

	try {
		return JSON.parse(`"${match[1]}"`) as string;
	} catch {
		return match[1];
	}
}

function loadSharedAgents(dirs: string[], mainProvider: string | undefined): AgentConfig[] {
	const agents: AgentConfig[] = [];
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;

		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
		if (!entry.name.endsWith(".toml")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const tomlPath = path.join(dir, entry.name);
		const promptPath = path.join(dir, `${path.basename(entry.name, ".toml")}.md`);
		let prompt: string;
		let toml: string;
		try {
			toml = fs.readFileSync(tomlPath, "utf-8");
			prompt = fs.readFileSync(promptPath, "utf-8");
		} catch {
			continue;
		}

		const description = parseSharedAgentString(toml, "description");
		const name = parseSharedAgentString(toml, "name");
		if (!description || !name || !prompt.trim()) continue;

		const model = parseSharedAgentString(toml, "model");
		const modelProvider = parseSharedAgentString(toml, "model_provider");
			const sandboxMode = parseSharedAgentString(toml, "sandbox_mode");
		const fallbackModels = parseSharedAgentString(toml, "fallback_models")
			?.split(",")
			.map((value) => value.trim())
			.filter(Boolean);

			agents.push({
				name,
				description,
				tools: sandboxMode === "read-only" ? ["read", "grep", "find", "ls"] : undefined,
				model: sharedAgentModelSelectorBuild(model, modelProvider, mainProvider),
				fallbackModels,
				systemPrompt: prompt,
				source: "user",
				filePath: tomlPath,
			});
		}
	}

	return agents;
}

function isDirectory(p: string): boolean {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, CONFIG_DIR_NAME, "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

export function discoverAgents(
	cwd: string,
	scope: AgentScope,
	mainProvider: string | undefined,
): AgentDiscoveryResult {
	const userDir = path.join(getAgentDir(), "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const sharedAgents = scope === "project" ? [] : loadSharedAgents([BUNDLED_AGENTS_DIR, SHARED_AGENTS_DIR], mainProvider);
	const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
	const projectAgents = scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project");

	return { agents: agentConfigsMerge(scope, sharedAgents, userAgents, projectAgents), projectAgentsDir };
}

export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: "none", remaining: 0 };
	const listed = agents.slice(0, maxItems);
	const remaining = agents.length - listed.length;
	return {
		text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
		remaining,
	};
}

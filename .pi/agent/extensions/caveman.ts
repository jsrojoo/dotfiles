/**
 * Caveman extension for pi — always-on communication mode.
 *
 * Injects caveman instructions into every agent turn via before_agent_start,
 * mirroring how the Codex caveman plugin works via session start hooks.
 *
 * Supports /caveman [lite|full|ultra|off|status] to change intensity at runtime.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL_PATH =
  "/Users/josephrojo/dotfiles/.codex/plugins/cache/caveman-repo/caveman/local/skills/caveman/SKILL.md";

const DEFAULT_LEVEL = "full";
const LEVELS = ["lite", "full", "ultra", "off"] as const;
type Level = (typeof LEVELS)[number];

function loadSkillBody(): string {
  try {
    const raw = readFileSync(SKILL_PATH, "utf8");
    // Strip frontmatter (--- ... ---)
    const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\s*/m, "").trim();
    return withoutFrontmatter;
  } catch {
    // Fallback inline if file missing
    return `Respond terse like smart caveman. All technical substance stay. Only fluff die.
Drop: articles (a/an/the), filler, pleasantries, hedging. Fragments OK.
Technical terms exact. Code blocks unchanged.`;
  }
}

export default function caveman(pi: ExtensionAPI) {
  let level: Level = DEFAULT_LEVEL;
  const skillBody = loadSkillBody();

  const setLevel = (next: Level, ctx?: { ui?: { notify?: Function } }) => {
    level = next;
    ctx?.ui?.notify?.(`Caveman: ${level === "off" ? "deactivated" : `active (${level})`}`, "info");
  };

  pi.registerCommand("caveman", {
    description: "Set caveman mode: lite | full | ultra | off | status",
    handler: (args, ctx) => {
      const arg = String(args || "").trim().toLowerCase();

      if (!arg || arg === "on") {
        setLevel(level === "off" ? DEFAULT_LEVEL : level, ctx);
        return;
      }
      if (arg === "status") {
        ctx.ui.notify(`Caveman: ${level === "off" ? "off" : level}`, "info");
        return;
      }
      if (LEVELS.includes(arg as Level)) {
        setLevel(arg as Level, ctx);
        return;
      }
      ctx.ui.notify(`Unknown level "${arg}". Use: ${LEVELS.join(" | ")}`, "warning");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify?.(`Caveman active (${level})`, "info");
  });

  pi.on("before_agent_start", async (event) => {
    if (level === "off") return;

    const header = `## Caveman Mode (${level})\n\n`;
    const base = event.systemPrompt ? `${event.systemPrompt}\n\n` : "";
    return { systemPrompt: `${base}${header}${skillBody}` };
  });
}

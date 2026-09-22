/**
 * Aitrium Dev Workspace extension for pi.
 *
 * Registers the aitrium-dev-workspace and aitrium-local-secrets skills
 * from the local Codex plugin cache so they are discoverable in pi sessions.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SKILLS_ROOT =
  "/Users/josephrojo/dotfiles/.codex/plugins/cache/aitrium-dev-workspace-local/aitrium-dev-workspace/0.1.0+codex.20260603191627/skills";

export default function aitriumDevWorkspace(pi: ExtensionAPI) {
  pi.on("resources_discover", async (_event, _ctx) => {
    return {
      skillPaths: [SKILLS_ROOT],
    };
  });
}

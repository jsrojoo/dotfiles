from pathlib import Path
import os
import re
import unittest


AGENT_HARNESS_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIRECTORY = AGENT_HARNESS_ROOT / "src" / "skills" / "git"
SKILL_PATH = SKILL_DIRECTORY / "SKILL.md"


class GitSkillTest(unittest.TestCase):
    def test_has_portable_frontmatter(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")
        frontmatter_match = re.match(r"---\n(.*?)\n---\n", content, re.DOTALL)

        self.assertIsNotNone(frontmatter_match)
        frontmatter = frontmatter_match.group(1)
        self.assertIn("name: git", frontmatter)
        self.assertRegex(frontmatter, r"(?m)^description: .+[Gg]it.+")

    def test_bundles_executable_patch_helper(self) -> None:
        helper_path = SKILL_DIRECTORY / "group-patches.sh"

        self.assertTrue(helper_path.is_file())
        self.assertTrue(os.access(helper_path, os.X_OK))

    def test_contains_no_harness_specific_paths(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        for harness_path in (".claude/", ".codex/", ".pi/", "agent-skills/"):
            self.assertNotIn(harness_path, content)


if __name__ == "__main__":
    unittest.main()

from pathlib import Path
import re
import unittest


AGENT_HARNESS_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIRECTORY = AGENT_HARNESS_ROOT / "src" / "skills" / "coding"
SKILL_PATH = SKILL_DIRECTORY / "SKILL.md"


class CodingSkillTest(unittest.TestCase):
    def test_has_portable_frontmatter(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")
        frontmatter_match = re.match(r"---\n(.*?)\n---\n", content, re.DOTALL)

        self.assertIsNotNone(frontmatter_match)
        frontmatter = frontmatter_match.group(1)
        self.assertIn("name: coding", frontmatter)
        self.assertRegex(frontmatter, r"(?m)^description: .+coding.+")

    def test_uses_only_bundled_references(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")
        references = re.findall(r"`(references/[^`]+)`", content)

        self.assertEqual(
            references,
            [
                "references/database-sql-workflow.md",
                "references/responsive-frontend.md",
                "references/e2e-handoff.md",
            ],
        )
        for reference in references:
            self.assertTrue((SKILL_DIRECTORY / reference).is_file())

    def test_e2e_handoff_requires_plan_approval_before_artifacts(self) -> None:
        content = (SKILL_DIRECTORY / "references/e2e-handoff.md").read_text(encoding="utf-8")

        plan_index = content.index("## Test plan")
        approval_index = content.index("Wait for explicit user approval")
        artifacts_index = content.index("## Artifact generation")
        self.assertLess(plan_index, approval_index)
        self.assertLess(approval_index, artifacts_index)

    def test_contains_no_harness_specific_paths(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        for harness_path in (".claude/", ".codex/", ".pi/", "~/.agents/"):
            self.assertNotIn(harness_path, content)

    def test_requires_large_static_strings_in_text_files(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        self.assertIn("Extract large static strings", content)
        self.assertIn("LLM prompts and text templates", content)
        self.assertIn("`.md` or `.txt` files", content)

    def test_defines_tdd_cycle(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        red_index = content.index("### Red")
        green_index = content.index("### Green")
        refactor_index = content.index("### Refactor")
        self.assertLess(red_index, green_index)
        self.assertLess(green_index, refactor_index)

    def test_remains_focused(self) -> None:
        line_count = len(SKILL_PATH.read_text(encoding="utf-8").splitlines())

        self.assertLessEqual(line_count, 100)


if __name__ == "__main__":
    unittest.main()

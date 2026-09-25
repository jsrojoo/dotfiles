from pathlib import Path
import re
import unittest


AGENT_HARNESS_ROOT = Path(__file__).resolve().parents[2]
SKILL_PATH = AGENT_HARNESS_ROOT / "src" / "skills" / "plan" / "SKILL.md"


class PlanSkillTest(unittest.TestCase):
    def test_has_portable_frontmatter(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")
        frontmatter_match = re.match(r"---\n(.*?)\n---\n", content, re.DOTALL)

        self.assertIsNotNone(frontmatter_match)
        frontmatter = frontmatter_match.group(1)
        self.assertIn("name: plan", frontmatter)
        self.assertRegex(frontmatter, r"(?m)^description: .+[Pp]lan.+")

    def test_keeps_investigation_read_only_until_approval(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        investigation_index = content.index("## Investigate")
        plan_index = content.index("## Write plan")
        approval_index = content.index("## Approval")
        self.assertLess(investigation_index, plan_index)
        self.assertLess(plan_index, approval_index)
        self.assertIn("Do not edit files or run mutating commands", content)
        self.assertIn("Wait for explicit approval", content)

    def test_balances_execution_efficiency_scale_and_quality(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        for requirement in (
            "smallest complete approach",
            "parallel execution",
            "known scale",
            "security",
            "compatibility",
            "speculative abstractions",
        ):
            self.assertIn(requirement, content)

    def test_contains_no_harness_specific_paths(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        for harness_path in (".claude/", ".codex/", ".pi/", "~/.agents/"):
            self.assertNotIn(harness_path, content)

    def test_remains_focused(self) -> None:
        line_count = len(SKILL_PATH.read_text(encoding="utf-8").splitlines())

        self.assertLessEqual(line_count, 60)


if __name__ == "__main__":
    unittest.main()

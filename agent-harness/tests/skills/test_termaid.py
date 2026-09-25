from pathlib import Path
import re
import unittest


AGENT_HARNESS_ROOT = Path(__file__).resolve().parents[2]
TERMAID_SKILL = AGENT_HARNESS_ROOT / "src" / "skills" / "termaid" / "SKILL.md"
PLAN_SKILL = AGENT_HARNESS_ROOT / "src" / "skills" / "plan" / "SKILL.md"


class TermaidSkillTest(unittest.TestCase):
    def test_plan_visualization_contract(self) -> None:
        content = TERMAID_SKILL.read_text(encoding="utf-8")
        frontmatter = re.match(r"---\n(.*?)\n---\n", content, re.DOTALL)

        self.assertIsNotNone(frontmatter)
        self.assertIn("name: termaid", frontmatter.group(1))
        self.assertIn("uvx --offline termaid --ascii", content)
        for heading in ("Before", "After", "What changed"):
            self.assertIn(f"`{heading}`", content)
        self.assertIn("`termaid` skill", PLAN_SKILL.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()

from pathlib import Path
import os
import re
import subprocess
import tempfile
import unittest


AGENT_HARNESS_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIRECTORY = AGENT_HARNESS_ROOT / "src" / "skills" / "git"
SKILL_PATH = SKILL_DIRECTORY / "SKILL.md"
CLEANUP_HELPER_PATH = SKILL_DIRECTORY / "scripts" / "cleanup-worktrees.sh"


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

    def test_bundles_executable_worktree_cleanup_helper(self) -> None:
        self.assertTrue(CLEANUP_HELPER_PATH.is_file())
        self.assertTrue(os.access(CLEANUP_HELPER_PATH, os.X_OK))

    def test_worktree_cleanup_only_removes_clean_merged_worktrees(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory).resolve()
            repository = self._create_repository(root)
            merged = self._add_worktree(repository, root, "merged")
            dirty = self._add_worktree(repository, root, "dirty")
            unmerged = self._add_worktree(repository, root, "unmerged")
            detached = root / "detached"
            self._run(repository, "worktree", "add", "--detach", str(detached), "HEAD")

            (dirty / "tracked.txt").write_text("dirty\n", encoding="utf-8")
            (unmerged / "unmerged.txt").write_text("unmerged\n", encoding="utf-8")
            self._run(unmerged, "add", "unmerged.txt")
            self._run(unmerged, "commit", "-m", "unmerged change")

            preview = self._run_script(repository, "--base", "mac")

            self.assertIn(f"ELIGIBLE {merged} [merged]", preview.stdout)
            self.assertIn(f"SKIP {dirty}: dirty worktree", preview.stdout)
            self.assertIn(f"SKIP {unmerged}: branch is not merged into mac", preview.stdout)
            self.assertIn(f"SKIP {detached}: detached HEAD", preview.stdout)
            self.assertIn("Preview only.", preview.stdout)
            for path in (merged, dirty, unmerged, detached):
                self.assertTrue(path.exists())

            removed = self._run_script(repository, "--base", "mac", "--remove")

            self.assertIn(f"REMOVED {merged} [merged]", removed.stdout)
            self.assertFalse(merged.exists())
            for path in (dirty, unmerged, detached):
                self.assertTrue(path.exists())
            self.assertEqual("merged", self._run(repository, "branch", "--list", "merged").stdout.strip())

    def test_worktree_cleanup_protects_invoking_worktree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory).resolve()
            repository = self._create_repository(root)
            current = self._add_worktree(repository, root, "current")

            result = self._run_script(current, "--base", "mac", "--remove")

            self.assertIn(f"SKIP {repository}: primary worktree", result.stdout)
            self.assertIn(f"SKIP {current}: current worktree", result.stdout)
            self.assertTrue(current.exists())

    @staticmethod
    def _run(cwd: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *arguments],
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
        )

    def _create_repository(self, root: Path) -> Path:
        repository = root / "repository"
        repository.mkdir()
        self._run(repository, "init", "-b", "mac")
        self._run(repository, "config", "user.name", "Test User")
        self._run(repository, "config", "user.email", "test@example.com")
        (repository / "tracked.txt").write_text("clean\n", encoding="utf-8")
        self._run(repository, "add", "tracked.txt")
        self._run(repository, "commit", "-m", "initial")
        return repository

    def _add_worktree(self, repository: Path, root: Path, branch: str) -> Path:
        path = root / branch
        self._run(repository, "branch", branch)
        self._run(repository, "worktree", "add", str(path), branch)
        return path

    @staticmethod
    def _run_script(cwd: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(CLEANUP_HELPER_PATH), *arguments],
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
        )

    def test_contains_no_harness_specific_paths(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        for harness_path in (".claude/", ".codex/", ".pi/", "agent-skills/"):
            self.assertNotIn(harness_path, content)

    def test_assigns_merge_request_creator_as_assignee_and_reviewer(self) -> None:
        content = SKILL_PATH.read_text(encoding="utf-8")

        self.assertIn('--assignee "$username"', content)
        self.assertIn('--reviewer "$username"', content)

    def test_links_complete_worktree_guidance(self) -> None:
        reference_path = SKILL_DIRECTORY / "references" / "worktrees.md"
        self.assertTrue(reference_path.is_file())

        skill_content = SKILL_PATH.read_text(encoding="utf-8")
        link_match = re.search(r"\[Worktree guidance\]\(([^)]+)\)", skill_content)
        self.assertIsNotNone(link_match)
        if link_match is None:
            self.fail("Git SKILL.md must link to its worktree guidance")
        linked_path = (SKILL_PATH.parent / link_match.group(1)).resolve()
        self.assertEqual(reference_path.resolve(), linked_path)

        guidance = reference_path.read_text(encoding="utf-8")
        self.assertIn("<project-root>/.agents/tasks/<task>/worktree/", guidance)
        self.assertIn(".agents/tasks/<task>/plan.md", guidance)
        self.assertIn(".agents/tasks/<task>/tasks.md", guidance)
        self.assertIn("plan-mode-tasks", guidance)
        self.assertIn("cleanup-worktrees.sh --base", guidance)
        self.assertIn("--remove", guidance)
        self.assertRegex(
            guidance,
            r"(?is)\bskip\w*\b[^.]*\bprimary\b[^.]*\b(?:current|invoking)\b[^.]*\bworktrees?\b",
        )
        self.assertRegex(guidance, r"(?is)\bpreview\b[^.]*\b(?:first|before|review)\b")
        self.assertRegex(
            guidance,
            r"(?is)\b(?:explicit\s+)?approval\b[^.]*\b(?:remove|removal|rerun|write)\w*\b",
        )


if __name__ == "__main__":
    unittest.main()

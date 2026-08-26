from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parent / "agent-taskctl.py"


PLAN_VALID = """# Goal

Ship task lifecycle.

# Scope

CLI commands.

# Non-goals

No git writes.

# Constraints

Stdlib only.

# Plain-English Pseudocode

```text
Retrieve CLI inputs from process boundaries.
Prepare markdown files into primitive task lines.
Validate slug, paths, and task numbers.
Compute task command result from valid inputs.
Build output text from command result.
```

# Plan

Do work.

# Risks

Parser too broad.

# Tests

Focused unittest.
"""

TASKS_VALID = """- [ ] Add CLI commands
  - Pseudo:
    ```text
    Retrieve CLI arguments from argv.
    Prepare task paths from validated slug.
    Validate command input before writes.
    Build command output from file state.
    ```
  - Verify: commands return stable output.
- [ ] Preserve markdown
  - Verify: nested markdown stays unchanged after checkbox toggle.
"""

TASKS_STATUS_MIXED = """- [x] Retrieve context
  - Verify: context captured.
- [ ] Patch CLI
  - Verify: parser accepts all flag.
- [ ] Run checks
  - Verify: validation passes.
"""

TASKS_STATUS_ALL_CHECKED = """- [x] Retrieve context
  - Verify: context captured.
- [x] Patch CLI
  - Verify: parser accepts all flag.
"""

TASKS_STATUS_NONE_CHECKED = """- [ ] Retrieve context
  - Verify: context captured.
- [ ] Patch CLI
  - Verify: parser accepts status filters.
"""

TASKS_STATUS_WITH_NESTED_CHECKBOXES = """- [x] Parent done
  - [ ] Nested todo ignored.
  - Verify: nested unchecked line stays nested.
- [ ] Parent todo
  - [x] Nested done ignored.
  - Verify: nested checked line stays nested.
"""


class AgentTaskctlTests(unittest.TestCase):
    def run_agent_taskctl(self, root_path: Path, *args: str, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
        command = [
            sys.executable,
            str(SCRIPT_PATH),
            "--root",
            str(root_path),
            *args,
        ]
        return subprocess.run(
            command,
            input=stdin,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_init_creates_templates_without_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)

            first_result = self.run_agent_taskctl(root_path, "init", "demo-task")
            self.assertEqual(first_result.returncode, 0, first_result.stderr)
            self.assertIn("created plan.md, tasks.md", first_result.stdout)

            plan_path = root_path / ".agents" / "tasks" / "demo-task" / "plan.md"
            plan_path.write_text("custom\n", encoding="utf-8")

            second_result = self.run_agent_taskctl(root_path, "init", "demo-task")
            self.assertEqual(second_result.returncode, 0, second_result.stderr)
            self.assertEqual(plan_path.read_text(encoding="utf-8"), "custom\n")

    def test_write_commands_require_non_empty_stdin_and_validate(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)

            empty_result = self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin="  \n")
            self.assertEqual(empty_result.returncode, 2)
            self.assertIn("stdin must not be empty", empty_result.stderr)

            plan_result = self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin=PLAN_VALID)
            tasks_result = self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=TASKS_VALID)
            validate_result = self.run_agent_taskctl(root_path, "validate", "demo-task")

            self.assertEqual(plan_result.returncode, 0, plan_result.stderr)
            self.assertEqual(tasks_result.returncode, 0, tasks_result.stderr)
            self.assertEqual(validate_result.returncode, 0, validate_result.stderr)
            self.assertEqual(validate_result.stdout.strip(), "valid demo-task")

    def test_check_uncheck_only_toggles_top_level_task_line(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin=PLAN_VALID)
            self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=TASKS_VALID)

            check_result = self.run_agent_taskctl(root_path, "check", "demo-task", "2")
            self.assertEqual(check_result.returncode, 0, check_result.stderr)

            tasks_path = root_path / ".agents" / "tasks" / "demo-task" / "tasks.md"
            checked_text = tasks_path.read_text(encoding="utf-8")
            self.assertIn("- [ ] Add CLI commands", checked_text)
            self.assertIn("- [x] Preserve markdown", checked_text)
            self.assertIn("  - Verify: nested markdown stays unchanged after checkbox toggle.", checked_text)

            uncheck_result = self.run_agent_taskctl(root_path, "uncheck", "demo-task", "2")
            self.assertEqual(uncheck_result.returncode, 0, uncheck_result.stderr)
            self.assertIn("- [ ] Preserve markdown", tasks_path.read_text(encoding="utf-8"))

    def test_check_preserves_missing_final_newline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            tasks_without_final_newline = TASKS_VALID.rstrip("\n")
            self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin=PLAN_VALID)
            self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=tasks_without_final_newline)

            check_result = self.run_agent_taskctl(root_path, "check", "demo-task", "1")
            self.assertEqual(check_result.returncode, 0, check_result.stderr)

            tasks_path = root_path / ".agents" / "tasks" / "demo-task" / "tasks.md"
            checked_text = tasks_path.read_text(encoding="utf-8")
            self.assertFalse(checked_text.endswith("\n"))
            self.assertIn("- [x] Add CLI commands", checked_text)

    def test_status_next_list_and_archive_are_stable(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "init", "demo-task")
            self.run_agent_taskctl(root_path, "init", "another-task")

            list_result = self.run_agent_taskctl(root_path, "list")
            self.assertEqual(list_result.returncode, 0, list_result.stderr)
            self.assertEqual(list_result.stdout, "another-task\ndemo-task\n")

            status_result = self.run_agent_taskctl(root_path, "status", "demo-task")
            next_result = self.run_agent_taskctl(root_path, "next", "demo-task")
            archive_result = self.run_agent_taskctl(root_path, "archive", "demo-task")

            self.assertEqual(status_result.returncode, 0, status_result.stderr)
            self.assertEqual(
                status_result.stdout,
                "demo-task: 0/1 checked\nnext: 1. Replace with approved first task\n",
            )
            self.assertEqual(next_result.stdout.strip(), "1. Replace with approved first task")
            self.assertEqual(archive_result.stdout.strip(), "archived demo-task")

            archived_path = root_path / ".agents" / "tasks" / ".archive" / "demo-task"
            self.assertTrue(archived_path.exists())

    def test_list_done_aliases_show_only_active_completed_tasks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "active-done", stdin=TASKS_STATUS_ALL_CHECKED)
            self.run_agent_taskctl(root_path, "write-tasks", "active-open", stdin=TASKS_STATUS_MIXED)
            self.run_agent_taskctl(root_path, "write-tasks", "archived-done", stdin=TASKS_STATUS_ALL_CHECKED)
            self.run_agent_taskctl(root_path, "archive", "archived-done")

            done_result = self.run_agent_taskctl(root_path, "list", "--done")
            complete_result = self.run_agent_taskctl(root_path, "list", "--complete")
            completed_result = self.run_agent_taskctl(root_path, "list", "--completed")

            self.assertEqual(done_result.returncode, 0, done_result.stderr)
            self.assertEqual(complete_result.returncode, 0, complete_result.stderr)
            self.assertEqual(completed_result.returncode, 0, completed_result.stderr)
            self.assertEqual(done_result.stdout, "active-done\n")
            self.assertEqual(complete_result.stdout, done_result.stdout)
            self.assertEqual(completed_result.stdout, done_result.stdout)

    def test_list_open_aliases_show_tasks_with_unchecked_top_level_items(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "done-task", stdin=TASKS_STATUS_ALL_CHECKED)
            self.run_agent_taskctl(root_path, "write-tasks", "mixed-task", stdin=TASKS_STATUS_MIXED)
            self.run_agent_taskctl(root_path, "write-tasks", "nested-task", stdin=TASKS_STATUS_WITH_NESTED_CHECKBOXES)
            self.run_agent_taskctl(root_path, "write-tasks", "todo-task", stdin=TASKS_STATUS_NONE_CHECKED)

            open_result = self.run_agent_taskctl(root_path, "list", "--open")
            doing_result = self.run_agent_taskctl(root_path, "list", "--doing")

            self.assertEqual(open_result.returncode, 0, open_result.stderr)
            self.assertEqual(doing_result.returncode, 0, doing_result.stderr)
            self.assertEqual(open_result.stdout, "mixed-task\nnested-task\ntodo-task\n")
            self.assertEqual(doing_result.stdout, open_result.stdout)

    def test_list_state_filters_return_no_tasks_for_empty_matching_subset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "done-task", stdin=TASKS_STATUS_ALL_CHECKED)

            result = self.run_agent_taskctl(root_path, "list", "--open")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), "no tasks")

    def test_list_state_filters_report_invalid_task_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            tasks_root = root_path / ".agents" / "tasks"
            (tasks_root / "invalid-task").mkdir(parents=True)
            (tasks_root / "invalid-task" / "tasks.md").write_text("no checkbox tasks\n", encoding="utf-8")
            (tasks_root / "missing-task").mkdir(parents=True)
            self.run_agent_taskctl(root_path, "write-tasks", "valid-task", stdin=TASKS_STATUS_MIXED)

            result = self.run_agent_taskctl(root_path, "list", "--open")

            self.assertEqual(result.returncode, 2)
            self.assertIn("invalid-task: tasks.md has no top-level checkbox tasks", result.stderr)
            self.assertIn("missing-task: missing tasks.md", result.stderr)

    def test_list_state_filter_flags_are_mutually_exclusive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "done-task", stdin=TASKS_STATUS_ALL_CHECKED)

            alias_result = self.run_agent_taskctl(root_path, "list", "--done", "--complete")
            archived_result = self.run_agent_taskctl(root_path, "list", "--archived", "--open")

            self.assertEqual(alias_result.returncode, 2)
            self.assertEqual(archived_result.returncode, 2)
            self.assertIn("not allowed with argument", alias_result.stderr)
            self.assertIn("not allowed with argument", archived_result.stderr)

    def test_status_all_lists_mixed_tasks_with_option_after_slug(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "mixed-task", stdin=TASKS_STATUS_MIXED)

            result = self.run_agent_taskctl(root_path, "status", "mixed-task", "--all")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                result.stdout,
                "mixed-task: 1/3 checked\n"
                "tasks:\n"
                "1. [x] Retrieve context\n"
                "2. [ ] Patch CLI\n"
                "3. [ ] Run checks\n",
            )

    def test_status_all_lists_checked_tasks_with_option_before_slug(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "done-task", stdin=TASKS_STATUS_ALL_CHECKED)

            result = self.run_agent_taskctl(root_path, "status", "--all", "done-task")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                result.stdout,
                "done-task: 2/2 checked\n"
                "tasks:\n"
                "1. [x] Retrieve context\n"
                "2. [x] Patch CLI\n",
            )

    def test_status_default_and_next_are_exact_equivalent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "mixed-task", stdin=TASKS_STATUS_MIXED)

            default_result = self.run_agent_taskctl(root_path, "status", "mixed-task")
            next_result = self.run_agent_taskctl(root_path, "status", "mixed-task", "--next")

            self.assertEqual(default_result.returncode, 0, default_result.stderr)
            self.assertEqual(next_result.returncode, 0, next_result.stderr)
            self.assertEqual(default_result.stdout, next_result.stdout)
            self.assertEqual(
                default_result.stdout,
                "mixed-task: 1/3 checked\n"
                "next: 2. Patch CLI\n",
            )

    def test_status_todo_and_done_keep_original_numbering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "mixed-task", stdin=TASKS_STATUS_MIXED)

            todo_result = self.run_agent_taskctl(root_path, "status", "--todo", "mixed-task")
            done_result = self.run_agent_taskctl(root_path, "status", "mixed-task", "--done")

            self.assertEqual(todo_result.returncode, 0, todo_result.stderr)
            self.assertEqual(done_result.returncode, 0, done_result.stderr)
            self.assertEqual(
                todo_result.stdout,
                "mixed-task: 1/3 checked\n"
                "todo:\n"
                "2. [ ] Patch CLI\n"
                "3. [ ] Run checks\n",
            )
            self.assertEqual(
                done_result.stdout,
                "mixed-task: 1/3 checked\n"
                "done:\n"
                "1. [x] Retrieve context\n",
            )

    def test_status_todo_and_done_show_none_for_empty_subset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "done-task", stdin=TASKS_STATUS_ALL_CHECKED)
            self.run_agent_taskctl(root_path, "write-tasks", "todo-task", stdin=TASKS_STATUS_NONE_CHECKED)

            todo_result = self.run_agent_taskctl(root_path, "status", "done-task", "--todo")
            done_result = self.run_agent_taskctl(root_path, "status", "todo-task", "--done")

            self.assertEqual(todo_result.returncode, 0, todo_result.stderr)
            self.assertEqual(done_result.returncode, 0, done_result.stderr)
            self.assertEqual(
                todo_result.stdout,
                "done-task: 2/2 checked\n"
                "todo:\n"
                "none\n",
            )
            self.assertEqual(
                done_result.stdout,
                "todo-task: 0/2 checked\n"
                "done:\n"
                "none\n",
            )

    def test_status_filters_ignore_nested_checkboxes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(
                root_path,
                "write-tasks",
                "nested-task",
                stdin=TASKS_STATUS_WITH_NESTED_CHECKBOXES,
            )

            todo_result = self.run_agent_taskctl(root_path, "status", "nested-task", "--todo")
            done_result = self.run_agent_taskctl(root_path, "status", "nested-task", "--done")
            all_result = self.run_agent_taskctl(root_path, "status", "nested-task", "--all")

            self.assertEqual(todo_result.returncode, 0, todo_result.stderr)
            self.assertEqual(done_result.returncode, 0, done_result.stderr)
            self.assertEqual(all_result.returncode, 0, all_result.stderr)
            self.assertEqual(
                todo_result.stdout,
                "nested-task: 1/2 checked\n"
                "todo:\n"
                "2. [ ] Parent todo\n",
            )
            self.assertEqual(
                done_result.stdout,
                "nested-task: 1/2 checked\n"
                "done:\n"
                "1. [x] Parent done\n",
            )
            self.assertEqual(
                all_result.stdout,
                "nested-task: 1/2 checked\n"
                "tasks:\n"
                "1. [x] Parent done\n"
                "2. [ ] Parent todo\n",
            )

    def test_status_filters_are_mutually_exclusive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-tasks", "mixed-task", stdin=TASKS_STATUS_MIXED)

            result = self.run_agent_taskctl(root_path, "status", "--todo", "mixed-task", "--done")

            self.assertEqual(result.returncode, 2)
            self.assertIn("not allowed with argument", result.stderr)

    def test_archived_list_empty_and_filters_invalid_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)

            empty_result = self.run_agent_taskctl(root_path, "list", "--archived")
            self.assertEqual(empty_result.returncode, 0, empty_result.stderr)
            self.assertEqual(empty_result.stdout.strip(), "no archived tasks")

            archive_root = root_path / ".agents" / "tasks" / ".archive"
            archive_root.mkdir(parents=True)
            (archive_root / "valid-task").mkdir()
            (archive_root / "Invalid").mkdir()
            (archive_root / "not-a-dir").write_text("ignored\n", encoding="utf-8")

            list_result = self.run_agent_taskctl(root_path, "list", "--archived")

            self.assertEqual(list_result.returncode, 0, list_result.stderr)
            self.assertEqual(list_result.stdout, "valid-task\n")

    def test_restore_moves_archived_task_back_without_content_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin=PLAN_VALID)
            self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=TASKS_VALID)
            tasks_path = root_path / ".agents" / "tasks" / "demo-task" / "tasks.md"
            task_text_before = tasks_path.read_text(encoding="utf-8")

            archive_result = self.run_agent_taskctl(root_path, "archive", "demo-task")
            restore_result = self.run_agent_taskctl(root_path, "restore", "demo-task")

            self.assertEqual(archive_result.returncode, 0, archive_result.stderr)
            self.assertEqual(restore_result.returncode, 0, restore_result.stderr)
            self.assertEqual(restore_result.stdout.strip(), "restored demo-task")
            self.assertEqual(tasks_path.read_text(encoding="utf-8"), task_text_before)
            self.assertFalse((root_path / ".agents" / "tasks" / ".archive" / "demo-task").exists())

    def test_restore_missing_archive_returns_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)

            result = self.run_agent_taskctl(root_path, "restore", "demo-task")

            self.assertEqual(result.returncode, 2)
            self.assertIn("archived task not found: demo-task", result.stderr)

    def test_restore_refuses_active_collision(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            archive_task_path = root_path / ".agents" / "tasks" / ".archive" / "demo-task"
            archive_task_path.mkdir(parents=True)
            (archive_task_path / "tasks.md").write_text(TASKS_VALID, encoding="utf-8")
            self.run_agent_taskctl(root_path, "init", "demo-task")

            result = self.run_agent_taskctl(root_path, "restore", "demo-task")

            self.assertEqual(result.returncode, 2)
            self.assertIn("active task already exists: demo-task", result.stderr)
            self.assertTrue(archive_task_path.exists())

    def test_restore_updates_active_and_archived_visibility(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            self.run_agent_taskctl(root_path, "init", "demo-task")
            self.run_agent_taskctl(root_path, "archive", "demo-task")

            archived_before = self.run_agent_taskctl(root_path, "list", "--archived")
            active_before = self.run_agent_taskctl(root_path, "list")
            restore_result = self.run_agent_taskctl(root_path, "restore", "demo-task")
            archived_after = self.run_agent_taskctl(root_path, "list", "--archived")
            active_after = self.run_agent_taskctl(root_path, "list")

            self.assertEqual(archived_before.stdout, "demo-task\n")
            self.assertEqual(active_before.stdout.strip(), "no tasks")
            self.assertEqual(restore_result.returncode, 0, restore_result.stderr)
            self.assertEqual(archived_after.stdout.strip(), "no archived tasks")
            self.assertEqual(active_after.stdout, "demo-task\n")

    def test_invalid_slug_and_task_number_return_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)

            slug_result = self.run_agent_taskctl(root_path, "init", "../bad")
            self.assertEqual(slug_result.returncode, 2)
            self.assertIn("slug must use lowercase", slug_result.stderr)

            self.run_agent_taskctl(root_path, "write-plan", "demo-task", stdin=PLAN_VALID)
            self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=TASKS_VALID)
            number_result = self.run_agent_taskctl(root_path, "check", "demo-task", "3")
            self.assertEqual(number_result.returncode, 2)
            self.assertIn("task number out of range: 3", number_result.stderr)

    def test_filesystem_error_returns_concise_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            task_file_path = root_path / ".agents" / "tasks" / "demo-task"
            task_file_path.parent.mkdir(parents=True)
            task_file_path.write_text("not a directory\n", encoding="utf-8")

            result = self.run_agent_taskctl(root_path, "init", "demo-task")

            self.assertEqual(result.returncode, 1)
            self.assertIn("error: filesystem:", result.stderr)
            self.assertNotIn("Traceback", result.stderr)

    def test_validate_reports_missing_plan_and_task_requirements(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root_path = Path(temp_dir)
            bad_tasks = "- [ ] Missing verify\n"

            self.run_agent_taskctl(root_path, "write-tasks", "demo-task", stdin=bad_tasks)
            result = self.run_agent_taskctl(root_path, "validate", "demo-task")

            self.assertEqual(result.returncode, 2)
            self.assertIn("missing plan.md", result.stderr)
            self.assertIn("task 1 missing nested Verify", result.stderr)


if __name__ == "__main__":
    unittest.main()

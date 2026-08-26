#!/usr/bin/env python3
"""Manage Plan Mode task artifacts with stdlib-only commands."""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TASK_LINE_PATTERN = re.compile(r"^- \[( |x)\] (.+)$")

PLAN_FILE_NAME = "plan.md"
TASKS_FILE_NAME = "tasks.md"
TASKS_DIR_PARTS = (".agents", "tasks")
ARCHIVE_DIR_NAME = ".archive"

LIST_FILTER_ACTIVE = "active"
LIST_FILTER_ARCHIVED = "archived"
LIST_FILTER_DONE = "done"
LIST_FILTER_OPEN = "open"

STATUS_FILTER_ALL = "all"
STATUS_FILTER_DONE = "done"
STATUS_FILTER_NEXT = "next"
STATUS_FILTER_TODO = "todo"

PLAN_HEADINGS_REQUIRED = (
    "# Goal",
    "# Scope",
    "# Non-goals",
    "# Constraints",
    "# Plain-English Pseudocode",
    "# Plan",
    "# Risks",
    "# Tests",
)

PLAN_TEMPLATE = """# Goal

TBD

# Scope

TBD

# Non-goals

TBD

# Constraints

TBD

# Plain-English Pseudocode

```text
Retrieve approved plan details from the parent agent.
Prepare plan details into task artifact content.
Validate task artifact content against plan-mode requirements.
Build plan and task files from validated content.
Return artifact paths for parent review.
```

# Plan

TBD

# Risks

TBD

# Tests

TBD
"""

TASKS_TEMPLATE = """- [ ] Replace with approved first task
  - Pseudo:
    ```text
    Retrieve approved task details from the current plan.
    Prepare task details into concrete task text.
    Validate task text includes proof-ready acceptance checks.
    Build updated task artifact content.
    ```
  - Verify: task line is replaced with approved plan work before implementation.
"""


@dataclass(frozen=True)
class TaskEntry:
    index: int
    checked: bool
    line_number: int
    text: str


@dataclass(frozen=True)
class TaskSet:
    entries: tuple[TaskEntry, ...]
    lines: tuple[str, ...]


class TaskctlError(Exception):
    """Expected command failure with user-facing message."""


def main(argv: list[str] | None = None) -> int:
    parser = _arg_parser_build()
    args = parser.parse_args(argv)

    try:
        output = _command_run(args)
    except TaskctlError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"error: filesystem: {error}", file=sys.stderr)
        return 1

    if output:
        print(output)
    return 0


def _arg_parser_build() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-taskctl",
        description="Manage .agents/tasks/<slug> plan-mode artifacts.",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="workspace root containing .agents/tasks; default: current directory",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    for command_name in ("init", "write-plan", "write-tasks", "next", "validate", "archive", "restore"):
        subparser = subparsers.add_parser(command_name)
        subparser.add_argument("slug")

    status_parser = subparsers.add_parser("status")
    status_filter_group = status_parser.add_mutually_exclusive_group()
    status_filter_group.add_argument(
        "--all",
        action="store_const",
        const=STATUS_FILTER_ALL,
        dest="status_filter",
        help="show every top-level task instead of only the next unchecked task",
    )
    status_filter_group.add_argument(
        "--next",
        action="store_const",
        const=STATUS_FILTER_NEXT,
        dest="status_filter",
        help="show checked count and next unchecked task",
    )
    status_filter_group.add_argument(
        "--todo",
        action="store_const",
        const=STATUS_FILTER_TODO,
        dest="status_filter",
        help="show unchecked top-level tasks",
    )
    status_filter_group.add_argument(
        "--done",
        action="store_const",
        const=STATUS_FILTER_DONE,
        dest="status_filter",
        help="show checked top-level tasks",
    )
    status_parser.add_argument("slug")
    status_parser.set_defaults(status_filter=STATUS_FILTER_NEXT)

    list_parser = subparsers.add_parser("list")
    list_filter_group = list_parser.add_mutually_exclusive_group()
    list_filter_group.add_argument(
        "--archived",
        action="store_const",
        const=LIST_FILTER_ARCHIVED,
        dest="list_filter",
        help="list archived tasks instead of active tasks",
    )
    for done_alias in ("--done", "--complete", "--completed"):
        list_filter_group.add_argument(
            done_alias,
            action="store_const",
            const=LIST_FILTER_DONE,
            dest="list_filter",
            help="list active tasks with all top-level checkboxes checked",
        )
    for open_alias in ("--open", "--doing"):
        list_filter_group.add_argument(
            open_alias,
            action="store_const",
            const=LIST_FILTER_OPEN,
            dest="list_filter",
            help="list active tasks with at least one unchecked top-level checkbox",
        )
    list_parser.set_defaults(list_filter=LIST_FILTER_ACTIVE)

    for command_name in ("check", "uncheck"):
        subparser = subparsers.add_parser(command_name)
        subparser.add_argument("slug")
        subparser.add_argument("task_number")

    return parser


def _command_run(args: argparse.Namespace) -> str:
    root_path = _root_path_prepare(args.root)

    if args.command == "list":
        if args.list_filter == LIST_FILTER_ARCHIVED:
            return _tasks_archived_list(root_path)
        return _tasks_list(root_path, args.list_filter)

    slug = _slug_validate(args.slug)
    task_path = _task_path_build(root_path, slug)

    if args.command == "init":
        return _task_init(task_path, slug)
    if args.command == "write-plan":
        return _artifact_write_stdin(task_path, PLAN_FILE_NAME, slug)
    if args.command == "write-tasks":
        return _artifact_write_stdin(task_path, TASKS_FILE_NAME, slug)
    if args.command == "status":
        return _task_status(task_path, slug, args.status_filter)
    if args.command == "next":
        return _task_next(task_path)
    if args.command == "check":
        return _task_checkbox_set(task_path, slug, args.task_number, True)
    if args.command == "uncheck":
        return _task_checkbox_set(task_path, slug, args.task_number, False)
    if args.command == "validate":
        return _task_validate(task_path, slug)
    if args.command == "archive":
        return _task_archive(root_path, task_path, slug)
    if args.command == "restore":
        return _task_restore(root_path, task_path, slug)

    raise TaskctlError(f"unknown command: {args.command}")


def _root_path_prepare(root_value: str) -> Path:
    if not root_value:
        raise TaskctlError("--root must not be empty")
    return Path(root_value).expanduser().resolve()


def _slug_validate(slug: str) -> str:
    if not SLUG_PATTERN.fullmatch(slug):
        raise TaskctlError(
            "slug must use lowercase letters, numbers, and single hyphens; "
            "no slashes, dots, leading hyphens, or trailing hyphens"
        )
    return slug


def _task_path_build(root_path: Path, slug: str) -> Path:
    task_path = root_path.joinpath(*TASKS_DIR_PARTS, slug).resolve()
    tasks_root = root_path.joinpath(*TASKS_DIR_PARTS).resolve()
    if not _path_is_relative_to(task_path, tasks_root):
        raise TaskctlError("task path escapes .agents/tasks")
    return task_path


def _path_is_relative_to(child_path: Path, parent_path: Path) -> bool:
    try:
        child_path.relative_to(parent_path)
    except ValueError:
        return False
    return True


def _task_init(task_path: Path, slug: str) -> str:
    task_path.mkdir(parents=True, exist_ok=True)
    created_names: list[str] = []

    plan_path = task_path / PLAN_FILE_NAME
    if not plan_path.exists():
        _file_text_write_atomic(plan_path, PLAN_TEMPLATE)
        created_names.append(PLAN_FILE_NAME)

    tasks_path = task_path / TASKS_FILE_NAME
    if not tasks_path.exists():
        _file_text_write_atomic(tasks_path, TASKS_TEMPLATE)
        created_names.append(TASKS_FILE_NAME)

    if not created_names:
        return f"initialized {slug}: unchanged"
    return f"initialized {slug}: created {', '.join(created_names)}"


def _artifact_write_stdin(task_path: Path, file_name: str, slug: str) -> str:
    content = sys.stdin.read()
    if not content.strip():
        raise TaskctlError("stdin must not be empty")

    task_path.mkdir(parents=True, exist_ok=True)
    _file_text_write_atomic(task_path / file_name, content)
    return f"wrote {slug}/{file_name}"


def _tasks_list(root_path: Path, list_filter: str = LIST_FILTER_ACTIVE) -> str:
    tasks_root = root_path.joinpath(*TASKS_DIR_PARTS)
    if not tasks_root.exists():
        return "no tasks"

    slugs = _task_slugs_active_prepare(tasks_root)
    if list_filter == LIST_FILTER_ACTIVE:
        return _task_slugs_output_build(slugs, "no tasks")
    if list_filter in (LIST_FILTER_DONE, LIST_FILTER_OPEN):
        return _tasks_filtered_list(root_path, slugs, list_filter)

    raise TaskctlError(f"unknown list filter: {list_filter}")


def _task_slugs_active_prepare(tasks_root: Path) -> tuple[str, ...]:
    return tuple(
        sorted(
            path.name
            for path in tasks_root.iterdir()
            if path.is_dir() and path.name != ARCHIVE_DIR_NAME and SLUG_PATTERN.fullmatch(path.name)
        )
    )


def _task_slugs_output_build(slugs: tuple[str, ...], empty_message: str) -> str:
    if not slugs:
        return empty_message
    return "\n".join(slugs)


def _tasks_filtered_list(root_path: Path, slugs: tuple[str, ...], list_filter: str) -> str:
    errors: list[str] = []
    matched_slugs: list[str] = []

    for slug in slugs:
        task_path = _task_path_build(root_path, slug)
        try:
            task_set = _task_set_retrieve(task_path)
        except TaskctlError as error:
            errors.append(f"{slug}: {error}")
            continue

        if _task_entries_match_filter(task_set.entries, list_filter):
            matched_slugs.append(slug)

    if errors:
        raise TaskctlError("list filter failed\n" + "\n".join(f"- {error}" for error in errors))

    return _task_slugs_output_build(tuple(matched_slugs), "no tasks")


def _task_entries_match_filter(entries: tuple[TaskEntry, ...], list_filter: str) -> bool:
    if list_filter == LIST_FILTER_DONE:
        return all(entry.checked for entry in entries)
    if list_filter == LIST_FILTER_OPEN:
        return any(not entry.checked for entry in entries)
    raise TaskctlError(f"unknown list filter: {list_filter}")


def _tasks_archived_list(root_path: Path) -> str:
    archive_root = root_path.joinpath(*TASKS_DIR_PARTS, ARCHIVE_DIR_NAME)
    if not archive_root.exists():
        return "no archived tasks"

    slugs = tuple(
        sorted(
            path.name
            for path in archive_root.iterdir()
            if path.is_dir() and SLUG_PATTERN.fullmatch(path.name)
        )
    )
    return _task_slugs_output_build(slugs, "no archived tasks")


def _task_status(task_path: Path, slug: str, status_filter: str = STATUS_FILTER_NEXT) -> str:
    task_set = _task_set_retrieve(task_path)
    return _task_status_output_build(slug, task_set.entries, status_filter)


def _task_status_output_build(slug: str, entries: tuple[TaskEntry, ...], status_filter: str) -> str:
    checked_count = sum(1 for entry in entries if entry.checked)
    total_count = len(entries)
    summary_line = f"{slug}: {checked_count}/{total_count} checked"

    if status_filter == STATUS_FILTER_ALL:
        return _task_status_section_output_build(summary_line, "tasks", entries)
    if status_filter == STATUS_FILTER_TODO:
        todo_entries = tuple(entry for entry in entries if not entry.checked)
        return _task_status_section_output_build(summary_line, "todo", todo_entries)
    if status_filter == STATUS_FILTER_DONE:
        done_entries = tuple(entry for entry in entries if entry.checked)
        return _task_status_section_output_build(summary_line, "done", done_entries)
    if status_filter != STATUS_FILTER_NEXT:
        raise TaskctlError(f"unknown status filter: {status_filter}")

    next_entry = _task_entry_next(entries)
    next_text = "none" if next_entry is None else f"{next_entry.index}. {next_entry.text}"
    return f"{summary_line}\nnext: {next_text}"


def _task_status_section_output_build(
    summary_line: str,
    section_name: str,
    entries: tuple[TaskEntry, ...],
) -> str:
    if not entries:
        return f"{summary_line}\n{section_name}:\nnone"
    task_lines = "\n".join(_task_status_line_build(entry) for entry in entries)
    return f"{summary_line}\n{section_name}:\n{task_lines}"


def _task_status_line_build(entry: TaskEntry) -> str:
    marker = "x" if entry.checked else " "
    return f"{entry.index}. [{marker}] {entry.text}"


def _task_next(task_path: Path) -> str:
    task_set = _task_set_retrieve(task_path)
    next_entry = _task_entry_next(task_set.entries)
    if next_entry is None:
        return "no unchecked tasks"
    return f"{next_entry.index}. {next_entry.text}"


def _task_checkbox_set(task_path: Path, slug: str, task_number_value: str, checked: bool) -> str:
    task_number = _task_number_validate(task_number_value)
    task_set = _task_set_retrieve(task_path)
    target_entry = _task_entry_get(task_set.entries, task_number)
    marker = "x" if checked else " "
    lines = list(task_set.lines)
    line_content, line_ending = _line_content_and_ending_prepare(lines[target_entry.line_number - 1])
    lines[target_entry.line_number - 1] = TASK_LINE_PATTERN.sub(
        f"- [{marker}] " + r"\2",
        line_content,
        count=1,
    ) + line_ending
    _file_text_write_atomic(task_path / TASKS_FILE_NAME, "".join(lines))
    action_name = "checked" if checked else "unchecked"
    return f"{action_name} {slug}: {task_number}. {target_entry.text}"


def _task_validate(task_path: Path, slug: str) -> str:
    errors = _task_validation_errors_build(task_path)
    if errors:
        raise TaskctlError("validation failed\n" + "\n".join(f"- {error}" for error in errors))
    return f"valid {slug}"


def _task_archive(root_path: Path, task_path: Path, slug: str) -> str:
    if not task_path.exists():
        raise TaskctlError(f"task not found: {slug}")

    archive_root, archive_path = _task_archive_path_build(root_path, slug)
    if archive_path.exists():
        raise TaskctlError(f"archive already exists: {slug}")

    archive_root.mkdir(parents=True, exist_ok=True)
    task_path.rename(archive_path)
    return f"archived {slug}"


def _task_restore(root_path: Path, task_path: Path, slug: str) -> str:
    if task_path.exists():
        raise TaskctlError(f"active task already exists: {slug}")

    _archive_root, archive_path = _task_archive_path_build(root_path, slug)
    if not archive_path.is_dir():
        raise TaskctlError(f"archived task not found: {slug}")

    task_path.parent.mkdir(parents=True, exist_ok=True)
    archive_path.rename(task_path)
    return f"restored {slug}"


def _task_archive_path_build(root_path: Path, slug: str) -> tuple[Path, Path]:
    archive_root = root_path.joinpath(*TASKS_DIR_PARTS, ARCHIVE_DIR_NAME).resolve()
    archive_path = archive_root.joinpath(slug).resolve()
    if not _path_is_relative_to(archive_path, archive_root):
        raise TaskctlError("archive path escapes .agents/tasks/.archive")
    return archive_root, archive_path


def _task_number_validate(task_number_value: str) -> int:
    try:
        task_number = int(task_number_value, 10)
    except ValueError as error:
        raise TaskctlError("task number must be a positive integer") from error
    if task_number < 1:
        raise TaskctlError("task number must be a positive integer")
    return task_number


def _task_set_retrieve(task_path: Path) -> TaskSet:
    tasks_path = task_path / TASKS_FILE_NAME
    if not tasks_path.exists():
        raise TaskctlError(f"missing {TASKS_FILE_NAME}")
    lines = tuple(tasks_path.read_text(encoding="utf-8").splitlines(keepends=True))
    entries = _task_entries_prepare(lines)
    if not entries:
        raise TaskctlError("tasks.md has no top-level checkbox tasks")
    return TaskSet(entries=entries, lines=lines)


def _task_entries_prepare(lines: tuple[str, ...]) -> tuple[TaskEntry, ...]:
    entries: list[TaskEntry] = []
    for line_offset, line in enumerate(lines):
        line_content, _line_ending = _line_content_and_ending_prepare(line)
        match = TASK_LINE_PATTERN.fullmatch(line_content)
        if match is None:
            continue
        entries.append(
            TaskEntry(
                index=len(entries) + 1,
                checked=match.group(1) == "x",
                line_number=line_offset + 1,
                text=match.group(2),
            )
        )
    return tuple(entries)


def _line_content_and_ending_prepare(line: str) -> tuple[str, str]:
    if line.endswith("\r\n"):
        return line[:-2], "\r\n"
    if line.endswith("\n"):
        return line[:-1], "\n"
    return line, ""


def _task_entry_get(entries: tuple[TaskEntry, ...], task_number: int) -> TaskEntry:
    for entry in entries:
        if entry.index == task_number:
            return entry
    raise TaskctlError(f"task number out of range: {task_number}")


def _task_entry_next(entries: tuple[TaskEntry, ...]) -> TaskEntry | None:
    for entry in entries:
        if not entry.checked:
            return entry
    return None


def _task_validation_errors_build(task_path: Path) -> list[str]:
    errors: list[str] = []
    plan_path = task_path / PLAN_FILE_NAME
    tasks_path = task_path / TASKS_FILE_NAME

    if not plan_path.exists():
        errors.append(f"missing {PLAN_FILE_NAME}")
    else:
        plan_text = plan_path.read_text(encoding="utf-8")
        errors.extend(_plan_validation_errors_build(plan_text))

    if not tasks_path.exists():
        errors.append(f"missing {TASKS_FILE_NAME}")
    else:
        task_lines = tuple(tasks_path.read_text(encoding="utf-8").splitlines())
        errors.extend(_tasks_validation_errors_build(task_lines))

    return errors


def _plan_validation_errors_build(plan_text: str) -> list[str]:
    errors: list[str] = []
    for heading in PLAN_HEADINGS_REQUIRED:
        if heading not in plan_text.splitlines():
            errors.append(f"plan.md missing heading: {heading}")

    pseudo_text = _section_text_extract(plan_text, "# Plain-English Pseudocode", "# Plan")
    if not _text_fence_has_content(pseudo_text):
        errors.append("plan.md Plain-English Pseudocode needs non-empty fenced text block")

    return errors


def _tasks_validation_errors_build(lines: tuple[str, ...]) -> list[str]:
    errors: list[str] = []
    entries = _task_entries_prepare(lines)
    if not entries:
        return ["tasks.md has no top-level checkbox tasks"]

    for entry_index, entry in enumerate(entries):
        start_offset = entry.line_number
        stop_offset = entries[entry_index + 1].line_number - 1 if entry_index + 1 < len(entries) else len(lines)
        nested_lines = lines[start_offset:stop_offset]
        errors.extend(_task_block_validation_errors_build(entry, nested_lines))

    return errors


def _task_block_validation_errors_build(entry: TaskEntry, nested_lines: tuple[str, ...]) -> list[str]:
    errors: list[str] = []

    if not any(line.startswith("  - Verify:") for line in nested_lines):
        errors.append(f"task {entry.index} missing nested Verify")

    pseudo_offsets = [offset for offset, line in enumerate(nested_lines) if line.strip() == "- Pseudo:"]
    for pseudo_offset in pseudo_offsets:
        pseudo_text = "\n".join(nested_lines[pseudo_offset + 1 :])
        if not _text_fence_has_content(pseudo_text):
            errors.append(f"task {entry.index} Pseudo needs non-empty fenced text block")

    return errors


def _section_text_extract(text: str, heading_start: str, heading_stop: str) -> str:
    lines = text.splitlines()
    try:
        start_offset = lines.index(heading_start) + 1
    except ValueError:
        return ""

    try:
        stop_offset = lines.index(heading_stop, start_offset)
    except ValueError:
        stop_offset = len(lines)

    return "\n".join(lines[start_offset:stop_offset])


def _text_fence_has_content(text: str) -> bool:
    lines = text.splitlines()
    inside_fence = False
    content_lines: list[str] = []

    for line in lines:
        if not inside_fence and line.strip() == "```text":
            inside_fence = True
            continue
        if inside_fence and line.strip() == "```":
            return any(content_line.strip() for content_line in content_lines)
        if inside_fence:
            content_lines.append(line)

    return False


def _file_text_write_atomic(file_path: Path, content: str) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        dir=str(file_path.parent),
        prefix=f".{file_path.name}.",
        suffix=".tmp",
        text=True,
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as temp_file:
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, file_path)
    except Exception:
        if temp_path.exists():
            temp_path.unlink()
        raise


if __name__ == "__main__":
    raise SystemExit(main())

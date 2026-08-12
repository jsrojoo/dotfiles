#!/usr/bin/env python3

import logging
import os
import subprocess
import tempfile

from zmux_args import parse_argument
from zmux_core import create_or_switch_session_return

LOGGER = logging.getLogger(__name__)


def configure_logging():
    log_level = os.environ.get("ZMUX_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=log_level, format="%(levelname)s: %(message)s")


def build_dir_name(start_dir: str) -> str:
    dir_name = start_dir.split("/")[-1]
    for char in [":", "."]:
        dir_name = dir_name.replace(char, "_")
    return dir_name


def select_start_dir(arguments):
    if arguments:
        dir_match = parse_argument(arguments)
        return dir_match.strip()

    zoxide_file_output = tempfile.NamedTemporaryFile(delete=False)
    zoxide_dirs_query = "zoxide query --list".split(" ")

    zoxide_query_list_result = subprocess.run(
        zoxide_dirs_query,
        capture_output=True,
        text=True,
        check=False,
    )

    dirs_list = zoxide_query_list_result.stdout
    dirs = "\n".join([_dir for _dir in dirs_list.split("\n") if _dir])

    os.system(f'echo "{dirs}" | fzf --reverse > {zoxide_file_output.name}')

    start_dir = open(zoxide_file_output.name, encoding="utf-8").read().strip()
    return start_dir


def ensure_codex_window(session_name: str, start_dir: str, window_name: str):
    list_windows_result = subprocess.run(
        ["tmux", "list-windows", "-t", session_name, "-F", "#W"],
        capture_output=True,
        text=True,
        check=False,
    )

    if list_windows_result.returncode != 0:
        error_message = list_windows_result.stderr.strip()
        LOGGER.error("Failed to list tmux windows: %s", error_message)
        return

    windows = [name.strip() for name in list_windows_result.stdout.split("\n") if name]

    if window_name in windows:
        os.system(f'tmux select-window -t "{session_name}:{window_name}"')
        return

    os.system(
        f'tmux new-window -t "{session_name}" -n "{window_name}" -c "{start_dir}" "codex"'
    )


def main():
    configure_logging()

    arguments = os.sys.argv[1:]
    start_dir = select_start_dir(arguments)

    if not start_dir:
        LOGGER.info("No directory selected; exiting.")
        return

    dir_name = build_dir_name(start_dir)
    session_name = create_or_switch_session_return(dir_name, start_dir)

    if not session_name:
        LOGGER.error("Unable to determine target tmux session; exiting.")
        return

    ensure_codex_window(session_name, start_dir, "codex-cli")


if __name__ == "__main__":
    main()

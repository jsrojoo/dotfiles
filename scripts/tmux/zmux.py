#!/usr/bin/env python3

import os
import sys
import subprocess
import tempfile
from zmux_args import parse_argument
from zmux_core import create_or_switch_session

sys_arg = sys.argv
arguments = sys_arg[1:]

if arguments:
    dir_match = parse_argument(arguments)

    start_dir = dir_match
    dir_name = start_dir.split("/")[-1]

    create_or_switch_session(dir_name, start_dir)
    exit()

zoxide_file_output = tempfile.NamedTemporaryFile(delete=False)

zoxide_dirs_query = "zoxide query --list".split(" ")

zoxide_query_list_result = subprocess.run(
    zoxide_dirs_query,
    capture_output=True,
    text=True,
)

dirs_list = zoxide_query_list_result.stdout

dirs = "\n".join([_dir for _dir in dirs_list.split("\n") if _dir])

os.system(f'echo "{dirs}" | fzf --reverse > {zoxide_file_output.name}')

start_dir = open(zoxide_file_output.name, encoding="utf-8").read().strip()

if not start_dir:
    exit()

# TODO: handle multiple matches from different parent directories
# /test_dir/dotfiles
# /github/dotfiles

dir_name = start_dir.split("/")[-1]

for char in [":", "."]:
    dir_name = dir_name.replace(char, "_")

create_or_switch_session(dir_name, start_dir)

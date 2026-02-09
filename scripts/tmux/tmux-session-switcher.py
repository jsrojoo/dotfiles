#!/usr/bin/env python3

import os
import subprocess
import tempfile

fzf_file_output = tempfile.NamedTemporaryFile(delete=False)

_session_name = '#S'
_window_name = '#W'
_window_index = '#{window_index}'
_pane_start_command = '#{pane_current_command}'

list_window_format = ':'.join([
        _session_name,
        _window_name,
        _window_index,
        _pane_start_command,
        ])

# retrieve all sessions and windows from tmux
retrieve_tmux_window_sessions_command = f"tmux lsw -a -F '{list_window_format}'"

tmux_sessions_command_result = subprocess.run(
        retrieve_tmux_window_sessions_command.split(' '),
        capture_output=True,
        text=True,
        )

_existing_sessions = tmux_sessions_command_result \
        .stdout \
        .replace("'", '')

existing_sessions = '\n'.join([
    existing_session 
    for existing_session in _existing_sessions.split('\n') 
    if existing_session
    ])

sessions_list = _existing_sessions.split('\n')

# (session_name, window_name, window_index, pane_start_command) = fzf_result

os.system(f'echo "{existing_sessions}" | fzf --reverse > {fzf_file_output.name}')

target_session = open(fzf_file_output.name, encoding='utf-8').read().strip()

if not target_session:
    exit()

(session_name, window_name, window_index, pane_start_command) = target_session.split(':')

tmux_switch_session_command = f'tmux switchc -t {session_name}:{window_index}'
os.system(tmux_switch_session_command)

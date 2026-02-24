#!/usr/bin/env python3

import argparse
import os
import subprocess
import tempfile
from typing import List

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


def parse_script_arguments() -> argparse.Namespace:
    argument_parser = argparse.ArgumentParser(
            description='Tmux window picker helper.',
            )
    argument_parser.add_argument(
            '--current-session',
            action='store_true',
            dest='session_current_only',
            help='Limit the list to the current session.',
            )
    argument_parser.add_argument(
            '--window-name',
            dest='window_name_filter',
            help='Limit the list to an exact window name match.',
            )

    return argument_parser.parse_args()

def list_tmux_windows(list_format: str, include_all_sessions: bool = True) -> List[str]:
    command_tokens = ['tmux', 'lsw']
    if include_all_sessions:
        command_tokens.append('-a')
    command_tokens.extend(['-F', list_format])

    command_result = subprocess.run(
            command_tokens,
            capture_output=True,
            text=True,
            )

    if command_result.returncode != 0:
        error_message = command_result.stderr.strip()
        raise RuntimeError(f'Unable to list tmux windows: {error_message}')

    sanitized_output = command_result.stdout.replace("'", '')
    return [line for line in sanitized_output.split('\n') if line]


def list_tmux_windows_target(list_format: str, session_name_target: str) -> List[str]:
    command_tokens = [
            'tmux',
            'lsw',
            '-t',
            session_name_target,
            '-F',
            list_format,
            ]

    command_result = subprocess.run(
            command_tokens,
            capture_output=True,
            text=True,
            )

    if command_result.returncode != 0:
        error_message = command_result.stderr.strip()
        raise RuntimeError(
                f'Unable to list tmux windows for session {session_name_target}: '
                f'{error_message}',
                )

    sanitized_output = command_result.stdout.replace("'", '')
    return [line for line in sanitized_output.split('\n') if line]


def determine_current_session_name() -> str:
    pane_identifier = os.environ.get('TMUX_PANE')
    command_tokens = ['tmux', 'display-message', '-p']
    if pane_identifier:
        command_tokens.extend(['-t', pane_identifier])
    command_tokens.append('#S')

    command_result = subprocess.run(
            command_tokens,
            capture_output=True,
            text=True,
            )

    if command_result.returncode != 0:
        error_message = command_result.stderr.strip()
        raise RuntimeError(f'Unable to determine current session: {error_message}')

    return command_result.stdout.strip()


def list_tmux_windows_current_session(list_format: str) -> List[str]:
    session_name_current = determine_current_session_name()
    return list_tmux_windows_target(list_format, session_name_current)


def build_existing_sessions_argument(
        session_current_only: bool,
        window_name_filter: str | None,
        ) -> str:
    window_lines = list_tmux_windows_current_session(list_window_format) \
            if session_current_only else list_tmux_windows(list_window_format)
    if window_name_filter:
        window_lines = [
                line for line in window_lines
                if line.split(':', 3)[1] == window_name_filter
                ]

    return '\n'.join(window_lines)

# (session_name, window_name, window_index, pane_start_command) = fzf_result
script_arguments = parse_script_arguments()
existing_sessions = build_existing_sessions_argument(
        session_current_only=script_arguments.session_current_only,
        window_name_filter=script_arguments.window_name_filter,
        )

os.system(f'echo "{existing_sessions}" | fzf --reverse > {fzf_file_output.name}')

target_session = open(fzf_file_output.name, encoding='utf-8').read().strip()

if not target_session:
    exit()

(session_name, window_name, window_index, pane_start_command) = target_session.split(':')

tmux_switch_session_command = f'tmux switchc -t {session_name}:{window_index}'
os.system(tmux_switch_session_command)

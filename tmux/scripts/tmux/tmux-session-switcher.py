#!/usr/bin/env python3

import argparse
import os
import shlex
import subprocess
import sys
from typing import List

MODE_ALL = 'all'
MODE_CODEX = 'codex'
MODE_CURRENT = 'current'
MODE_CYCLE_DIRECTION_NEXT = 'next'
MODE_CYCLE_DIRECTION_PREVIOUS = 'previous'
MODE_ORDER = (MODE_ALL, MODE_CURRENT, MODE_CODEX)
MODE_PROMPT_BY_MODE = {
        MODE_ALL: 'all> ',
        MODE_CURRENT: 'current> ',
        MODE_CODEX: 'codex> ',
        }

WINDOW_NAME_CODEX = 'codex'

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
            help='Limit the list to window names containing this text.',
            )
    argument_parser.add_argument(
            '--fzf-list-mode',
            choices=MODE_ORDER,
            dest='fzf_list_mode',
            help=argparse.SUPPRESS,
            )
    argument_parser.add_argument(
            '--fzf-cycle-direction',
            choices=(MODE_CYCLE_DIRECTION_PREVIOUS, MODE_CYCLE_DIRECTION_NEXT),
            dest='fzf_cycle_direction',
            help=argparse.SUPPRESS,
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
                if window_name_filter in line.split(':', 3)[1]
                ]

    return '\n'.join(window_lines)


def selector_mode_initial_prepare(
        session_current_only: bool,
        window_name_filter: str | None,
        ) -> str:
    if session_current_only:
        return MODE_CURRENT
    if window_name_filter == WINDOW_NAME_CODEX:
        return MODE_CODEX
    return MODE_ALL


def selector_mode_cycle(selector_mode: str, cycle_direction: str) -> str:
    mode_index = MODE_ORDER.index(selector_mode)
    mode_offset = -1 if cycle_direction == MODE_CYCLE_DIRECTION_PREVIOUS else 1
    return MODE_ORDER[(mode_index + mode_offset) % len(MODE_ORDER)]


def selector_mode_from_prompt(prompt: str) -> str:
    prompt_name = prompt.strip().removesuffix('>')
    for selector_mode, mode_prompt in MODE_PROMPT_BY_MODE.items():
        if prompt_name == mode_prompt.strip().removesuffix('>'):
            return selector_mode
    raise RuntimeError(f'Unable to determine selector mode from prompt: {prompt}')


def selector_window_rows_by_mode_build(selector_mode: str) -> str:
    if selector_mode == MODE_CURRENT:
        return build_existing_sessions_argument(
                session_current_only=True,
                window_name_filter=None,
                )
    if selector_mode == MODE_CODEX:
        return build_existing_sessions_argument(
                session_current_only=False,
                window_name_filter=WINDOW_NAME_CODEX,
                )
    if selector_mode == MODE_ALL:
        return build_existing_sessions_argument(
                session_current_only=False,
                window_name_filter=None,
                )
    raise RuntimeError(f'Unsupported selector mode: {selector_mode}')


def selector_window_rows_initial_build(
        session_current_only: bool,
        window_name_filter: str | None,
        ) -> str:
    return build_existing_sessions_argument(
            session_current_only=session_current_only,
            window_name_filter=window_name_filter,
            )


def fzf_reload_command_build(script_path: str, selector_mode: str) -> str:
    command_tokens = [
            script_path,
            '--fzf-list-mode',
            selector_mode,
            ]
    return ' '.join(shlex.quote(token) for token in command_tokens)


def fzf_cycle_action_build(
        script_path: str,
        cycle_direction: str,
        prompt_current: str,
        ) -> str:
    selector_mode_current = selector_mode_from_prompt(prompt_current)
    selector_mode_next = selector_mode_cycle(selector_mode_current, cycle_direction)
    reload_command = fzf_reload_command_build(script_path, selector_mode_next)
    prompt_next = MODE_PROMPT_BY_MODE[selector_mode_next]
    return f'reload({reload_command})+change-prompt({prompt_next})'


def fzf_cycle_transform_command_build(
        script_path: str,
        cycle_direction: str,
        ) -> str:
    command_tokens = [
            script_path,
            '--fzf-cycle-direction',
            cycle_direction,
            ]
    return ' '.join(shlex.quote(token) for token in command_tokens)


def fzf_select_window(
        existing_sessions: str,
        script_path: str,
        selector_mode: str,
        ) -> str:
    command_tokens = [
            'fzf',
            '--reverse',
            '--prompt',
            MODE_PROMPT_BY_MODE[selector_mode],
            '--bind',
            (
                    'ctrl-h:transform('
                    f'{fzf_cycle_transform_command_build(script_path, MODE_CYCLE_DIRECTION_PREVIOUS)}'
                    ')'
                    ),
            '--bind',
            (
                    'ctrl-l:transform('
                    f'{fzf_cycle_transform_command_build(script_path, MODE_CYCLE_DIRECTION_NEXT)}'
                    ')'
                    ),
            ]
    command_result = subprocess.run(
            command_tokens,
            input=existing_sessions,
            capture_output=True,
            text=True,
            )
    if command_result.returncode not in (0, 130):
        error_message = command_result.stderr.strip()
        raise RuntimeError(f'Unable to select tmux window with fzf: {error_message}')
    return command_result.stdout.strip()


def tmux_window_target_parse(target_session: str) -> tuple[str, str, str, str]:
    return tuple(target_session.split(':', 3))


def tmux_window_switch(session_name: str, window_index: str) -> None:
    command_result = subprocess.run(
            ['tmux', 'switchc', '-t', f'{session_name}:{window_index}'],
            capture_output=True,
            text=True,
            )
    if command_result.returncode != 0:
        error_message = command_result.stderr.strip()
        raise RuntimeError(f'Unable to switch tmux window: {error_message}')


def main() -> None:
    # (session_name, window_name, window_index, pane_start_command) = fzf_result
    script_arguments = parse_script_arguments()
    script_path = os.path.abspath(__file__)

    if script_arguments.fzf_list_mode:
        print(selector_window_rows_by_mode_build(script_arguments.fzf_list_mode))
        return

    if script_arguments.fzf_cycle_direction:
        prompt_current = os.environ.get('FZF_PROMPT', '')
        print(fzf_cycle_action_build(
                script_path,
                script_arguments.fzf_cycle_direction,
                prompt_current,
                ))
        return

    selector_mode = selector_mode_initial_prepare(
            session_current_only=script_arguments.session_current_only,
            window_name_filter=script_arguments.window_name_filter,
            )
    existing_sessions = selector_window_rows_initial_build(
            session_current_only=script_arguments.session_current_only,
            window_name_filter=script_arguments.window_name_filter,
            )
    target_session = fzf_select_window(
            existing_sessions=existing_sessions,
            script_path=script_path,
            selector_mode=selector_mode,
            )

    if not target_session:
        return

    session_name, window_name, window_index, pane_start_command = \
            tmux_window_target_parse(target_session)
    tmux_window_switch(session_name, window_index)


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as runtime_error:
        print(runtime_error, file=sys.stderr)
        sys.exit(1)

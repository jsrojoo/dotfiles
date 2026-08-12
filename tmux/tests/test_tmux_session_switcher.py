import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch


SCRIPT_PATH = (
        Path(__file__).resolve().parents[1]
        / 'scripts'
        / 'tmux'
        / 'tmux-session-switcher.py'
        )

MODULE_SPEC = importlib.util.spec_from_file_location(
        'tmux_session_switcher',
        SCRIPT_PATH,
        )
tmux_session_switcher = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(tmux_session_switcher)


class TmuxSessionSwitcherModeTest(TestCase):
    def test_selector_mode_initial_prepare_uses_existing_cli_modes(self):
        self.assertEqual(
                tmux_session_switcher.MODE_ALL,
                tmux_session_switcher.selector_mode_initial_prepare(False, None),
                )
        self.assertEqual(
                tmux_session_switcher.MODE_CURRENT,
                tmux_session_switcher.selector_mode_initial_prepare(True, None),
                )
        self.assertEqual(
                tmux_session_switcher.MODE_CODEX,
                tmux_session_switcher.selector_mode_initial_prepare(False, 'codex'),
                )

    def test_selector_mode_cycle_wraps_forward_and_backward(self):
        self.assertEqual(
                tmux_session_switcher.MODE_CURRENT,
                tmux_session_switcher.selector_mode_cycle(
                        tmux_session_switcher.MODE_ALL,
                        tmux_session_switcher.MODE_CYCLE_DIRECTION_NEXT,
                        ),
                )
        self.assertEqual(
                tmux_session_switcher.MODE_ALL,
                tmux_session_switcher.selector_mode_cycle(
                        tmux_session_switcher.MODE_CODEX,
                        tmux_session_switcher.MODE_CYCLE_DIRECTION_NEXT,
                        ),
                )
        self.assertEqual(
                tmux_session_switcher.MODE_CODEX,
                tmux_session_switcher.selector_mode_cycle(
                        tmux_session_switcher.MODE_ALL,
                        tmux_session_switcher.MODE_CYCLE_DIRECTION_PREVIOUS,
                        ),
                )

    def test_fzf_cycle_action_build_reloads_next_mode_and_prompt(self):
        action = tmux_session_switcher.fzf_cycle_action_build(
                '/tmp/tmux-session-switcher.py',
                tmux_session_switcher.MODE_CYCLE_DIRECTION_NEXT,
                'current> ',
                )

        self.assertEqual(
                (
                        'reload(/tmp/tmux-session-switcher.py --fzf-list-mode codex)'
                        '+change-prompt(codex> )'
                        ),
                action,
                )

    def test_selector_window_rows_by_mode_build_maps_modes_to_filters(self):
        with patch.object(
                tmux_session_switcher,
                'build_existing_sessions_argument',
                return_value='rows',
                ) as build_existing_sessions_argument:
            self.assertEqual(
                    'rows',
                    tmux_session_switcher.selector_window_rows_by_mode_build(
                            tmux_session_switcher.MODE_CODEX,
                            ),
                    )

        build_existing_sessions_argument.assert_called_once_with(
                session_current_only=False,
                window_name_filter='codex',
                )

    def test_selector_window_rows_initial_build_preserves_arbitrary_window_filter(self):
        with patch.object(
                tmux_session_switcher,
                'build_existing_sessions_argument',
                return_value='rows',
                ) as build_existing_sessions_argument:
            self.assertEqual(
                    'rows',
                    tmux_session_switcher.selector_window_rows_initial_build(
                            session_current_only=False,
                            window_name_filter='notes',
                            ),
                    )

        build_existing_sessions_argument.assert_called_once_with(
                session_current_only=False,
                window_name_filter='notes',
                )

    def test_selector_window_rows_initial_build_preserves_current_and_filter(self):
        with patch.object(
                tmux_session_switcher,
                'build_existing_sessions_argument',
                return_value='rows',
                ) as build_existing_sessions_argument:
            self.assertEqual(
                    'rows',
                    tmux_session_switcher.selector_window_rows_initial_build(
                            session_current_only=True,
                            window_name_filter='notes',
                            ),
                    )

        build_existing_sessions_argument.assert_called_once_with(
                session_current_only=True,
                window_name_filter='notes',
                )

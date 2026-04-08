import unittest
from unittest import mock

import notify


class BuildResumeCommandTest(unittest.TestCase):
    def test_builds_resume_command_with_tmux_and_kitty_context(self) -> None:
        resume_context = notify.ResumeContext(
            kitty_listen_on="unix:/tmp/kitty",
            kitty_window_id="17",
            tmux_client_tty="/dev/ttys123",
            tmux_pane_target="work:2.1",
            tmux_window_target="work:2",
        )

        with mock.patch(
            "notify.shutil.which",
            side_effect=lambda command_name: {
                "osascript": "/usr/bin/osascript",
                "kitty": "/opt/kitty/bin/kitty",
                "tmux": "/opt/homebrew/bin/tmux",
            }.get(command_name),
        ):
            resume_command = notify.build_resume_command(resume_context)

        self.assertIn("/usr/bin/osascript -e", resume_command)
        self.assertIn('application id "net.kovidgoyal.kitty" to activate', resume_command)
        self.assertIn(
            "/opt/kitty/bin/kitty @ --to unix:/tmp/kitty focus-window --match id:17",
            resume_command,
        )
        self.assertIn(
            "/opt/homebrew/bin/tmux switch-client -c /dev/ttys123 -t work:2",
            resume_command,
        )
        self.assertIn("/opt/homebrew/bin/tmux select-pane -t work:2.1", resume_command)

    def test_builds_resume_command_with_activation_only_when_context_missing(self) -> None:
        resume_context = notify.ResumeContext()

        with mock.patch("notify.shutil.which", return_value="/usr/bin/osascript"):
            resume_command = notify.build_resume_command(resume_context)

        self.assertIn("/usr/bin/osascript -e", resume_command)
        self.assertNotIn("kitty @", resume_command)
        self.assertNotIn("tmux switch-client", resume_command)
        self.assertNotIn("tmux select-pane", resume_command)

    def test_falls_back_to_bare_command_name_when_lookup_fails(self) -> None:
        resume_context = notify.ResumeContext(tmux_window_target="work:2")

        with mock.patch("notify.shutil.which", return_value=None):
            resume_command = notify.build_resume_command(resume_context)

        self.assertIn("/usr/bin/osascript -e", resume_command)
        self.assertIn("tmux switch-client -t work:2", resume_command)


class BuildNotifierCommandTest(unittest.TestCase):
    def test_includes_execute_when_resume_command_present(self) -> None:
        notifier_command = notify.build_notifier_command(
            message="done",
            resume_command="echo resume",
            thread_id="thread-123",
            title="Codex",
        )

        self.assertEqual(notifier_command[0], "terminal-notifier")
        self.assertIn("-activate", notifier_command)
        self.assertIn("net.kovidgoyal.kitty", notifier_command)
        self.assertIn("-execute", notifier_command)
        self.assertIn("echo resume", notifier_command)

    def test_skips_execute_when_resume_command_is_empty(self) -> None:
        notifier_command = notify.build_notifier_command(
            message="done",
            resume_command="",
            thread_id="thread-123",
            title="Codex",
        )

        self.assertNotIn("-execute", notifier_command)


class MainNotifierCommandTest(unittest.TestCase):
    def test_main_wires_resume_command_into_terminal_notifier(self) -> None:
        notification_payload = {
            "client": "codex-exec",
            "type": "agent-turn-complete",
            "thread-id": "thread-123",
            "input-messages": ["done"],
        }
        command_calls: list[list[str]] = []

        def subprocess_check_output_mock(
            command: list[str], text: bool = False
        ) -> str | bytes:
            if command[:3] == ["tmux", "display-message", "-p"]:
                format_string = command[-1]
                tmux_value_map = {
                    "#{session_name}:#{window_index}.#{pane_index} #{window_name}": "work:2.1 editor",
                    "#{session_name}:#{window_name}": "work:editor",
                    "#{client_tty}": "/dev/ttys123",
                    "#{session_name}:#{window_index}": "work:2",
                    "#{session_name}:#{window_index}.#{pane_index}": "work:2.1",
                }
                return tmux_value_map[format_string]

            command_calls.append(command)
            return b""

        with (
            mock.patch.dict(
                "os.environ",
                {
                    "TMUX": "/tmp/tmux-1000/default,123,0",
                    "TMUX_PANE": "%1",
                    "KITTY_LISTEN_ON": "unix:/tmp/kitty",
                    "KITTY_WINDOW_ID": "17",
                },
                clear=False,
            ),
            mock.patch(
                "notify.shutil.which",
                side_effect=lambda command_name: {
                    "osascript": "/usr/bin/osascript",
                    "kitty": "/opt/kitty/bin/kitty",
                    "tmux": "/opt/homebrew/bin/tmux",
                }.get(command_name),
            ),
            mock.patch("sys.argv", ["notify.py", __import__("json").dumps(notification_payload)]),
            mock.patch("subprocess.check_output", side_effect=subprocess_check_output_mock),
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        self.assertEqual(len(command_calls), 1)

        notifier_command = command_calls[0]
        self.assertEqual(notifier_command[0], "terminal-notifier")
        self.assertIn("-activate", notifier_command)
        self.assertIn("net.kovidgoyal.kitty", notifier_command)
        self.assertIn("-execute", notifier_command)
        self.assertIn("-message", notifier_command)

        message_index = notifier_command.index("-message") + 1
        self.assertEqual(notifier_command[message_index], "work:2.1 editor\ndone")

        execute_index = notifier_command.index("-execute") + 1
        resume_command = notifier_command[execute_index]
        self.assertIn("/usr/bin/osascript -e", resume_command)
        self.assertIn(
            "/opt/kitty/bin/kitty @ --to unix:/tmp/kitty focus-window --match id:17",
            resume_command,
        )
        self.assertIn(
            "/opt/homebrew/bin/tmux switch-client -c /dev/ttys123 -t work:2",
            resume_command,
        )
        self.assertIn("/opt/homebrew/bin/tmux select-pane -t work:2.1", resume_command)

    def test_main_skips_subagent_turn_complete_without_client(self) -> None:
        notification_payload = {
            "type": "agent-turn-complete",
            "thread-id": "thread-123",
            "input-messages": ["done"],
        }

        with (
            mock.patch("sys.argv", ["notify.py", __import__("json").dumps(notification_payload)]),
            mock.patch("subprocess.check_output") as check_output_mock,
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        check_output_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()

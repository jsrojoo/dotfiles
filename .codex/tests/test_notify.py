import json
import os
import io
import tempfile
import unittest
from unittest import mock

import hook_payload
import notify
import notify_hook_harness


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
    def test_includes_message_and_execute_when_present(self) -> None:
        notifier_command = notify.build_notifier_command(
            message="done",
            resume_command="echo resume",
            thread_id="thread-123",
            title="Codex",
        )

        self.assertEqual(notifier_command[0], "terminal-notifier")
        self.assertIn("-activate", notifier_command)
        self.assertIn("net.kovidgoyal.kitty", notifier_command)
        self.assertIn("-message", notifier_command)
        self.assertIn("done", notifier_command)
        self.assertIn("-execute", notifier_command)
        self.assertIn("echo resume", notifier_command)

    def test_skips_optional_fields_when_empty(self) -> None:
        notifier_command = notify.build_notifier_command(
            message="",
            resume_command="",
            thread_id="thread-123",
            title="Codex",
        )

        self.assertNotIn("-message", notifier_command)
        self.assertNotIn("-execute", notifier_command)


class HookPayloadClassificationTest(unittest.TestCase):
    def test_classifies_main_stop_as_main_agent(self) -> None:
        classification = hook_payload.classify_hook_payload(
            {"hook_event_name": hook_payload.HOOK_EVENT_NAME_STOP}
        )

        self.assertFalse(classification.is_subagent)
        self.assertEqual(classification.detection_source, "hook_event_name")

    def test_classifies_subagent_stop_as_subagent_first(self) -> None:
        classification = hook_payload.classify_hook_payload(
            {
                "agent_id": "agent-123",
                "hook_event_name": hook_payload.HOOK_EVENT_NAME_SUBAGENT_STOP,
                "notification-channel": hook_payload.NOTIFICATION_CHANNEL_MAIN,
            }
        )

        self.assertTrue(classification.is_subagent)
        self.assertEqual(classification.detection_source, "hook_event_name")

    def test_classifies_agent_identity_as_subagent_fallback(self) -> None:
        classification = hook_payload.classify_hook_payload(
            {"agent_transcript_path": "/tmp/subagent.jsonl"}
        )

        self.assertTrue(classification.is_subagent)
        self.assertEqual(classification.detection_source, "agent_identity")

    def test_classifies_notification_channel_as_fallback_when_event_missing(self) -> None:
        classification = hook_payload.classify_hook_payload(
            {"notification-channel": hook_payload.NOTIFICATION_CHANNEL_SUBAGENT}
        )

        self.assertTrue(classification.is_subagent)
        self.assertEqual(classification.detection_source, "notification_channel")


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
            mock.patch("sys.argv", ["notify.py", json.dumps(notification_payload)]),
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
            mock.patch("sys.argv", ["notify.py", json.dumps(notification_payload)]),
            mock.patch("subprocess.check_output") as check_output_mock,
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        check_output_mock.assert_not_called()

    def test_main_skips_subagent_stop_hook_payload(self) -> None:
        notification_payload = {
            "hook_event_name": hook_payload.HOOK_EVENT_NAME_SUBAGENT_STOP,
            "thread-id": "thread-123",
        }

        with (
            mock.patch("sys.argv", ["notify.py", json.dumps(notification_payload)]),
            mock.patch("subprocess.check_output") as check_output_mock,
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        check_output_mock.assert_not_called()

    def test_main_notifies_for_main_stop_hook_payload(self) -> None:
        notification_payload = {
            "hook_event_name": hook_payload.HOOK_EVENT_NAME_STOP,
            "thread-id": "thread-123",
        }

        with (
            mock.patch.dict("os.environ", {}, clear=True),
            mock.patch("sys.argv", ["notify.py", json.dumps(notification_payload)]),
            mock.patch("subprocess.check_output", return_value=b"") as check_output_mock,
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        self.assertEqual(check_output_mock.call_count, 1)

    def test_main_notifies_for_main_notification_channel_fallback(self) -> None:
        notification_payload = {
            "notification-channel": hook_payload.NOTIFICATION_CHANNEL_MAIN,
            "thread-id": "thread-123",
        }

        with (
            mock.patch.dict("os.environ", {}, clear=True),
            mock.patch("sys.argv", ["notify.py", json.dumps(notification_payload)]),
            mock.patch("subprocess.check_output", return_value=b"") as check_output_mock,
        ):
            result_code = notify.main()

        self.assertEqual(result_code, 0)
        self.assertEqual(check_output_mock.call_count, 1)


class NotifyHookHarnessTest(unittest.TestCase):
    def test_harness_appends_jsonl_record(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = os.path.join(temp_dir, "hook-log.jsonl")
            payload = json.dumps(
                {"hook_event_name": hook_payload.HOOK_EVENT_NAME_SUBAGENT_STOP}
            )

            with mock.patch(
                "sys.argv",
                ["notify_hook_harness.py", "--log-path", log_path, payload],
            ), mock.patch("sys.stdout", new_callable=io.StringIO) as stdout_mock:
                result_code = notify_hook_harness.main()

            self.assertEqual(result_code, 0)
            self.assertEqual(stdout_mock.getvalue(), "")
            with open(log_path, encoding="utf-8") as log_file:
                record = json.loads(log_file.readline())

        self.assertTrue(record["is_subagent"])
        self.assertEqual(record["detection_source"], "hook_event_name")
        self.assertFalse(record["agent_id_present"])


if __name__ == "__main__":
    unittest.main()

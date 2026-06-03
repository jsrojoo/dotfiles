#!/usr/bin/env python3

from dataclasses import dataclass
import json
import logging
import os
import shlex
import shutil
import subprocess
import sys

from hook_payload import classify_hook_payload


APP_BUNDLE_ID_KITTY = "net.kovidgoyal.kitty"
COMMAND_NAME_KITTY = "kitty"
COMMAND_NAME_OSASCRIPT = "osascript"
COMMAND_NAME_TMUX = "tmux"
NOTIFIER_GROUP_PREFIX = "codex-"
NOTIFIER_SOUND_NAME = "Bell"
TMUX_FORMAT_CLIENT_TTY = "#{client_tty}"
TMUX_FORMAT_MESSAGE = "#{session_name}:#{window_index}.#{pane_index} #{window_name}"
TMUX_FORMAT_PANE_TARGET = "#{session_name}:#{window_index}.#{pane_index}"
TMUX_FORMAT_TITLE = "#{session_name}:#{window_name}"
TMUX_FORMAT_WINDOW_TARGET = "#{session_name}:#{window_index}"

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResumeContext:
    kitty_listen_on: str | None = None
    kitty_window_id: str | None = None
    tmux_client_tty: str | None = None
    tmux_pane_target: str | None = None
    tmux_window_target: str | None = None


def build_notifier_command(
    *,
    message: str,
    resume_command: str,
    thread_id: str,
    title: str,
) -> list[str]:
    command = [
        "terminal-notifier",
        "-title",
        title,
        "-group",
        NOTIFIER_GROUP_PREFIX + thread_id,
        "-ignoreDnD",
        "-activate",
        APP_BUNDLE_ID_KITTY,
        "-sound",
        NOTIFIER_SOUND_NAME,
    ]

    if message:
        command.extend(["-message", message])

    if resume_command:
        command.extend(["-execute", resume_command])

    return command


def build_resume_command(resume_context: ResumeContext) -> str:
    command_path_kitty = resolve_command_path(COMMAND_NAME_KITTY)
    command_path_osascript = resolve_command_path(
        COMMAND_NAME_OSASCRIPT, fallback_path="/usr/bin/osascript"
    )
    command_path_tmux = resolve_command_path(COMMAND_NAME_TMUX)

    command_items = [
        shell_quote_command(
            [
                command_path_osascript,
                "-e",
                f'tell application id "{APP_BUNDLE_ID_KITTY}" to activate',
            ]
        )
    ]

    if resume_context.kitty_listen_on and resume_context.kitty_window_id:
        command_items.append(
            shell_quote_command(
                [
                    command_path_kitty,
                    "@",
                    "--to",
                    resume_context.kitty_listen_on,
                    "focus-window",
                    "--match",
                    f"id:{resume_context.kitty_window_id}",
                ]
            )
        )

    if resume_context.tmux_client_tty and resume_context.tmux_window_target:
        command_items.append(
            shell_quote_command(
                [
                    command_path_tmux,
                    "switch-client",
                    "-c",
                    resume_context.tmux_client_tty,
                    "-t",
                    resume_context.tmux_window_target,
                ]
            )
        )
    elif resume_context.tmux_window_target:
        command_items.append(
            shell_quote_command(
                [
                    command_path_tmux,
                    "switch-client",
                    "-t",
                    resume_context.tmux_window_target,
                ]
            )
        )

    if resume_context.tmux_pane_target:
        command_items.append(
            shell_quote_command(
                [command_path_tmux, "select-pane", "-t", resume_context.tmux_pane_target]
            )
        )

    return " ; ".join(command_items)


def get_notification_message(notification: dict) -> str:
    message_lines: list[str] = []

    if get_tmux_environment() and (tmux_message := get_tmux_value(TMUX_FORMAT_MESSAGE)):
        message_lines.append(tmux_message)

    input_messages = notification.get("input-messages")
    if isinstance(input_messages, list):
        message_lines.extend(str(message_item) for message_item in input_messages if message_item)
    elif input_messages:
        message_lines.append(str(input_messages))
    elif assistant_message := notification.get("last-assistant-message"):
        message_lines.append(str(assistant_message))

    return "\n".join(message_lines)


def get_notification_title(notification: dict) -> str:
    if get_tmux_environment():
        return get_tmux_title() or "tmux"

    assistant_message = notification.get("last-assistant-message")
    if assistant_message:
        return f"Codex: {assistant_message}"

    return "Codex: Turn Complete!"


def get_resume_context() -> ResumeContext:
    return ResumeContext(
        kitty_listen_on=os.environ.get("KITTY_LISTEN_ON") or None,
        kitty_window_id=os.environ.get("KITTY_WINDOW_ID") or None,
        tmux_client_tty=get_tmux_value(TMUX_FORMAT_CLIENT_TTY),
        tmux_pane_target=get_tmux_value(TMUX_FORMAT_PANE_TARGET),
        tmux_window_target=get_tmux_value(TMUX_FORMAT_WINDOW_TARGET),
    )


def get_tmux_environment() -> bool:
    return bool(os.environ.get("TMUX") or os.environ.get("TMUX_PANE"))


def get_tmux_title() -> str | None:
    return get_tmux_value(TMUX_FORMAT_TITLE)


def get_tmux_value(format_string: str) -> str | None:
    if not get_tmux_environment():
        return None

    command = ["tmux", "display-message", "-p"]
    if pane_value := os.environ.get("TMUX_PANE"):
        command.extend(["-t", pane_value])
    command.append(format_string)

    try:
        value = subprocess.check_output(command, text=True).strip()
    except (OSError, subprocess.CalledProcessError) as error:
        LOGGER.debug("tmux metadata lookup failed for %s: %s", format_string, error)
        return None

    return value or None


def load_notification() -> dict:
    if len(sys.argv) == 2:
        raw_notification = sys.argv[1]
    else:
        raw_notification = sys.stdin.read()

    if not raw_notification:
        raise ValueError("missing notification payload")

    return json.loads(raw_notification)


def should_notify(notification: dict) -> bool:
    if notification.get("type") == "agent-turn-complete":
        return bool(notification.get("client"))

    if notification.get("hook_event_name") or notification.get("notification-channel"):
        return not classify_hook_payload(notification).is_subagent

    return False


def main() -> int:
    try:
        notification = load_notification()
    except (ValueError, json.JSONDecodeError) as error:
        LOGGER.error("failed to load notification payload: %s", error)
        return 1

    if not should_notify(notification):
        print(f"not sending a push notification for: {notification.get('type')}")
        return 0

    title = get_notification_title(notification)
    thread_id = notification.get("thread-id", "")

    notifier_command = build_notifier_command(
        message=get_notification_message(notification),
        resume_command=build_resume_command(get_resume_context()),
        thread_id=thread_id,
        title=title,
    )

    try:
        subprocess.check_output(notifier_command)
    except (OSError, subprocess.CalledProcessError) as error:
        LOGGER.error("failed to send notification: %s", error)
        return 1

    return 0


def shell_quote_command(command_items: list[str]) -> str:
    return " ".join(shlex.quote(command_item) for command_item in command_items)


def resolve_command_path(command_name: str, *, fallback_path: str | None = None) -> str:
    if command_path := shutil.which(command_name):
        return command_path

    if fallback_path:
        LOGGER.debug(
            "using fallback command path for %s: %s", command_name, fallback_path
        )
        return fallback_path

    LOGGER.warning(
        "command path lookup failed for %s; using bare command name", command_name
    )
    return command_name


if __name__ == "__main__":
    raise SystemExit(main())

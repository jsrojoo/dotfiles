#!/usr/bin/env python3

import json
import os
import subprocess
import sys


def get_tmux_environment() -> bool:
    return bool(os.environ.get("TMUX") or os.environ.get("TMUX_PANE"))


def load_notification() -> dict:
    if len(sys.argv) == 2:
        raw_notification = sys.argv[1]
    else:
        raw_notification = sys.stdin.read()

    if not raw_notification:
        raise ValueError("missing notification payload")

    return json.loads(raw_notification)


def get_tmux_value(format_string: str) -> str | None:
    if not get_tmux_environment():
        return None

    command = ["tmux", "display-message", "-p"]
    if pane := os.environ.get("TMUX_PANE"):
        command.extend(["-t", pane])
    command.append(format_string)

    try:
        value = subprocess.check_output(command, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    return value or None


def get_tmux_context() -> str | None:
    return get_tmux_value("#{session_name}:#{window_index}.#{pane_index} #{window_name}")


def get_tmux_title() -> str | None:
    return get_tmux_value("#{session_name}:#{window_name}")


def get_notification_title(notification: dict) -> str:
    if get_tmux_environment():
        return get_tmux_title() or "tmux"

    assistant_message = notification.get("last-assistant-message")
    if assistant_message:
        return f"Codex: {assistant_message}"

    return "Codex: Turn Complete!"


def main() -> int:
    try:
        notification = load_notification()
    except (ValueError, json.JSONDecodeError):
        return 1

    match notification_type := notification.get("type"):
        case "agent-turn-complete":
            title = get_notification_title(notification)
            input_messages = notification.get("input-messages", [])
            message = " ".join(input_messages)
        case _:
            print(f"not sending a push notification for: {notification_type}")
            return 0

    thread_id = notification.get("thread-id", "")
    if tmux_context := get_tmux_context():
        if message:
            message = f"{tmux_context}\n{message}"
        else:
            message = tmux_context

    command = [
        "terminal-notifier",
        "-title",
        title,
        "-message",
        message,
        "-group",
        "codex-" + thread_id,
        "-ignoreDnD",
        "-activate",
        "com.googlecode.iterm2",
        "-sound",
        "Bell",
    ]

    subprocess.check_output(command)

    return 0


if __name__ == "__main__":
    sys.exit(main())

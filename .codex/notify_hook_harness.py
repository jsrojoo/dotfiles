#!/usr/bin/env python3

import json
import sys
import tempfile

from hook_payload import append_jsonl_record, build_hook_classification_record


ARG_LOG_PATH = "--log-path"
ARG_PRINT_LOG_PATH = "--print-log-path"
DEFAULT_LOG_PATH = tempfile.gettempdir() + "/codex-hook-classification.jsonl"


def load_payload(raw_payload: str | None) -> dict:
    if raw_payload is not None:
        if not raw_payload:
            raise ValueError("missing hook payload")
        return json.loads(raw_payload)

    stdin_payload = sys.stdin.read()
    if not stdin_payload:
        raise ValueError("missing hook payload")
    return json.loads(stdin_payload)


def parse_args(argv: list[str]) -> tuple[str, bool, str | None]:
    print_log_path = False

    if argv and argv[0] == ARG_PRINT_LOG_PATH:
        print_log_path = True
        argv = argv[1:]

    if not argv:
        return DEFAULT_LOG_PATH, print_log_path, None

    if argv[0] != ARG_LOG_PATH:
        return DEFAULT_LOG_PATH, print_log_path, argv[0]

    if len(argv) < 2:
        raise ValueError("missing log path")

    payload = argv[2] if len(argv) > 2 else None
    return argv[1], print_log_path, payload


def main() -> int:
    try:
        log_path, print_log_path, raw_payload = parse_args(sys.argv[1:])
        payload = load_payload(raw_payload)
    except (ValueError, json.JSONDecodeError) as error:
        print(f"notify_hook_harness error: {error}", file=sys.stderr)
        return 1

    record = build_hook_classification_record(payload)
    append_jsonl_record(log_path=log_path, record=record)
    if print_log_path:
        print(log_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from dataclasses import asdict, dataclass
import json
from pathlib import Path


HOOK_EVENT_NAME_STOP = "Stop"
HOOK_EVENT_NAME_SUBAGENT_STOP = "SubagentStop"
HOOK_SUBAGENT_FIELD_NAMES = (
    "agent_id",
    "agent_type",
    "agent_transcript_path",
)
NOTIFICATION_CHANNEL_MAIN = "main"
NOTIFICATION_CHANNEL_SUBAGENT = "subagent"


@dataclass(frozen=True)
class HookPayloadClassification:
    detection_source: str
    hook_event_name: str | None
    is_subagent: bool
    notification_channel: str | None
    subagent_identity_present: bool


def has_subagent_identity(notification: dict) -> bool:
    return any(notification.get(field_name) for field_name in HOOK_SUBAGENT_FIELD_NAMES)


def classify_hook_payload(notification: dict) -> HookPayloadClassification:
    hook_event_name = notification.get("hook_event_name")
    notification_channel = notification.get("notification-channel")
    subagent_identity_present = has_subagent_identity(notification)

    if hook_event_name == HOOK_EVENT_NAME_SUBAGENT_STOP:
        return HookPayloadClassification(
            detection_source="hook_event_name",
            hook_event_name=hook_event_name,
            is_subagent=True,
            notification_channel=notification_channel,
            subagent_identity_present=subagent_identity_present,
        )

    if hook_event_name == HOOK_EVENT_NAME_STOP:
        return HookPayloadClassification(
            detection_source="hook_event_name",
            hook_event_name=hook_event_name,
            is_subagent=False,
            notification_channel=notification_channel,
            subagent_identity_present=subagent_identity_present,
        )

    if subagent_identity_present:
        return HookPayloadClassification(
            detection_source="agent_identity",
            hook_event_name=hook_event_name,
            is_subagent=True,
            notification_channel=notification_channel,
            subagent_identity_present=subagent_identity_present,
        )

    if notification_channel == NOTIFICATION_CHANNEL_SUBAGENT:
        return HookPayloadClassification(
            detection_source="notification_channel",
            hook_event_name=hook_event_name,
            is_subagent=True,
            notification_channel=notification_channel,
            subagent_identity_present=subagent_identity_present,
        )

    if notification_channel == NOTIFICATION_CHANNEL_MAIN:
        return HookPayloadClassification(
            detection_source="notification_channel",
            hook_event_name=hook_event_name,
            is_subagent=False,
            notification_channel=notification_channel,
            subagent_identity_present=subagent_identity_present,
        )

    return HookPayloadClassification(
        detection_source="default",
        hook_event_name=hook_event_name,
        is_subagent=False,
        notification_channel=notification_channel,
        subagent_identity_present=subagent_identity_present,
    )


def build_hook_classification_record(notification: dict) -> dict:
    classification = classify_hook_payload(notification)
    return {
        **asdict(classification),
        "agent_id_present": bool(notification.get("agent_id")),
        "agent_transcript_path_present": bool(
            notification.get("agent_transcript_path")
        ),
        "agent_type_present": bool(notification.get("agent_type")),
    }


def append_jsonl_record(*, log_path: str | Path, record: dict) -> None:
    record_path = Path(log_path)
    record_path.parent.mkdir(parents=True, exist_ok=True)
    with record_path.open("a", encoding="utf-8") as record_file:
        record_file.write(json.dumps(record, sort_keys=True))
        record_file.write("\n")

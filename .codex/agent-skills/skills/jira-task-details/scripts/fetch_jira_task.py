#!/usr/bin/env python3
"""Fetch Jira issue details and render a compact task artifact."""

from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import sys
import textwrap
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ISSUE_KEY_PATTERN = re.compile(r"([A-Z][A-Z0-9]+-\d+)")
JIRA_FIELDS = [
    "summary",
    "issuetype",
    "status",
    "priority",
    "assignee",
    "reporter",
    "created",
    "updated",
    "description",
    "components",
    "labels",
    "fixVersions",
    "versions",
    "parent",
    "issuelinks",
    "subtasks",
    "attachment",
    "comment",
    "*all",
]
METADATA_ALLOWED_NAMES = {
    "Clarity ID",
    "Defect Type",
    "ETG Required?",
    "Feature Link",
    "Last Status Change Date",
    "Planned Investment?",
    "Product Release Schedule?",
    "Productive Work?",
    "RAG Status",
    "ServicePoint ID",
    "Sprint",
}


def acceptance_criteria_from_fields(fields: dict[str, Any], names: dict[str, str]) -> str:
    for field_key, field_value in fields.items():
        if not field_key.startswith("customfield_"):
            continue
        if names.get(field_key) == "Acceptance Criteria" and field_value:
            return str(field_value)
    return ""


def auth_header(api_token: str, email: str | None) -> str:
    if email:
        token_bytes = f"{email}:{api_token}".encode("utf-8")
        return "Basic " + base64.b64encode(token_bytes).decode("ascii")
    return "Bearer " + api_token


def compact_user(value: dict[str, Any] | None) -> str:
    if not value:
        return "Unassigned"
    return value.get("displayName") or value.get("emailAddress") or value.get("name") or "Unknown"


def env_value(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def extract_issue_key(issue_input: str) -> str:
    match = ISSUE_KEY_PATTERN.search(issue_input.upper())
    if not match:
        raise SystemExit(f"Could not find Jira issue key in: {issue_input}")
    return match.group(1)


def fetch_issue(base_url: str, api_token: str, email: str | None, issue_key: str) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "expand": "names,renderedFields",
            "fields": ",".join(JIRA_FIELDS),
        }
    )
    url = f"{base_url.rstrip('/')}/rest/api/2/issue/{issue_key}?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": auth_header(api_token, email),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Jira request failed: HTTP {error.code}\n{body}") from error
    except urllib.error.URLError as error:
        raise SystemExit(f"Jira request failed: {error.reason}") from error


def field_name(value: dict[str, Any] | None) -> str:
    if not value:
        return ""
    return str(value.get("name") or value.get("value") or "")


def format_datetime(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f%z")
    except ValueError:
        return value
    utc_value = parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"{value} ({utc_value})"


def markdown_list_items(raw_text: str) -> list[str]:
    clean_text = html.unescape(raw_text or "")
    clean_text = re.sub(r"<[^>]+>", "", clean_text)
    lines = []
    for raw_line in clean_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = re.sub(r"^\*+\s*", "", line)
        lines.append(line)
    return lines


def metadata_value(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("value") or value.get("name") or value)

    if isinstance(value, list):
        values = [metadata_value(item) for item in value]
        return ", ".join(item for item in values if item)

    text = str(value)
    sprint_match = re.search(r"name=([^,\]]+)", text)
    if sprint_match:
        return sprint_match.group(1)
    return text


def normalize_issue(base_url: str, issue: dict[str, Any]) -> dict[str, Any]:
    fields = issue.get("fields", {})
    names = issue.get("names", {})
    comments = fields.get("comment", {}).get("comments", [])
    attachments = fields.get("attachment", [])

    custom_nonempty = {}
    for field_key, field_value in fields.items():
        if not field_key.startswith("customfield_") or field_value in (None, "", []):
            continue
        custom_nonempty[field_key] = {
            "name": names.get(field_key, field_key),
            "value": field_value,
        }

    return {
        "key": issue.get("key"),
        "url": f"{base_url.rstrip('/')}/browse/{issue.get('key')}",
        "summary": fields.get("summary", ""),
        "type": field_name(fields.get("issuetype")),
        "status": field_name(fields.get("status")),
        "priority": field_name(fields.get("priority")),
        "assignee": compact_user(fields.get("assignee")),
        "reporter": compact_user(fields.get("reporter")),
        "created": format_datetime(fields.get("created")),
        "updated": format_datetime(fields.get("updated")),
        "description": fields.get("description") or "",
        "acceptance_criteria": acceptance_criteria_from_fields(fields, names),
        "components": [item.get("name") for item in fields.get("components", [])],
        "labels": fields.get("labels", []),
        "fix_versions": [item.get("name") for item in fields.get("fixVersions", [])],
        "versions": [item.get("name") for item in fields.get("versions", [])],
        "parent": fields.get("parent", {}).get("key"),
        "issue_links": fields.get("issuelinks", []),
        "subtasks": fields.get("subtasks", []),
        "attachments": [
            {
                "filename": item.get("filename"),
                "author": compact_user(item.get("author")),
                "created": format_datetime(item.get("created")),
                "size": item.get("size"),
            }
            for item in attachments
        ],
        "comments": [
            {
                "author": compact_user(item.get("author")),
                "created": format_datetime(item.get("created")),
                "body": item.get("body", ""),
            }
            for item in comments
        ],
        "custom_nonempty": custom_nonempty,
    }


def render_bullets(label: str, values: list[Any]) -> list[str]:
    if not values:
        return [f"- **{label}:** none"]
    return [f"- **{label}:** {', '.join(str(value) for value in values if value)}"]


def render_markdown(issue: dict[str, Any]) -> str:
    lines = [
        f"# {issue['key']} - {issue['summary']}",
        "",
        "## Summary",
        "",
        f"- **URL:** {issue['url']}",
        f"- **Type:** {issue['type']}",
        f"- **Status:** {issue['status']}",
        f"- **Priority:** {issue['priority']}",
        f"- **Assignee:** {issue['assignee']}",
        f"- **Reporter:** {issue['reporter']}",
        f"- **Created:** {issue['created']}",
        f"- **Updated:** {issue['updated']}",
    ]

    lines.extend(render_bullets("Components", issue["components"]))
    lines.extend(render_bullets("Labels", issue["labels"]))
    lines.extend(render_bullets("Fix Versions", issue["fix_versions"]))
    lines.extend(render_bullets("Affects Versions", issue["versions"]))
    if issue["parent"]:
        lines.append(f"- **Parent:** {issue['parent']}")

    lines.extend(["", "## Description", ""])
    description_items = markdown_list_items(issue["description"])
    if description_items:
        lines.extend(textwrap.fill(item, width=100) for item in description_items)
    else:
        lines.append("No description.")

    lines.extend(["", "## Acceptance Criteria", ""])
    criteria_items = markdown_list_items(issue["acceptance_criteria"])
    if criteria_items:
        lines.extend(f"- {item}" for item in criteria_items)
    else:
        lines.append("No acceptance criteria.")

    metadata_items = []
    for field in issue["custom_nonempty"].values():
        name = field["name"]
        value = field["value"]
        if name == "Acceptance Criteria" or name not in METADATA_ALLOWED_NAMES:
            continue
        metadata_items.append(f"- **{name}:** {metadata_value(value)}")

    lines.extend(["", "## Jira Metadata", ""])
    lines.extend(metadata_items or ["No extra metadata."])

    lines.extend(["", "## Related Items", ""])
    lines.append(f"- **Issue links:** {len(issue['issue_links'])}")
    lines.append(f"- **Subtasks:** {len(issue['subtasks'])}")
    lines.append(f"- **Attachments:** {len(issue['attachments'])}")
    lines.append(f"- **Comments:** {len(issue['comments'])}")

    if issue["comments"]:
        lines.extend(["", "## Comments", ""])
        for comment in issue["comments"]:
            lines.append(f"- **{comment['author']}**, {comment['created']}: {comment['body']}")

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch Jira issue details.")
    parser.add_argument("issue", help="Jira issue key or browse URL.")
    parser.add_argument("--base-url", default=os.environ.get("JIRA_ISSUER_BASE_URL", ""))
    parser.add_argument("--token", default=os.environ.get("JIRA_ISSUER_API_TOKEN", ""))
    parser.add_argument("--email", default=os.environ.get("JIRA_EMAIL"))
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--output", help="Optional output file path.")
    return parser.parse_args()


def write_output(content: str, output_path: str | None) -> None:
    if not output_path:
        print(content, end="")
        return

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"Wrote {path}")


def main() -> int:
    args = parse_args()
    base_url = args.base_url.strip() or env_value("JIRA_ISSUER_BASE_URL")
    api_token = args.token.strip() or env_value("JIRA_ISSUER_API_TOKEN")
    issue_key = extract_issue_key(args.issue)

    raw_issue = fetch_issue(base_url, api_token, args.email, issue_key)
    issue = normalize_issue(base_url, raw_issue)
    if args.format == "json":
        content = json.dumps(issue, indent=2, ensure_ascii=False) + "\n"
    else:
        content = render_markdown(issue)

    write_output(content, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

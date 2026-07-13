#!/usr/bin/env python3
"""Fetch a Confluence page by URL or page id using env-based auth."""

from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any


TOKEN_ENV_NAMES = (
    "CONFLUENCE_API_TOKEN",
    "CONFLUENCE_TOKEN",
    "CONFLUENCE_PAT",
    "CONFLUENCE_PERSONAL_ACCESS_TOKEN",
    "ATLASSIAN_API_TOKEN",
)

USER_ENV_NAMES = (
    "CONFLUENCE_EMAIL",
    "CONFLUENCE_USERNAME",
    "ATLASSIAN_EMAIL",
)


class ConfluenceError(RuntimeError):
    """Expected fetch/configuration failure."""


class StorageTextParser(HTMLParser):
    """Small storage-HTML-to-text parser with readable block breaks."""

    block_tags = {
        "blockquote",
        "br",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "ol",
        "p",
        "pre",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.block_tags:
            self._append_break()
        if tag == "li":
            self._chunks.append("- ")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.block_tags:
            self._append_break()

    def handle_data(self, data: str) -> None:
        text = html.unescape(data)
        if text.strip():
            self._chunks.append(text)

    def text(self) -> str:
        raw_text = "".join(self._chunks)
        raw_text = re.sub(r"[ \t\r\f\v]+", " ", raw_text)
        raw_text = re.sub(r" *\n *", "\n", raw_text)
        raw_text = re.sub(r"\n{3,}", "\n\n", raw_text)
        return raw_text.strip()

    def _append_break(self) -> None:
        if self._chunks and not self._chunks[-1].endswith("\n"):
            self._chunks.append("\n")


def env_first(names: tuple[str, ...]) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def parse_target(target: str, base_url_arg: str | None) -> tuple[str, str]:
    target = target.strip()
    if not target:
        raise ConfluenceError("Empty Confluence URL/page id")

    if target.isdigit():
        base_url = normalize_base_url(base_url_arg or os.environ.get("CONFLUENCE_BASE_URL"))
        if not base_url:
            raise ConfluenceError("Cannot infer base URL; pass full URL or set CONFLUENCE_BASE_URL")
        return base_url, target

    parsed = urllib.parse.urlparse(target)
    if not parsed.scheme or not parsed.netloc:
        raise ConfluenceError("Target must be full Confluence URL or numeric page id")

    page_id = parse_page_id(target)
    if not page_id:
        raise ConfluenceError("Cannot find page id in URL")

    base_url = normalize_base_url(base_url_arg or os.environ.get("CONFLUENCE_BASE_URL"))
    if not base_url:
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    return base_url, page_id


def parse_page_id(url: str) -> str | None:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    for key in ("pageId", "page_id"):
        if query.get(key) and query[key][0].isdigit():
            return query[key][0]

    match = re.search(r"/pages/(\d+)(?:/|$)", parsed.path)
    if match:
        return match.group(1)

    match = re.search(r"/viewpage\.action$", parsed.path)
    if match and query.get("pageId") and query["pageId"][0].isdigit():
        return query["pageId"][0]

    return None


def normalize_base_url(base_url: str | None) -> str | None:
    if not base_url:
        return None
    return base_url.rstrip("/")


def auth_header_candidates() -> list[dict[str, str]]:
    token = env_first(TOKEN_ENV_NAMES)
    user = env_first(USER_ENV_NAMES)
    auth_type = os.environ.get("CONFLUENCE_AUTH_TYPE", "auto").strip().lower()

    if auth_type not in {"auto", "basic", "bearer"}:
        raise ConfluenceError("CONFLUENCE_AUTH_TYPE must be auto, basic, or bearer")

    if not token:
        raise ConfluenceError("Missing token; set CONFLUENCE_API_TOKEN or another supported token variable")

    headers: list[dict[str, str]] = []

    if auth_type in {"auto", "basic"} and user:
        raw = f"{user}:{token}".encode("utf-8")
        headers.append({"Authorization": f"Basic {base64.b64encode(raw).decode('ascii')}"})

    if auth_type in {"auto", "bearer"}:
        headers.append({"Authorization": f"Bearer {token}"})

    if not headers:
        raise ConfluenceError("Basic auth requires CONFLUENCE_EMAIL, CONFLUENCE_USERNAME, or ATLASSIAN_EMAIL")

    return headers


def fetch_page(base_url: str, page_id: str) -> dict[str, Any]:
    endpoint = f"{base_url}/rest/api/content/{urllib.parse.quote(page_id)}"
    query = urllib.parse.urlencode({"expand": "body.storage,space,version,history,_links"})
    url = f"{endpoint}?{query}"

    auth_errors: list[str] = []
    for auth_headers in auth_header_candidates():
        request = urllib.request.Request(
            url,
            headers={
                **auth_headers,
                "Accept": "application/json",
                "User-Agent": "codex-confluence-skill/1.0",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                auth_errors.append("HTTP 401")
                continue
            raise ConfluenceError(f"HTTP {exc.code}: {safe_http_error_body(exc)}") from exc
        except urllib.error.URLError as exc:
            raise ConfluenceError(f"Network error: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise ConfluenceError("Confluence returned invalid JSON") from exc

    raise ConfluenceError("; ".join(auth_errors) or "Authentication failed")


def safe_http_error_body(exc: urllib.error.HTTPError) -> str:
    try:
        body = exc.read(600).decode("utf-8", errors="replace")
    except Exception:
        return exc.reason
    clean = re.sub(r"\s+", " ", body).strip()
    return clean or exc.reason


def storage_to_text(storage_html: str) -> str:
    parser = StorageTextParser()
    parser.feed(storage_html or "")
    parser.close()
    return parser.text()


def normalize_page(data: dict[str, Any], base_url: str, page_id: str, limit_chars: int | None) -> dict[str, Any]:
    body_storage = data.get("body", {}).get("storage", {}).get("value", "")
    body_text = storage_to_text(body_storage)
    if limit_chars is not None and len(body_text) > limit_chars:
        body_text = body_text[:limit_chars].rstrip() + "\n...[truncated]"

    links = data.get("_links", {})
    page_url = links.get("webui")
    if page_url and page_url.startswith("/"):
        page_url = f"{base_url}{page_url}"
    elif not page_url:
        page_url = f"{base_url}/pages/{page_id}"

    version = data.get("version") or {}
    space = data.get("space") or {}

    return {
        "title": data.get("title") or "",
        "page_id": data.get("id") or page_id,
        "url": page_url,
        "space": {
            "key": space.get("key"),
            "name": space.get("name"),
        },
        "version": {
            "number": version.get("number"),
            "when": version.get("when"),
            "by": (version.get("by") or {}).get("displayName"),
        },
        "body_text": body_text,
    }


def render_markdown(page: dict[str, Any]) -> str:
    title = page["title"] or "(untitled)"
    space = page["space"]
    version = page["version"]
    lines = [
        f"# {title}",
        "",
        f"- Page ID: {page['page_id']}",
        f"- URL: {page['url']}",
    ]

    if space.get("key") or space.get("name"):
        lines.append(f"- Space: {space.get('key') or ''} {space.get('name') or ''}".rstrip())
    if version.get("number") is not None:
        lines.append(f"- Version: {version.get('number')}")
    if version.get("when"):
        lines.append(f"- Updated: {version.get('when')}")
    if version.get("by"):
        lines.append(f"- Updated by: {version.get('by')}")

    lines.extend(["", "## Body", "", page["body_text"] or "(empty)"])
    return "\n".join(lines).strip() + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch a Confluence page from a URL or page id using env-based auth.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Examples:
              fetch_confluence_page.py "https://enterprise-confluence.onefiserv.net/spaces/EGPT/pages/1191905205/Title"
              fetch_confluence_page.py 1191905205 --base-url https://enterprise-confluence.onefiserv.net --format json
            """
        ),
    )
    parser.add_argument("target", help="Full Confluence page URL or numeric page id")
    parser.add_argument("--base-url", help="Confluence base URL; inferred from URL or CONFLUENCE_BASE_URL")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown", help="Output format")
    parser.add_argument("--limit-chars", type=int, help="Limit body_text characters")
    parser.add_argument("--output", help="Write output to file instead of stdout")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        base_url, page_id = parse_target(args.target, args.base_url)
        data = fetch_page(base_url, page_id)
        page = normalize_page(data, base_url, page_id, args.limit_chars)
        if args.format == "json":
            output = json.dumps(page, indent=2, sort_keys=True) + "\n"
        else:
            output = render_markdown(page)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as handle:
                handle.write(output)
        else:
            sys.stdout.write(output)
        return 0
    except ConfluenceError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

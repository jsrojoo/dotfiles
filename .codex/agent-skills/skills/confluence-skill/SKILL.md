---
name: confluence-skill
description: Work with enterprise Confluence using local Confluence environment variables. Use when Codex needs to read, fetch, summarize, quote, inspect, convert, or later manage Confluence content such as enterprise-confluence.onefiserv.net pages, spaces, attachments, or related Confluence artifacts.
---

# Confluence Skill

## Quick Start

Use bundled scripts for deterministic Confluence operations. Current feature: read page content by full page URL or numeric page ID.

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/confluence-skill/scripts/fetch_confluence_page.py" \
  "https://enterprise-confluence.onefiserv.net/spaces/EGPT/pages/1191905205/Denormalized+Associate+AI+Usage+Table+Structure" \
  --format markdown
```

If `${CODEX_HOME:-$HOME/.codex}/skills` does not contain this skill in the current runtime, locate the skill folder and run:

```bash
python3 /path/to/confluence-skill/scripts/fetch_confluence_page.py \
  "<confluence-url-or-page-id>" \
  --format markdown
```

## Environment

Read credentials from environment variables only. Do not print secret values.

Supported variables:

- `CONFLUENCE_BASE_URL`: Optional base URL, inferred from a full page URL when absent.
- `CONFLUENCE_API_TOKEN`, `CONFLUENCE_TOKEN`, `CONFLUENCE_PAT`, `CONFLUENCE_PERSONAL_ACCESS_TOKEN`, or `ATLASSIAN_API_TOKEN`: Token value.
- `CONFLUENCE_EMAIL`, `CONFLUENCE_USERNAME`, or `ATLASSIAN_EMAIL`: Optional user identity for Basic auth.
- `CONFLUENCE_AUTH_TYPE`: Optional `auto`, `bearer`, or `basic`; default is `auto`.

`auto` tries the most likely auth header first:

- `Basic` when a user identity and token exist.
- `Bearer` when token exists without a user identity.
- If first request returns `401`, retry with alternate token auth when possible.

## Workflow

### Read Pages

1. Prefer a full Confluence URL over a raw page ID so the script can infer `base_url` and canonical page link.
2. Run with `--format markdown` for human review or summarization.
3. Run with `--format json` when another tool needs structured fields.
4. Use `--output <file>` for large pages to avoid dumping sensitive page body into chat.
5. Use `--limit-chars <n>` when only a bounded excerpt is needed.

### Add Future Features

- Add new deterministic scripts under `scripts/` when operations become repeatable or fragile.
- Keep feature instructions in this file while small.
- Split detailed API notes into `references/` only when this file becomes too large or feature-specific.
- Preserve env-only auth and secret hygiene for all future Confluence operations.

## Output

Markdown output includes:

- Page title.
- Page ID.
- Space key/name when available.
- Version and last updated timestamp when available.
- Source URL.
- Plain text body extracted from Confluence storage HTML.

JSON output includes:

- `title`
- `page_id`
- `url`
- `space`
- `version`
- `body_text`

## Troubleshooting

- `Missing token`: export one supported token environment variable.
- `Cannot infer base URL`: pass full URL or set `CONFLUENCE_BASE_URL`.
- `Cannot find page id`: pass a URL containing `/pages/<id>/` or pass the numeric page ID.
- `HTTP 401`: set `CONFLUENCE_AUTH_TYPE=basic` or `CONFLUENCE_AUTH_TYPE=bearer` to force the auth scheme that matches the tenant.
- `HTTP 403`: credentials are valid but lack page permission.
- `HTTP 404`: page ID is wrong, base URL is wrong, or credentials cannot see the page.

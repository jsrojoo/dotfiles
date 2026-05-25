---
name: jira-task-details
description: Pull, summarize, and save Jira issue details using local Jira environment variables. Use when a user asks Codex to fetch Jira task details, inspect a Jira ticket, summarize a Jira issue, or create a reusable task artifact from Jira.
---

# Jira Task Details

## Quick Start

Use the bundled script:

```bash
python3 scripts/fetch_jira_task.py GVTE-4869
```

Save a reusable Markdown artifact:

```bash
python3 scripts/fetch_jira_task.py GVTE-4869 --output references/GVTE-4869.md
```

Emit raw normalized JSON:

```bash
python3 scripts/fetch_jira_task.py GVTE-4869 --format json
```

## Environment

Read Jira configuration from environment variables.

Required:
- `JIRA_ISSUER_BASE_URL`
- `JIRA_ISSUER_API_TOKEN`

Optional:
- `JIRA_EMAIL`, when token must use Basic auth instead of Bearer auth.

Never print token values.

## Workflow

1. Extract issue key from user input or Jira URL.
2. Run `scripts/fetch_jira_task.py <issue-key-or-url>`.
3. If user wants a durable artifact, pass `--output <path>`.
4. Summarize only high-signal fields:
   - title, type, status, priority
   - assignee, reporter, created, updated
   - description
   - acceptance criteria
   - sprint, feature link, RAG/status metadata
   - comments, attachments, subtasks, issue links
5. Call out missing comments, attachments, subtasks, or links.

## Notes

- Script uses Jira REST API v2 and Python standard library only.
- Default auth is `Authorization: Bearer <JIRA_ISSUER_API_TOKEN>`.
- If `JIRA_EMAIL` is set, script uses Basic auth with `email:token`.
- Markdown output is meant to be copied into task notes or kept in this skill's `references/` folder.

---
name: local-development
description: Joseph Rojo local Aitrium development setup knowledge. Use when working with local development, Dockerized local services, Postgres, MinIO, Coder workspace access, SSH to main.Aitrium.josephrojo.coder, port forwarding, Redis, OpenSearch, LocalStack/ElasticMQ, Kind Kubernetes, mise-managed Node/Python environments, mise.local.toml templates, or paths under /Users/josephrojo/fiserv/aitrium/aitrium-services and /Users/josephrojo/fiserv/coder/coder-aitrium.
---

# Local Development

## Core Paths

- Use `/Users/josephrojo/fiserv/aitrium/aitrium-services` for local laptop Dockerized services.
- Local laptop services include Postgres and MinIO.
- Use `/Users/josephrojo/fiserv/coder/coder-aitrium` for Coder workspace access and port forwarding.
- Use `aitrium-dev-workspace` for task workspace bootstrap, worktrees, tmux windows, cross-repo status, and cross-repo diffs.

## Coder Workspace

- From local machine, SSH into Coder workspace with:

```bash
ssh main.Aitrium.josephrojo.coder
```

- From local `/Users/josephrojo/fiserv/coder/coder-aitrium`, run `g` to start Coder port-forward services.
- Treat `g` as the user-defined shortcut for `g.sh` in `coder-aitrium`.
- Do not replace `g` with guessed commands unless the user asks to inspect or change that shortcut.

`g.sh` behavior:

```bash
rm nohup.out && nohup coder port-forward josephrojo/Aitrium \
  --tcp 6379:6379 \
  --tcp 9200:9200 \
  --tcp 9600:9600 \
  --tcp 9324:9324 \
  --tcp 9325:9325 &
```

Forwarded ports:

- `6379`: Redis.
- `9200`: OpenSearch HTTP.
- `9600`: OpenSearch performance/analyzer endpoint.
- `9324`: LocalStack/ElasticMQ main endpoint.
- `9325`: Additional LocalStack/ElasticMQ endpoint.

## Remote Services

Known services running in the Coder workspace:

- `aitrium-local-control-plane`: Kind Kubernetes control plane, image `kindest/node:v1.30.0`, localhost-mapped API server.
- `elasticmq`: LocalStack container, image `public.ecr.aws/localstack/localstack:latest`, exposes local port `9324` to container `4566`.
- `redis`: Redis container, image `public.ecr.aws/docker/library/redis:7.2-alpine`, exposes port `6379`.
- `opensearch`: OpenSearch container, image `public.ecr.aws/opensearchproject/opensearch:latest`, exposes ports `9200` and `9600`.

## Working Rules

- Before changing local-dev setup, distinguish local laptop services from remote Coder services.
- Use `mise` for local Node and Python environment setup when repo conventions do not say otherwise.
- If task mentions Postgres or MinIO, first check `/Users/josephrojo/fiserv/aitrium/aitrium-services`.
- If task mentions Redis, OpenSearch, ElasticMQ, LocalStack, Kind, Kubernetes API, SSH, or port forwarding, first check `/Users/josephrojo/fiserv/coder/coder-aitrium` and the Coder workspace.
- When giving commands that must run inside Coder, clearly mark them as remote workspace commands.
- When giving commands that must run on laptop, clearly mark them as local machine commands.
- Do not assume remote service state is current; verify with `docker ps` inside the Coder workspace when needed.
- Do not start, stop, or recreate services unless the user asks or the task requires it.

## Mise Templates

Use these `mise.local.toml` templates for local repo Node/Python environment setup when appropriate.

- Python repo template: `assets/mise/python-mise.local.toml`.
- Node repo template: `assets/mise/node-mise.local.toml`.
- Replace `<repo-name>` with the current repo name before using the template.
- Do not use these templates for Aitrium multi-repo tmux workspace setup; use `aitrium-dev-workspace` for that.

## Quick Checks

Local machine:

```bash
cd /Users/josephrojo/fiserv/aitrium/aitrium-services
docker ps
```

Coder workspace:

```bash
cd /Users/josephrojo/fiserv/coder/coder-aitrium
g
ssh main.Aitrium.josephrojo.coder
docker ps
```

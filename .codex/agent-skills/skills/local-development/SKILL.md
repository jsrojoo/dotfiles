---
name: local-development
description: Joseph Rojo local Aitrium development setup knowledge. Use when working with local development, Dockerized local services, Postgres, MinIO, Coder workspace access, SSH to main.Aitrium.josephrojo.coder, port forwarding, Redis, OpenSearch, LocalStack/ElasticMQ, Kind Kubernetes, local auth/OAuth service startup, PingID sandbox, mise-managed Node/Python environments, mise.local.toml templates, or paths under /Users/josephrojo/fiserv/aitrium/aitrium-services and /Users/josephrojo/fiserv/coder/coder-aitrium.
---

# Local Development

## Core Paths

- Use `/Users/josephrojo/fiserv/aitrium/aitrium-services` for local laptop Dockerized services.
- Local laptop services include Postgres and MinIO.
- Use `/Users/josephrojo/fiserv/coder/coder-aitrium` for Coder workspace access and port forwarding.
- Use `aitrium-dev-workspace` for task workspace bootstrap, worktrees, tmux windows, cross-repo status, and cross-repo diffs.

## Local Auth And PingID

- Use this flow when an Aitrium UI needs `http://localhost:5000/v1/oauth/initialize` or local OAuth login.
- Start PingID sandbox first from `/Users/josephrojo/fiserv/aitrium/pingid-sandbox`; it serves local PingID on `http://localhost:4321`.
- PingID sandbox needs Redis for `/api/submit`; if Coder Redis on `6379` hangs, use isolated local Redis on `6380`.

```bash
docker run -d --name aitrium-pingid-redis -p 6380:6379 redis:latest
```

```bash
REDIS_PORT=6380 npm run dev
```

- Start `enterprise-gpt-api` auth routes from `/Users/josephrojo/fiserv/aitrium/enterprise-gpt-api` on `http://localhost:5000`.
- Source env files with `./` paths in zsh; `. .env` can fail with `no such file or directory`.
- Do not print dotenv contents.

```bash
set -a
. ./.env
. ./auth.env
. ./auth-local.env
. ./orion-apis.env
set +a
CORS_ORIGINS='http://localhost:5173,http://localhost:3000,http://localhost:8001' CORS_CREDENTIALS=True OAUTH_ACCESS_TOKEN_KEY=access_token OAUTH_REFERER_REDIRECT=true OAUTH_REFERER_WHITELIST='http://localhost:5173/,http://localhost:5173/login,http://localhost:3000/,http://localhost:8001/' OAUTH_ON_SUCCESS_REDIRECT_URI='http://localhost:5173' OAUTH_ON_ERROR_REDIRECT_URI='http://localhost:5173/login' FUNCTION=postLogin,oAuthInitialize,oAuthCode,unifiedAuthCallback,oAuthMe,oAuthLogout,oAutRefresh,getPublicSettings poetry run uvicorn server:app --reload --host 0.0.0.0 --port 5000
```

- Direct browser open of `http://localhost:5000/v1/oauth/initialize` may return `200 OK` JSON with `sso_url`; this is normal when no whitelisted `Referer` header is present.
- Expected UI click from `http://localhost:5173/` is `307 Temporary Redirect` to `http://localhost:4321/as/authorization.oauth2`.
- If `localhost:5000` refuses connection, `enterprise-gpt-api` is not running.
- If `sso_url` points away from `localhost:4321`, check auth env for `OAUTH_PING_ID_BASE_URI=http://localhost:4321`.
- If UI still shows JSON, check the request `Referer`; `handlers/oauth/initialize_oauth/handler.py` requires exact match against `OAUTH_REFERER_WHITELIST`.
- If PingID hangs after selecting a user and clicking Submit, test `/api/submit`; a hang usually means Redis is unavailable or stale.
- If callback redirects to `login?egpt_error=INTERNAL_SERVER_ERROR` and logs show `KeyError: ''`, set `OAUTH_ACCESS_TOKEN_KEY=access_token`.
- If UI requests to `/v1/oauth/me` or `/v1/public/settings` fail preflight, set `CORS_ORIGINS` to include `http://localhost:5173` and `CORS_CREDENTIALS=True`.
- Verify without printing secrets:

```bash
lsof -nP -iTCP:5000 -sTCP:LISTEN
curl -i http://localhost:5000/v1/oauth/initialize
curl -i -H 'Referer: http://localhost:5173/' http://localhost:5000/v1/oauth/initialize
lsof -nP -iTCP:4321 -sTCP:LISTEN
curl -I http://localhost:4321
node -e "const Redis=require('ioredis'); const r=new Redis(6380,'localhost',{connectTimeout:1000,commandTimeout:2000}); r.ping().then(v=>{console.log(v); process.exit(0)}).catch(e=>{console.error(e.message); process.exit(1)})"
```

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

# FTU Engineering System M4 — Cloudflare Tunnel + Portainer CE demo deployment kit

Created for **staging and supervised demo on 2 November 2026**, NOT a hardened production deployment. Keep only dummy data. Nothing changes your existing Portainer stack automatically.

## Prerequisites

- The source release is committed in a Git branch (remote confirmed M4 commit `6390205974c48fd1621b973ac964a398524df0af`; Hybrid UI has not been verified on remote).
- A Linux SSH account permitted to access Docker on the exact same Docker environment as Portainer `local`.
- Available server disk/RAM, outbound internet access for Docker image builds, and Cloudflare account administrator for the existing Tunnel.
- Approval to publish a *dummy-only* app; secure demo accounts; no real client documents; no real or reused credentials.

## 1. Add these files to the selected Git release branch

Copy root `.dockerignore` and entire `deploy/` folder to the FTU repo. Do not overwrite `compose.yaml` or local `.env` files. Test from the PC first (`npm run build`, backend tests), then commit/push on release branch. DO NOT merge `main`.

If the Hybrid UI overlay hasn't passed local tests and isn't committed, build M4 verified instead. The image tag must identify the exact code version.

## 2. Build immutable images through SSH

On the friend’s Linux server after git checkout of *the selected release commit*:

```bash
cd /srv/ftu-engineering-repo
# Verify branch/commit before building:
git rev-parse HEAD
# Change tag only if the commit actually matches that release:
TAG=m4-6390205
docker build -f deploy/Dockerfile.app -t "ftu-demo-app:${TAG}" .
docker build -f deploy/Dockerfile.web -t "ftu-demo-web:${TAG}" .
docker image ls 'ftu-demo-*'
```

**Important:** the Dockerfiles must be in the repo checkout (copy/push first). Building images can take time and consumes server storage. If Docker environment managed by Portainer is a *different* host, local images won't be visible; push them to a registry or build on the correct host instead.

## 3. Create a NEW Portainer stack

In Portainer > local > Stacks > Add stack > Web editor:

- Name: `ftu-engineering-demo`
- Paste contents of `deploy/compose.portainer.yaml`
- Under Environment variables, fill values listed in `deploy/env.portainer.example` using unique generated secrets. Avoid exposing credentials in screenshots/logs. `APP_KEY` is `base64:` plus base64 encoded 32 random bytes; retain this value across redeploys.
- Set `FTU_RELEASE_TAG` to the actual image tag.
- Deploy the stack. Do NOT edit/redeploy/delete old `ftu-dash`.

The new stack has separate Docker volumes for mysql and private PDF storage, no database public port, and a test port bound only to server loopback `127.0.0.1:18081`. `APP_ENV=production` / `APP_DEBUG=false` are enforced in this compose.

## 4. Populate the demo DB and PDF volume

Use a freshly created dump of the **existing safe local M4 demo data** and a separate archive of the named `ftu_uploads` PDF volume. **Do not use real client data.** Transfer files privately with SSH/SCP (never Git or public URLs).

On target after the stack is healthy, identify container and volume names:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker volume ls | grep ftu-engineering-demo
```

Ask the person administering the server to import the SQL dump into the *new*, empty MySQL service, then restore PDF archive to the *new* `ftu_uploads` volume. DO NOT run `migrate:fresh`, `db:wipe`, `DatabaseSeeder`, `down -v`, or import old Portainer dashboard database. After import, run `php artisan migrate --force` if needed, inspect database counts, and test authenticated PDF download.

Example safe shell-side SQL import (within Portainer stack's MySQL container; replace target with the actual container name):

```bash
cat /srv/ftu-demo-private/ftu-demo.sql | docker exec -i <NEW_MYSQL_CONTAINER> sh -lc 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

Never print a database dump, APP_KEY, credentials, or PDF content in public logs. The upload volume is separate from the DB volume; backing up only MySQL is insufficient.

## 5. Cloudflare Tunnel origin setup

First determine where `cloudflared` runs:

```bash
docker ps --format '{{.Names}} {{.Image}}' | grep -i cloudflared || true
systemctl is-active cloudflared 2>/dev/null || true
```

### cloudflared runs on the Linux host

Cloudflare dashboard > Networking > Tunnels > existing tunnel > Routes > Add route > Published application:
- Hostname `ftu-stage.marizagira.my.id`
- Service `http://localhost:18081`

### cloudflared runs as a Docker container on the SAME Docker host

The Linux host's `127.0.0.1` is NOT the same as `localhost` inside the cloudflared container. Connect only the tunnel container to the new stack's edge network, without restarting or disconnecting its old networks:

```bash
docker network ls | grep ftu-engineering-demo
# Network name commonly: ftu-engineering-demo_edge
# Verify exact network/container names before running:
docker network connect ftu-engineering-demo_edge <CLOUDFLARED_CONTAINER>
```

Then stage route's service URL is `http://ftu-stage-web:80` (the unique nginx alias on that network).

If cloudflared runs on another host or managed by another Docker daemon, instead use a securely reachable internal address/proxy managed by the server owner. Do not expose MySQL or PHP-FPM directly.

## 6. Gate before production hostname cutover

- SSH host: `curl -i http://127.0.0.1:18081/api/health` gives HTTP 200 once DB connected.
- Unauthenticated `/api/dashboard` returns HTTP 401.
- Staging hostname uses HTTPS, loads assets and login, no 419 / 502 errors.
- Coordinator / engineer / viewer roles work, project/task/verifications/documents/history/accounts are gated correctly.
- `FTU-9101` has its A/B revisions and dummy PDF opens through authorized download.
- Four TV slides display, including a low-motion `?lite=1` check.
- No public access to `/storage`, database, PHP-FPM, or sensitive config; no original client data.
- Set Cloudflare edge/cache bypass for API, Sanctum, login and authenticated pages if existing cache rules could apply.

## 7. Cutover and rollback

In the EXISTING Cloudflare Tunnel route for `dash.marizagira.my.id`, change ONLY `Service URL` to the tested new origin:
- Host-based cloudflared: `http://localhost:18081`
- Docker-based cloudflared joined to `edge`: `http://ftu-stage-web:80`

Keep the old route's Service URL recorded and old `ftu-dash` stack running. Verify new domain `/login`, `/dashboard`, `/proyek`, `/dokumen` + authentication. To roll back, set the original Service URL back. Never delete DB volumes. Session cookies may need a fresh login when switching targets.

## Troubleshooting

- Old dashboard: Tunnel service URL still points to old origin, or images were built from `main`.
- Blank frontend / 404 static assets: frontend image isn't rebuilt, vite build failed, or browser cached an old bundle.
- 419 CSRF: verify secure cookies, Sanctum stateful hosts, HTTPS + proxy headers and same-host frontend/API.
- 502: app or nginx container unhealthy, wrong Docker network, or tunnel origin inaccessible from cloudflared.
- 500: check Laravel logs, APP_KEY, database migrations or permissions; never enable APP_DEBUG on public domain.
- Missing PDF: named `ftu_uploads` wasn't restored; SQL alone doesn't include file bytes.

Useful official docs: https://developers.cloudflare.com/tunnel/concepts/routing/ and https://docs.portainer.io/advanced/relative-paths
